// ── Prayer Times settings service (Cloudflare Worker) ─────────────────────────
//
// One small service for every masjid's shared settings (see
// docs/remote-settings.md). Routes, for a masjid code such as TOR4K7Q:
//
//   GET  /m/TOR4K7Q            the current settings  { version, updatedAt, settings }
//                              — public, any site may read it (CORS *)
//   GET  /m/TOR4K7Q/live       WebSocket: the current settings on connect,
//                              then each new version as it's published
//   GET  /m/TOR4K7Q/publish    the publish page (behind Cloudflare Access)
//   PUT  /m/TOR4K7Q/publish    store a new version (behind Cloudflare Access)
//   GET  /m/TOR4K7Q/publish?history
//                              who published the recent versions, and when
//                              (behind Cloudflare Access; same check as PUT)
//   GET  /publish.js           the publish page's script
//
// Each code is one Durable Object (MasjidSettings): it keeps the settings
// in its storage and pushes them to that masjid's connected screens. With
// the WebSocket Hibernation API idle connections cost nothing.
//
// Configuration (wrangler.toml [vars], or the dashboard):
//   ALLOWED_ORIGINS     the display app's origin(s), comma-separated, e.g.
//                       https://you.github.io  (who may hand settings to the
//                       publish page)
//   ACCESS_TEAM_DOMAIN  e.g. yourteam.cloudflareaccess.com
//   ACCESS_AUD          the Access application's AUD tag
//   MASJID_ADMINS       JSON: which signed-in emails may publish which codes,
//                       e.g. {"TOR4K7Q":["a@x.org"],"*":["you@x.org"]}
//   ALLOW_ANY_PUBLISHER "true" only if anyone Access lets in may publish any
//                       code (say, a service for one masjid). Without it, or
//                       MASJID_ADMINS, nobody may publish.
// Publishing is refused until ACCESS_TEAM_DOMAIN and ACCESS_AUD are set.
//
// Abuse: public reads are cached at the edge for CACHE_SECONDS, and each
// code takes at most MAX_SOCKETS live connections. Add a rate-limiting rule
// in the Cloudflare dashboard as well (docs/remote-settings.md).

import { isTeamDomain, verifyAccessJwt } from './access.js';
import { publishHtml, PUBLISH_JS } from './publishPage.js';

const CODE = /^[A-Z0-9]{4,16}$/;
const MAX_BODY_BYTES = 512 * 1024;
const CACHE_SECONDS = 30;
const MAX_SOCKETS = 500;
const MAX_SOCKETS_PER_IP = 20;
const MAX_HISTORY = 50;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });

const PUBLIC_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const PAGE_SECURITY = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/**
 * The display app's origins, from ALLOWED_ORIGINS: https only, apart from
 * this computer (http://localhost or 127.0.0.1, for testing).
 */
export function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(
      (s) => /^https:\/\/[^/]+$/.test(s) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(s)
    );
}

/** MASJID_ADMINS → { code: [emails] }; null when it isn't set. */
function parseAdmins(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Anything but a plain object (null, a list, a number) → nobody may
    // publish (fail closed), like an unreadable list.
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** May the signed-in admin publish this code? */
export async function authorizePublish(request, env, code, verify = verifyAccessJwt) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return { ok: false, status: 503, error: 'publishing is not set up on the service' };
  }
  if (!isTeamDomain(env.ACCESS_TEAM_DOMAIN)) {
    return {
      ok: false,
      status: 503,
      error: 'ACCESS_TEAM_DOMAIN must be <team>.cloudflareaccess.com',
    };
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  let claims;
  try {
    claims = await verify(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD });
  } catch {
    return { ok: false, status: 401, error: 'sign in first' };
  }
  const email = String(claims.email || '').toLowerCase();
  const admins = parseAdmins(env.MASJID_ADMINS);
  if (!admins) {
    // No list: refuse, unless the service says on purpose that anyone
    // Access lets in may publish any code.
    if (String(env.ALLOW_ANY_PUBLISHER || '').toLowerCase() === 'true') {
      return { ok: true, email, listed: false };
    }
    return {
      ok: false,
      status: 403,
      error: 'set MASJID_ADMINS on the service to allow publishing',
    };
  }
  const list = (key) =>
    Array.isArray(admins[key]) ? admins[key].map((e) => String(e).toLowerCase()) : [];
  if (!email || (!list('*').includes(email) && !list(code).includes(email))) {
    return { ok: false, status: 403, error: `this account can't publish ${code}` };
  }
  return { ok: true, email, listed: true };
}

/**
 * A security event for the Worker's logs (Workers Logs): what happened and a
 * reference, never an email address or the settings.
 */
function logEvent(event, fields) {
  console.log(JSON.stringify({ event, ...fields }));
}

/** A short reference for an answer, also in the logs: Cloudflare's Ray ID. */
const refOf = (request) =>
  String(request.headers.get('cf-ray') || crypto.randomUUID()).slice(0, 16);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/publish.js') {
      return new Response(PUBLISH_JS, {
        headers: {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          ...PAGE_SECURITY,
        },
      });
    }
    if (url.pathname === '/') {
      return new Response('Prayer Times settings service\n', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const ref = refOf(request);
    const fail = (status, error, headers) => json(status, { error, ref }, headers);
    const match = url.pathname.match(/^\/m\/([^/]+)(\/live|\/publish)?\/?$/);
    if (!match) return fail(404, 'not found');
    let code;
    try {
      code = decodeURIComponent(match[1]).toUpperCase();
    } catch {
      return fail(400, 'bad masjid code');
    }
    if (!CODE.test(code)) return fail(400, 'bad masjid code');
    const action = match[2] || '';
    const stub = env.MASJID.get(env.MASJID.idFromName(code));
    // Public reads are cached at the edge (screens check every few minutes;
    // a publish clears this location's copy, others expire within
    // CACHE_SECONDS). The Cache API isn't there in tests or on workers.dev.
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = new Request(`${url.origin}/m/${code}`);

    // Public: read the current settings.
    if (action === '') {
      if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers: PUBLIC_CORS });
      if (request.method !== 'GET') return fail(405, 'method not allowed', PUBLIC_CORS);
      const hit = cache && (await cache.match(cacheKey));
      if (hit) return hit;
      const res = await stub.fetch('https://do/state').catch(() => null);
      if (!res) return fail(503, 'the service is busy, try again', PUBLIC_CORS);
      const headers = new Headers(res.headers);
      for (const [name, value] of Object.entries(PUBLIC_CORS)) headers.set(name, value);
      headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
      const out = new Response(res.body, { status: res.status, headers });
      if (cache && (out.status === 200 || out.status === 404)) {
        ctx?.waitUntil?.(cache.put(cacheKey, out.clone()));
      }
      return out;
    }

    // Public: live updates.
    if (action === '/live') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return fail(426, 'expected a WebSocket');
      }
      return stub
        .fetch('https://do/live', { headers: request.headers })
        .catch(() => fail(503, 'the service is busy, try again'));
    }

    // Admin (behind Cloudflare Access): who published what.
    if (request.method === 'GET' && url.searchParams.has('history')) {
      const auth = await authorizePublish(request, env, code);
      // Publishers' emails: only for admins listed in MASJID_ADMINS (not
      // for everyone ALLOW_ANY_PUBLISHER lets publish).
      const allowed = auth.ok && auth.listed;
      if (!allowed) {
        const status = auth.ok ? 403 : auth.status;
        logEvent('history-denied', { code, status, ref });
        return fail(status, auth.ok ? 'the history is for admins in MASJID_ADMINS' : auth.error);
      }
      const res = await stub.fetch('https://do/history').catch(() => null);
      if (!res) return fail(503, 'the service is busy, try again');
      const headers = new Headers(res.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(res.body, { status: res.status, headers });
    }

    // Admin (behind Cloudflare Access): the publish page and the publish itself.
    if (request.method === 'GET') {
      return new Response(publishHtml(code, allowedOrigins(env)), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          ...PAGE_SECURITY,
        },
      });
    }
    if (request.method !== 'PUT') return fail(405, 'method not allowed');
    // Only the publish page (same site) may publish — another site can't
    // use an admin's sign-in to send settings.
    if (request.headers.get('Origin') !== url.origin) {
      logEvent('publish-denied', { code, status: 403, reason: 'origin', ref });
      return fail(403, 'wrong origin');
    }
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
      return fail(415, 'expected JSON');
    }
    const auth = await authorizePublish(request, env, code);
    if (!auth.ok) {
      logEvent('publish-denied', { code, status: auth.status, reason: auth.error, ref });
      return fail(auth.status, auth.error);
    }

    // Bytes, not characters (Arabic text takes two or three bytes a letter).
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) {
      return fail(413, 'settings too large');
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return fail(413, 'settings too large');
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return fail(400, 'not valid JSON');
    }
    if (
      !body ||
      typeof body.settings !== 'object' ||
      Array.isArray(body.settings) ||
      body.settings === null
    ) {
      return fail(400, 'expected { settings: { … } }');
    }
    const res = await stub
      .fetch('https://do/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: body.settings, updatedBy: auth.email }),
      })
      .catch(() => null);
    if (!res) {
      logEvent('publish', { code, status: 503, ref });
      return fail(503, 'not stored: the service is busy, try again');
    }
    if (res.ok && cache) await cache.delete(cacheKey);
    const result = await res.text();
    logEvent('publish', { code, status: res.status, ref, ...(res.ok ? JSON.parse(result) : {}) });
    return new Response(result, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};

/** What screens see: never who published it. */
const publicState = (state) => ({
  version: state.version,
  updatedAt: state.updatedAt,
  settings: state.settings,
});

/** One per masjid code: its settings, and its screens' live connections. */
export class MasjidSettings {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Answer the screens' keep-alive pings without waking the object.
    if (
      typeof globalThis.WebSocketRequestResponsePair === 'function' &&
      ctx.setWebSocketAutoResponse
    ) {
      ctx.setWebSocketAutoResponse(new globalThis.WebSocketRequestResponsePair('ping', 'pong'));
    }
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/state' && request.method === 'GET') {
      const state = await this.ctx.storage.get('state');
      return state
        ? json(200, publicState(state))
        : json(404, { error: 'nothing published for this code yet' });
    }
    if (pathname === '/state' && request.method === 'PUT') {
      const { settings, updatedBy } = await request.json();
      const previous = await this.ctx.storage.get('state');
      const state = {
        version: (previous?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || '',
        settings,
      };
      // Who published each version (the newest MAX_HISTORY), for the
      // service's own records: never shown to screens.
      const history = (await this.ctx.storage.get('history')) || [];
      history.push({
        version: state.version,
        updatedAt: state.updatedAt,
        updatedBy: state.updatedBy,
      });
      await this.ctx.storage.put({ state, history: history.slice(-MAX_HISTORY) });
      const message = JSON.stringify(publicState(state));
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(message);
        } catch {
          // a screen that just went away
        }
      }
      return json(200, { version: state.version, updatedAt: state.updatedAt });
    }
    if (pathname === '/history') {
      return json(200, { history: ((await this.ctx.storage.get('history')) || []).reverse() });
    }
    if (pathname === '/live') {
      // A masjid has a handful of screens: a flood of connections to one
      // code, or from one address, is refused (screens then rely on their
      // regular check). Each connection is tagged with its address.
      const ip = String(request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 64);
      if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
        return json(503, { error: 'too many screens connected to this code' });
      }
      if (this.ctx.getWebSockets(ip).length >= MAX_SOCKETS_PER_IP) {
        return json(429, { error: 'too many connections from this address' });
      }
      const pair = new globalThis.WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [ip]);
      const state = await this.ctx.storage.get('state');
      try {
        if (state) server.send(JSON.stringify(publicState(state)));
      } catch {
        // too large to send, say: the screen's regular check still works
      }
      return new Response(null, { status: 101, webSocket: client });
    }
    return json(404, { error: 'not found' });
  }

  // Fallback when auto-response isn't available.
  webSocketMessage(ws, message) {
    if (message === 'ping') ws.send('pong');
  }

  webSocketClose(ws, code) {
    try {
      ws.close(code, 'closing');
    } catch {
      // already closed
    }
  }
}

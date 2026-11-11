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
//   MASJID_ADMINS       optional JSON: which signed-in emails may publish
//                       which codes, e.g. {"TOR4K7Q":["a@x.org"],"*":["you@x.org"]}
//                       — without it, anyone Access lets in may publish any code.
// Publishing is refused until ACCESS_TEAM_DOMAIN and ACCESS_AUD are set.

import { verifyAccessJwt } from './access.js';
import { publishHtml, PUBLISH_JS } from './publishPage.js';

const CODE = /^[A-Z0-9]{4,16}$/;
const MAX_BODY_BYTES = 512 * 1024;

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

export function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter((s) => /^https?:\/\/[^/]+$/.test(s));
}

function parseAdmins(raw) {
  if (!raw) return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && typeof value === 'object' ? value : null;
  } catch {
    return {}; // unreadable list → nobody may publish (fail closed)
  }
}

/** May the signed-in admin publish this code? */
export async function authorizePublish(request, env, code, verify = verifyAccessJwt) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return { ok: false, status: 503, error: 'publishing is not set up on the service' };
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
  if (admins) {
    const list = (key) =>
      Array.isArray(admins[key]) ? admins[key].map((e) => String(e).toLowerCase()) : [];
    if (!list('*').includes(email) && !list(code).includes(email)) {
      return { ok: false, status: 403, error: `this account can't publish ${code}` };
    }
  }
  return { ok: true, email };
}

export default {
  async fetch(request, env) {
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

    const match = url.pathname.match(/^\/m\/([^/]+)(\/live|\/publish)?\/?$/);
    if (!match) return json(404, { error: 'not found' });
    const code = decodeURIComponent(match[1]).toUpperCase();
    if (!CODE.test(code)) return json(400, { error: 'bad masjid code' });
    const action = match[2] || '';
    const stub = env.MASJID.get(env.MASJID.idFromName(code));

    // Public: read the current settings.
    if (action === '') {
      if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers: PUBLIC_CORS });
      if (request.method !== 'GET') return json(405, { error: 'method not allowed' }, PUBLIC_CORS);
      const res = await stub.fetch('https://do/state');
      return new Response(res.body, {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), ...PUBLIC_CORS },
      });
    }

    // Public: live updates.
    if (action === '/live') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return json(426, { error: 'expected a WebSocket' });
      }
      return stub.fetch('https://do/live', { headers: request.headers });
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
    if (request.method !== 'PUT') return json(405, { error: 'method not allowed' });
    // Only the publish page (same site) may publish — another site can't
    // use an admin's sign-in to send settings.
    if (request.headers.get('Origin') !== url.origin) return json(403, { error: 'wrong origin' });
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
      return json(415, { error: 'expected JSON' });
    }
    const auth = await authorizePublish(request, env, code);
    if (!auth.ok) return json(auth.status, { error: auth.error });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'settings too large' });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: 'not valid JSON' });
    }
    if (
      !body ||
      typeof body.settings !== 'object' ||
      Array.isArray(body.settings) ||
      body.settings === null
    ) {
      return json(400, { error: 'expected { settings: { … } }' });
    }
    const res = await stub.fetch('https://do/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: body.settings, updatedBy: auth.email }),
    });
    return new Response(res.body, {
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
      await this.ctx.storage.put('state', state);
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
    if (pathname === '/live') {
      const pair = new globalThis.WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const state = await this.ctx.storage.get('state');
      if (state) server.send(JSON.stringify(publicState(state)));
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

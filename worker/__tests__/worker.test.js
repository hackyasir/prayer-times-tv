// ── worker.test.js ───────────────────────────────────────────────────────
// The settings service: Cloudflare Access sign-in checks, who may publish,
// versions, live updates to connected screens, and what is public.

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import worker, { MasjidSettings, authorizePublish, allowedOrigins } from '../src/index.js';
import { verifyAccessJwt, clearKeyCache, isTeamDomain } from '../src/access.js';
import { PUBLISH_JS } from '../src/publishPage.js';

const TEAM = 'myteam.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const ORIGIN = 'https://settings.example.org';

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const b64json = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

let keyPair;
let jwk;
beforeAll(async () => {
  keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  jwk = { ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)), kid: 'k1' };
});

async function token(claims = {}, { kid = 'k1', key } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64json({ alg: 'RS256', kid });
  const payload = b64json({
    aud: [AUD],
    iss: `https://${TEAM}`,
    exp: now + 600,
    email: 'admin@example.org',
    ...claims,
  });
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key || keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${b64url(sig)}`;
}

const certsFetch = () =>
  vi.fn(async (url) => {
    expect(url).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [jwk] }));
  });

afterEach(() => {
  clearKeyCache();
  vi.unstubAllGlobals();
});

describe('Cloudflare Access token check', () => {
  it('accepts a valid token and returns its claims', async () => {
    const claims = await verifyAccessJwt(await token(), {
      teamDomain: TEAM,
      aud: AUD,
      fetchImpl: certsFetch(),
    });
    expect(claims.email).toBe('admin@example.org');
  });

  it('rejects the wrong audience, an expired token and a forged signature', async () => {
    const opts = { teamDomain: `https://${TEAM}/`, aud: AUD, fetchImpl: certsFetch() };
    await expect(verifyAccessJwt(await token({ aud: ['other'] }), opts)).rejects.toThrow(
      'bad-audience'
    );
    await expect(verifyAccessJwt(await token({ exp: 1 }), opts)).rejects.toThrow('expired');
    const other = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign']
    );
    await expect(verifyAccessJwt(await token({}, { key: other.privateKey }), opts)).rejects.toThrow(
      'bad-signature'
    );
    await expect(verifyAccessJwt('not.a.token', opts)).rejects.toThrow();
    await expect(verifyAccessJwt(await token(), { ...opts, aud: '' })).rejects.toThrow(
      'not-configured'
    );
  });

  it('rejects another issuer, a token not valid yet, and any algorithm but RS256', async () => {
    const opts = { teamDomain: TEAM, aud: AUD, fetchImpl: certsFetch() };
    await expect(
      verifyAccessJwt(await token({ iss: 'https://other.cloudflareaccess.com' }), opts)
    ).rejects.toThrow('bad-issuer');
    const later = Math.floor(Date.now() / 1000) + 3600;
    await expect(verifyAccessJwt(await token({ nbf: later }), opts)).rejects.toThrow(
      'not-yet-valid'
    );
    const [, payload, sig] = (await token()).split('.');
    const none = `${b64json({ alg: 'none', kid: 'k1' })}.${payload}.${sig}`;
    await expect(verifyAccessJwt(none, opts)).rejects.toThrow('bad-alg');
  });

  it('fetches the keys again for a key it has not seen (after a minute)', async () => {
    const fetchImpl = certsFetch();
    const opts = { teamDomain: TEAM, aud: AUD, fetchImpl };
    await verifyAccessJwt(await token(), opts);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(verifyAccessJwt(await token({}, { kid: 'k2' }), opts)).rejects.toThrow(
      'unknown-key'
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1); // cached a moment ago: not again
    const later = { ...opts, now: Date.now() + 120_000 };
    await expect(verifyAccessJwt(await token({}, { kid: 'k2' }), later)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('who may publish', () => {
  const req = (t) =>
    new Request(`${ORIGIN}/m/TOR4K7Q/publish`, { headers: { 'Cf-Access-Jwt-Assertion': t } });
  const ok = async () => ({ email: 'Admin@Example.org' });

  it('refuses until Access is set up, and without a valid sign-in', async () => {
    expect((await authorizePublish(req('t'), {}, 'TOR4K7Q', ok)).status).toBe(503);
    const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
    const bad = async () => {
      throw new Error('bad');
    };
    expect((await authorizePublish(req('t'), env, 'TOR4K7Q', bad)).status).toBe(401);
    // No MASJID_ADMINS: nobody, unless ALLOW_ANY_PUBLISHER says so on purpose.
    expect((await authorizePublish(req('t'), env, 'TOR4K7Q', ok)).status).toBe(403);
    const open = { ...env, ALLOW_ANY_PUBLISHER: 'true' };
    expect(await authorizePublish(req('t'), open, 'TOR4K7Q', ok)).toEqual({
      ok: true,
      email: 'admin@example.org',
      listed: false,
    });
    // Only a Cloudflare Access team domain is trusted for the keys.
    const elsewhere = { ...open, ACCESS_TEAM_DOMAIN: 'keys.example.org' };
    expect((await authorizePublish(req('t'), elsewhere, 'TOR4K7Q', ok)).status).toBe(503);
    expect(isTeamDomain('https://myteam.cloudflareaccess.com/')).toBe(true);
    expect(isTeamDomain('myteam.cloudflareaccess.com.evil.example')).toBe(false);
  });

  it('limits accounts to their own masjid when MASJID_ADMINS is set', async () => {
    const env = {
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
      MASJID_ADMINS: JSON.stringify({ TOR4K7Q: ['admin@example.org'], '*': ['owner@example.org'] }),
    };
    expect((await authorizePublish(req('t'), env, 'TOR4K7Q', ok)).ok).toBe(true);
    expect((await authorizePublish(req('t'), env, 'OTHER1', ok)).status).toBe(403);
    const owner = async () => ({ email: 'owner@example.org' });
    expect((await authorizePublish(req('t'), env, 'OTHER1', owner)).ok).toBe(true);
    // A list that can't be read, or isn't a list of codes, lets nobody in.
    for (const MASJID_ADMINS of ['{not json', 'null', '[]', '0', '"x"']) {
      const broken = { ...env, MASJID_ADMINS, ALLOW_ANY_PUBLISHER: 'true' };
      expect((await authorizePublish(req('t'), broken, 'TOR4K7Q', ok)).status).toBe(403);
    }
  });

  it('reads the allowed app origins', () => {
    // Plain http only for this computer.
    expect(
      allowedOrigins({ ALLOWED_ORIGINS: 'http://evil.example, http://127.0.0.1:5173' })
    ).toEqual(['http://127.0.0.1:5173']);
    expect(
      allowedOrigins({ ALLOWED_ORIGINS: 'https://you.github.io/, http://localhost:5173, nonsense' })
    ).toEqual(['https://you.github.io', 'http://localhost:5173']);
  });
});

// A fake Durable Object namespace backed by real MasjidSettings objects.
function fakeEnv(extra = {}) {
  const objects = new Map();
  const sockets = [];
  const MASJID = {
    idFromName: (name) => name,
    get: (id) => {
      if (!objects.has(id)) {
        const store = new Map();
        const ctx = {
          storage: {
            get: async (k) => store.get(k),
            put: async (k, v) => {
              if (typeof k === 'object')
                for (const [kk, vv] of Object.entries(k)) store.set(kk, vv);
              else store.set(k, v);
            },
          },
          getWebSockets: (tag) => (tag ? sockets.filter((s) => s.tags?.includes(tag)) : sockets),
          acceptWebSocket: () => {},
        };
        objects.set(id, new MasjidSettings(ctx, {}));
      }
      const obj = objects.get(id);
      return { fetch: (url, init) => obj.fetch(new Request(url, init)) };
    },
  };
  return {
    env: {
      MASJID,
      ALLOWED_ORIGINS: 'https://you.github.io',
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
      MASJID_ADMINS: JSON.stringify({ '*': ['admin@example.org'] }),
      ...extra,
    },
    sockets,
  };
}

describe('the service', () => {
  it('publishes versions, pushes them to screens and keeps admins private', async () => {
    vi.stubGlobal('fetch', certsFetch());
    const { env, sockets } = fakeEnv();
    const screen = {
      sent: [],
      send(m) {
        this.sent.push(m);
      },
    };
    sockets.push(screen);

    const get = () => worker.fetch(new Request(`${ORIGIN}/m/tor4k7q`), env);
    expect((await get()).status).toBe(404); // nothing published yet

    const publish = async (settings, headers = {}) =>
      worker.fetch(
        new Request(`${ORIGIN}/m/TOR4K7Q/publish`, {
          method: 'PUT',
          headers: {
            Origin: ORIGIN,
            'Content-Type': 'application/json',
            'Cf-Access-Jwt-Assertion': await token(),
            ...headers,
          },
          body: JSON.stringify({ settings }),
        }),
        env
      );
    const first = await publish({ masjidName: 'Al-Noor' });
    expect(first.status).toBe(200);
    expect((await first.json()).version).toBe(1);
    expect((await (await publish({ masjidName: 'Al-Noor 2' })).json()).version).toBe(2);

    const res = await get();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const body = await res.json();
    expect(body.version).toBe(2);
    expect(body.settings.masjidName).toBe('Al-Noor 2');
    expect(JSON.stringify(body)).not.toContain('admin@example.org');

    expect(screen.sent).toHaveLength(2);
    expect(JSON.parse(screen.sent[1])).toMatchObject({
      version: 2,
      settings: { masjidName: 'Al-Noor 2' },
    });
    expect(screen.sent[1]).not.toContain('admin@example.org');
  });

  it('refuses publishing from another site, without JSON, or too large', async () => {
    vi.stubGlobal('fetch', certsFetch());
    const { env } = fakeEnv();
    const put = async (headers, body = JSON.stringify({ settings: {} })) =>
      (
        await worker.fetch(
          new Request(`${ORIGIN}/m/TOR4K7Q/publish`, {
            method: 'PUT',
            headers: { 'Cf-Access-Jwt-Assertion': await token(), ...headers },
            body,
          }),
          env
        )
      ).status;
    expect(await put({ Origin: 'https://evil.example', 'Content-Type': 'application/json' })).toBe(
      403
    );
    expect(await put({ Origin: ORIGIN, 'Content-Type': 'text/plain' })).toBe(415);
    expect(
      await put({ Origin: ORIGIN, 'Content-Type': 'application/json' }, 'x'.repeat(600 * 1024))
    ).toBe(413);
    expect(await put({ Origin: ORIGIN, 'Content-Type': 'application/json' }, '[1]')).toBe(400);
  });

  it('keeps who published each version, for signed-in admins only', async () => {
    vi.stubGlobal('fetch', certsFetch());
    const { env } = fakeEnv();
    const send = async (method, path, extra = {}) =>
      worker.fetch(
        new Request(`${ORIGIN}${path}`, {
          method,
          headers: {
            Origin: ORIGIN,
            'Content-Type': 'application/json',
            'Cf-Access-Jwt-Assertion': await token(),
            ...extra,
          },
          ...(method === 'PUT' ? { body: JSON.stringify({ settings: {} }) } : {}),
        }),
        env
      );
    await send('PUT', '/m/TOR4K7Q/publish');
    await send('PUT', '/m/TOR4K7Q/publish');
    const res = await send('GET', '/m/TOR4K7Q/publish?history');
    expect(res.status).toBe(200);
    const { history } = await res.json();
    expect(history.map((h) => [h.version, h.updatedBy])).toEqual([
      [2, 'admin@example.org'],
      [1, 'admin@example.org'],
    ]);
    const stranger = await send('GET', '/m/TOR4K7Q/publish?history', {
      'Cf-Access-Jwt-Assertion': 'not-a-token',
    });
    expect(stranger.status).toBe(401);
  });

  it('caches public reads at the edge, and clears them on publish', async () => {
    vi.stubGlobal('fetch', certsFetch());
    const store = new Map();
    vi.stubGlobal('caches', {
      default: {
        match: async (req) => store.get(req.url)?.clone(),
        put: async (req, res) => void store.set(req.url, res),
        delete: async (req) => store.delete(req.url),
      },
    });
    const waits = [];
    const ctx = { waitUntil: (p) => waits.push(p) };
    const { env } = fakeEnv();
    const get = async () => {
      const res = await worker.fetch(new Request(`${ORIGIN}/m/tor4k7q`), env, ctx);
      await Promise.all(waits);
      return res;
    };
    expect((await get()).status).toBe(404);
    expect(store.has(`${ORIGIN}/m/TOR4K7Q`)).toBe(true);
    expect((await get()).status).toBe(404); // from the cache
    const put = await worker.fetch(
      new Request(`${ORIGIN}/m/TOR4K7Q/publish`, {
        method: 'PUT',
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': await token(),
        },
        body: JSON.stringify({ settings: { masjidName: 'Al-Noor' } }),
      }),
      env,
      ctx
    );
    expect(put.status).toBe(200);
    expect(store.has(`${ORIGIN}/m/TOR4K7Q`)).toBe(false);
    const fresh = await get();
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('Cache-Control')).toBe('public, max-age=30');
  });

  it('shows the history only to admins listed in MASJID_ADMINS', async () => {
    vi.stubGlobal('fetch', certsFetch());
    const history = async (extra) => {
      const { env } = fakeEnv(extra);
      return (
        await worker.fetch(
          new Request(`${ORIGIN}/m/TOR4K7Q/publish?history`, {
            headers: { 'Cf-Access-Jwt-Assertion': await token() },
          }),
          env
        )
      ).status;
    };
    expect(await history()).toBe(200);
    const otherCode = JSON.stringify({ OTHER2: ['admin@example.org'] });
    expect(await history({ MASJID_ADMINS: otherCode })).toBe(403);
    expect(await history({ MASJID_ADMINS: '', ALLOW_ANY_PUBLISHER: 'true' })).toBe(403);
  });

  it('counts the settings size in bytes', async () => {
    vi.stubGlobal('fetch', certsFetch());
    const { env } = fakeEnv();
    // Under the limit in characters, over it in bytes (Arabic: two each).
    const announcements = 'ع'.repeat(300 * 1024);
    const res = await worker.fetch(
      new Request(`${ORIGIN}/m/TOR4K7Q/publish`, {
        method: 'PUT',
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': await token(),
        },
        body: JSON.stringify({ settings: { announcements } }),
      }),
      env
    );
    expect(res.status).toBe(413);
  });

  it('limits live connections from one address', async () => {
    const { env, sockets } = fakeEnv();
    for (let i = 0; i < 20; i++) sockets.push({ send() {}, tags: ['203.0.113.7'] });
    const live = (ip) =>
      worker.fetch(
        new Request(`${ORIGIN}/m/TOR4K7Q/live`, {
          headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
        }),
        env
      );
    expect((await live('203.0.113.7')).status).toBe(429);
  });

  it('limits live connections per code, and gives every error a reference', async () => {
    const { env, sockets } = fakeEnv();
    for (let i = 0; i < 500; i++) sockets.push({ send() {} });
    const live = await worker.fetch(
      new Request(`${ORIGIN}/m/TOR4K7Q/live`, { headers: { Upgrade: 'websocket' } }),
      env
    );
    expect(live.status).toBe(503);
    const bad = await worker.fetch(
      new Request(`${ORIGIN}/m/%E0%A4%A/`, { headers: { 'cf-ray': '8f1e2d3c4b5a6978-YYZ' } }),
      env
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'bad masjid code', ref: '8f1e2d3c4b5a6978' });
  });

  it('takes settings only from the app page that opened the publish tab', () => {
    expect(PUBLISH_JS).toContain('event.source !== window.opener');
    expect(PUBLISH_JS).not.toContain("'*'");
  });

  it('serves the publish page with a strict policy, and checks codes', async () => {
    const { env } = fakeEnv();
    const page = await worker.fetch(new Request(`${ORIGIN}/m/TOR4K7Q/publish`), env);
    expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    const html = await page.text();
    expect(html).toContain('data-code="TOR4K7Q"');
    expect(html).toContain('https://you.github.io');
    expect((await worker.fetch(new Request(`${ORIGIN}/m/no!/`), env)).status).toBe(400);
    expect((await worker.fetch(new Request(`${ORIGIN}/m/TOR4K7Q/live`), env)).status).toBe(426);
    expect(
      (await worker.fetch(new Request(`${ORIGIN}/publish.js`), env)).headers.get('Content-Type')
    ).toContain('javascript');
  });
});

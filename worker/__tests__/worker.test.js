// ── worker.test.js ───────────────────────────────────────────────────────
// The settings service: Cloudflare Access sign-in checks, who may publish,
// versions, live updates to connected screens, and what is public.

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import worker, { MasjidSettings, authorizePublish, allowedOrigins } from '../src/index.js';
import { verifyAccessJwt, clearKeyCache } from '../src/access.js';

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
    expect(await authorizePublish(req('t'), env, 'TOR4K7Q', ok)).toEqual({
      ok: true,
      email: 'admin@example.org',
    });
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
    const broken = { ...env, MASJID_ADMINS: '{not json' };
    expect((await authorizePublish(req('t'), broken, 'TOR4K7Q', ok)).status).toBe(403);
  });

  it('reads the allowed app origins', () => {
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
          storage: { get: async (k) => store.get(k), put: async (k, v) => store.set(k, v) },
          getWebSockets: () => sockets,
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

// ── access.js — check a Cloudflare Access sign-in ────────────────────────────
//
// Publishing is behind Cloudflare Access (its own sign-in: email one-time
// code, Google, …). Access passes the signed-in user to the Worker as a
// signed token in the `Cf-Access-Jwt-Assertion` header; this checks the
// signature against the team's public keys, the audience (the Access
// application's AUD tag), the issuer and the expiry, and returns the
// token's claims (including `email`).

const textDecoder = new TextDecoder();
let keyCache = { url: '', at: 0, keys: [] };
const KEY_CACHE_MS = 60 * 60 * 1000;

function base64UrlToBytes(s) {
  const b64 = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const decodeJson = (part) => JSON.parse(textDecoder.decode(base64UrlToBytes(part)));

/** "myteam.cloudflareaccess.com" from "https://myteam.cloudflareaccess.com/". */
export function teamHost(teamDomain) {
  return String(teamDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
}

/**
 * Is it a Cloudflare Access team domain? Only those are trusted to hand out
 * signing keys, so a mistyped setting can't point the check at another host.
 */
export function isTeamDomain(teamDomain) {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/i.test(teamHost(teamDomain));
}

async function publicKeys(host, fetchImpl, now) {
  const url = `https://${host}/cdn-cgi/access/certs`;
  if (keyCache.url === url && now - keyCache.at < KEY_CACHE_MS && keyCache.keys.length) {
    return keyCache.keys;
  }
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error('certs-unavailable');
  const body = await res.json();
  keyCache = { url, at: now, keys: Array.isArray(body.keys) ? body.keys : [] };
  return keyCache.keys;
}

/**
 * @param {string} token  the Cf-Access-Jwt-Assertion value
 * @param {object} opts   { teamDomain, aud, now?, fetchImpl? }
 * @returns {Promise<object>} the claims — throws if the token isn't valid
 */
export async function verifyAccessJwt(
  token,
  { teamDomain, aud, now = Date.now(), fetchImpl = fetch }
) {
  const host = teamHost(teamDomain);
  if (!token || !isTeamDomain(host) || !aud) throw new Error('not-configured');
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('bad-alg');

  let keys = await publicKeys(host, fetchImpl, now);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk && now - keyCache.at > 60_000) {
    // Access may have rotated its keys since they were cached: fetch once
    // more (at most once a minute, whatever tokens arrive).
    clearKeyCache();
    keys = await publicKeys(host, fetchImpl, now);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('unknown-key');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]),
    signed
  );
  if (!valid) throw new Error('bad-signature');

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(aud)) throw new Error('bad-audience');
  if (String(claims.iss || '').toLowerCase() !== `https://${host.toLowerCase()}`) {
    throw new Error('bad-issuer');
  }
  const seconds = Math.floor(now / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < seconds) throw new Error('expired');
  if (typeof claims.nbf === 'number' && claims.nbf > seconds + 60) throw new Error('not-yet-valid');
  return claims;
}

/** For tests: forget cached keys. */
export function clearKeyCache() {
  keyCache = { url: '', at: 0, keys: [] };
}

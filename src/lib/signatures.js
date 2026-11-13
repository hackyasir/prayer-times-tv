// ── lib/signatures.js — signed masjid updates (Ed25519) ─────────────────────
//
// With the shared registration sheet (lib/registrations.js) anyone can send
// a row to the form, so every real update carries the masjid's signature.
// A screen applies a row only if it was signed with the key you approved
// for that masjid; anything else is ignored.
//
// An update, as stored in the sheet's "Settings" cell:
//   {"v":1,"code":"ABC234","time":1794418255000,"settings":{…},"sig":"…"}
// The signature covers the stable JSON of { v, code, time, settings }, so
// changing any of them — or replaying it under another code — breaks it.
// `time` (set by the admin's device) orders updates: the newest valid one
// wins, so an old update sent again changes nothing.
//
// Anyone can put any text in that cell, so checking a row never throws:
// text too long for a cell, or settings nested deeper than any real ones,
// is refused before the signature is checked (very deep JSON would
// otherwise overflow the stack and stop the screens, the sheet's clean-up
// script and the deploy, not just that row).
//
// Ed25519 by tweetnacl (pure JavaScript, audited, runs on the oldest TV
// browsers this app supports). Loaded only where it's needed.

import nacl from 'tweetnacl';
import { stableStringify } from './sheetFormat.js';

export const KEY_PREFIX = 'ed25519:';
export const UPDATE_VERSION = 1;

/** A Google Sheets cell holds at most 50,000 characters. */
export const MAX_UPDATE_TEXT = 50_000;
/** Real settings are a few levels deep (settings → jumuah → slot). */
export const MAX_SETTINGS_DEPTH = 32;

// ── base64url (no padding) and UTF-8 ─────────────────────────────────────────
// Written out here rather than with btoa/atob/TextEncoder, so the same code
// also runs in Google Apps Script (the registration sheet's clean-up
// script, docs/registration-sheet.gs), which has none of them. The arrays
// are always this page's own Uint8Array: tweetnacl refuses typed arrays
// made elsewhere (another frame, or a test's DOM).

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function fromBase64Url(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
    return null;
  }
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    buffer = ((buffer << 6) | B64.indexOf(text[i])) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** UTF-8 bytes, as TextEncoder gives them (a lone surrogate becomes U+FFFD). */
export function utf8(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      } else c = 0xfffd;
    } else if (c >= 0xd800 && c < 0xe000) c = 0xfffd;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

// ── Keys ─────────────────────────────────────────────────────────────────────

/** A public key as written in the sheet: "ed25519:" + 43 characters. */
export function encodePublicKey(publicKey) {
  return KEY_PREFIX + toBase64Url(publicKey);
}

/** The 32 key bytes, or null if it isn't a well-formed public key. */
export function decodePublicKey(text) {
  const s = String(text ?? '').trim();
  if (!s.startsWith(KEY_PREFIX)) return null;
  const bytes = fromBase64Url(s.slice(KEY_PREFIX.length));
  return bytes && bytes.length === nacl.sign.publicKeyLength ? bytes : null;
}

/** A signing key pair from a 32-byte seed (see lib/passphraseKey.js). */
export function keyPairFromSeed(seed) {
  const pair = nacl.sign.keyPair.fromSeed(Uint8Array.from(seed));
  return { publicKey: encodePublicKey(pair.publicKey), secretKey: pair.secretKey };
}

// ── Updates ──────────────────────────────────────────────────────────────────

function message({ code, time, settings }) {
  return utf8(stableStringify({ v: UPDATE_VERSION, code, time, settings }));
}

/** The text for the sheet's "Settings" cell: the update and its signature. */
export function signUpdate({ code, time, settings }, secretKey) {
  const sig = nacl.sign.detached(message({ code, time, settings }), secretKey);
  return JSON.stringify({ v: UPDATE_VERSION, code, time, settings, sig: toBase64Url(sig) });
}

/** The signature part of an update's text (to find it again), or ''. */
export function updateSignature(text) {
  try {
    const sig = JSON.parse(text)?.sig;
    return typeof sig === 'string' ? sig : '';
  } catch {
    return '';
  }
}

/** Is `value` nested more than `limit` levels deep? (Without recursion.) */
function nestedDeeperThan(value, limit) {
  const stack = [[value, 0]];
  while (stack.length) {
    const [item, depth] = stack.pop();
    if (item === null || typeof item !== 'object') continue;
    if (depth >= limit) return true;
    for (const child of Object.values(item)) stack.push([child, depth + 1]);
  }
  return false;
}

/**
 * An update's contents if `text` is an update for `code` signed with
 * `publicKey` ("ed25519:…"); null for anything else. Never throws.
 * @returns {{ code: string, time: number, settings: object } | null}
 */
export function verifyUpdate(text, publicKey, code) {
  try {
    return checkUpdate(text, publicKey, code);
  } catch {
    // Whatever else is wrong with the text, it isn't a valid update.
    return null;
  }
}

function checkUpdate(text, publicKey, code) {
  const key = decodePublicKey(publicKey);
  if (!key || typeof text !== 'string' || text.length > MAX_UPDATE_TEXT) return null;
  const update = JSON.parse(text);
  if (
    !update ||
    update.v !== UPDATE_VERSION ||
    update.code !== code ||
    !Number.isFinite(update.time) ||
    !update.settings ||
    typeof update.settings !== 'object' ||
    Array.isArray(update.settings) ||
    nestedDeeperThan(update.settings, MAX_SETTINGS_DEPTH)
  ) {
    return null;
  }
  const sig = fromBase64Url(update.sig);
  if (!sig || sig.length !== nacl.sign.signatureLength) return null;
  const ok = nacl.sign.detached.verify(message(update), sig, key);
  return ok ? { code: update.code, time: update.time, settings: update.settings } : null;
}

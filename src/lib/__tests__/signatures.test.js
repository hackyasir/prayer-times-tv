// ── signatures.test.js ───────────────────────────────────────────────────
// A self-serve masjid's signed updates: only the masjid's key can make one
// a screen accepts, for that code, unchanged. And the key itself comes from
// the publish passphrase, the same on every device.

import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import {
  KEY_PREFIX,
  decodePublicKey,
  fromBase64Url,
  keyPairFromSeed,
  signUpdate,
  toBase64Url,
  updateSignature,
  utf8,
  verifyUpdate,
} from '../signatures.js';
import { KDF, derivePublishKey } from '../passphraseKey.js';

const MASJID = keyPairFromSeed(new Uint8Array(32).fill(7));
const OTHER = keyPairFromSeed(new Uint8Array(32).fill(8));
const settings = { masjidName: 'Al-Noor', iqamah: { isha: 10 }, announcements: 'Eid ✓ عيد' };
const FAST = { iterations: 1, memorySize: 64, parallelism: 1 };

describe('signed updates', () => {
  const text = signUpdate({ code: 'ABC234', time: 1794418255000, settings }, MASJID.secretKey);

  it('verify with the masjid’s key, for its code', () => {
    expect(verifyUpdate(text, MASJID.publicKey, 'ABC234')).toEqual({
      code: 'ABC234',
      time: 1794418255000,
      settings,
    });
    expect(updateSignature(text)).toHaveLength(86);
  });

  it('are refused with another key, under another code, or once changed', () => {
    expect(verifyUpdate(text, OTHER.publicKey, 'ABC234')).toBeNull();
    expect(verifyUpdate(text, MASJID.publicKey, 'XYZ789')).toBeNull();
    const changed = JSON.parse(text);
    changed.settings.iqamah.isha = 15;
    expect(verifyUpdate(JSON.stringify(changed), MASJID.publicKey, 'ABC234')).toBeNull();
    const later = { ...JSON.parse(text), time: 1794418255001 };
    expect(verifyUpdate(JSON.stringify(later), MASJID.publicKey, 'ABC234')).toBeNull();
    expect(verifyUpdate('not json', MASJID.publicKey, 'ABC234')).toBeNull();
    expect(verifyUpdate(text, 'ed25519:short', 'ABC234')).toBeNull();
  });

  it("don't depend on the order of the settings' keys", () => {
    const reordered = JSON.parse(text);
    reordered.settings = { announcements: settings.announcements, ...reordered.settings };
    expect(verifyUpdate(JSON.stringify(reordered), MASJID.publicKey, 'ABC234')).not.toBeNull();
  });

  it('write keys and signatures as base64url', () => {
    expect(MASJID.publicKey.startsWith(KEY_PREFIX)).toBe(true);
    expect(MASJID.publicKey).toHaveLength(KEY_PREFIX.length + 43);
    expect(decodePublicKey(MASJID.publicKey)).toHaveLength(32);
    expect(decodePublicKey('ed25519:not+base64')).toBeNull();
    const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('portable encodings (they also run in Google Apps Script)', () => {
  it('writes UTF-8 exactly as TextEncoder does', () => {
    for (const s of [
      '',
      'abc',
      'Eid ✓ عيد مبارك',
      'نماز 🕌 ok',
      'lone \ud800 surrogate',
      '\udc00x',
    ]) {
      expect(Array.from(utf8(s))).toEqual(Array.from(new TextEncoder().encode(s)));
    }
  });

  it('round-trips bytes through base64url, and refuses bad text', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255);
      expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    }
    expect(fromBase64Url('abc=')).toBeNull();
    expect(fromBase64Url('a')).toBeNull();
  });
});

describe('the passphrase key', () => {
  it('is the same for the same passphrase and code, and different otherwise', async () => {
    const a = await derivePublishKey('olive lantern river stone', 'ABC234', FAST);
    const b = await derivePublishKey('olive lantern river stone', 'ABC234', FAST);
    const c = await derivePublishKey('olive lantern river stone', 'XYZ789', FAST);
    const d = await derivePublishKey('olive lantern river stones', 'ABC234', FAST);
    expect(a.publicKey).toBe(b.publicKey);
    expect(new Set([a.publicKey, c.publicKey, d.publicKey]).size).toBe(3);
    // It signs updates the masjid's screens accept.
    const text = signUpdate({ code: 'ABC234', time: 1, settings }, a.secretKey);
    expect(verifyUpdate(text, b.publicKey, 'ABC234')).not.toBeNull();
  });

  it('treats the same letters typed differently (é or e + ◌́) as the same passphrase', async () => {
    const composed = await derivePublishKey('café minaret dawn', 'ABC234', FAST);
    const decomposed = await derivePublishKey('café minaret dawn', 'ABC234', FAST);
    expect(composed.publicKey).toBe(decomposed.publicKey);
  });

  it('uses Argon2id with 64 MiB of memory', async () => {
    expect(KDF).toEqual({ iterations: 3, memorySize: 65536, parallelism: 1 });
    const key = await derivePublishKey('olive lantern river stone', 'ABC234');
    expect(key.publicKey).toMatch(/^ed25519:[A-Za-z0-9_-]{43}$/);
  });
});

// ── lib/passphraseKey.js — a masjid's signing key from its publish passphrase ──
//
// The admin types the masjid's publish passphrase; Argon2id turns it (with
// the masjid's code as salt) into the seed of the masjid's Ed25519 signing
// key (lib/signatures.js). The same passphrase and code always give the same
// key, so any admin who knows the passphrase can publish from any device,
// and nothing secret is ever stored: the key lives in memory until the page
// is closed or the admin locks again.
//
// Only the public half is ever sent (to the registration sheet). Argon2id
// makes each guess slow and memory-hungry, so a long passphrase can't be
// found from the public key by trying guesses.
//
// Loaded only when an admin registers or publishes; the TV screens never
// load it.

import { argon2id } from 'hash-wasm';
import { keyPairFromSeed } from './signatures.js';

/** Fixed for every masjid: changing them changes every key. */
export const KDF = Object.freeze({
  iterations: 3,
  memorySize: 64 * 1024, // KiB = 64 MiB
  parallelism: 1,
});

const SALT_PREFIX = 'prayer-times-tv/publish-key/v1/';

/**
 * @param {string} passphrase
 * @param {string} code    the masjid's code (normalised)
 * @param {object} [kdf]   for tests only
 * @returns {Promise<{ publicKey: string, secretKey: Uint8Array }>}
 */
export async function derivePublishKey(passphrase, code, kdf = KDF) {
  const seed = await argon2id({
    password: String(passphrase).normalize('NFC'),
    salt: `${SALT_PREFIX}${code}`,
    iterations: kdf.iterations,
    memorySize: kdf.memorySize,
    parallelism: kdf.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
  return keyPairFromSeed(seed);
}

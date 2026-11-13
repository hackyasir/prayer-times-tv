// ── lib/registrations.js — masjids registering and publishing themselves ──────
//
// Self-serve masjids with the Google Sheet source (docs/remote-settings.md →
// "Self-serve masjids"). There is one Google Sheet for every masjid: the
// responses sheet of your registration Google Form.
//
//   Register  Settings → Masjid → Register your masjid. The admin chooses a
//             publish passphrase; the app picks a new code, signs this
//             screen's settings with the masjid's key (lib/passphraseKey.js,
//             lib/signatures.js) and sends them to the form in the
//             background: name, city, code, the signed settings and the
//             masjid's public key. Nobody signs in to Google.
//   Approve   You tick "Approved" on that row. That tick means "this public
//             key speaks for this masjid code".
//   Publish   Later changes are sent the same way, as new rows signed with
//             the same key; no new approval is needed.
//   Follow    Screens ask the sheet for their masjid's rows only, take the
//             key on the newest approved row, and apply the newest update
//             signed with it. Rows anyone else sends are ignored.
//
// The deploy (scripts/build-directory.mjs) lists approved masjids in
// masjids.json for Find your masjid, under the name and city in their
// newest signed settings.
//
// Pure and dependency-free (the build script runs it in Node): signature
// checks are passed in from lib/signatures.js.

import { normalizeCode } from './sheetFormat.js';

/** Code letters: no 0/O, 1/I/L, so codes are easy to read and type. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
// A new code starts with a letter other than E, so Google Sheets never reads
// it as a number (234567, 2E5) and drops it from the code column.
const FIRST_LETTERS = 'ABCDFGHJKMNPQRSTUVWXYZ';

/** A public key as the form sends it ("ed25519:" + 43 characters). */
export const KEY_RE = /^ed25519:[A-Za-z0-9_-]{43}$/;

/** A sheet cell holds at most 50,000 characters; keep well inside it. */
export const MAX_UPDATE_LENGTH = 45_000;

/** The shortest publish passphrase accepted. */
export const MIN_PASSPHRASE = 12;

function randomInts(n) {
  const out = new Uint32Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** A new random masjid code, e.g. "K7Q4TR" (about 640 million possible). */
export function newMasjidCode(random = randomInts) {
  const r = random(CODE_LENGTH);
  let code = FIRST_LETTERS[r[0] % FIRST_LETTERS.length];
  for (let i = 1; i < CODE_LENGTH; i++) code += CODE_ALPHABET[r[i] % CODE_ALPHABET.length];
  return code;
}

/**
 * Is it a code this app made (6 characters from CODE_ALPHABET, starting
 * with one of FIRST_LETTERS), written exactly so? Only those belong in the
 * shared registration sheet; anything else there is junk.
 */
export function isSharedCode(code) {
  const c = String(code ?? '');
  if (c.length !== CODE_LENGTH || !FIRST_LETTERS.includes(c[0])) return false;
  for (const ch of c.slice(1)) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/**
 * Letters and digits only, lower case (any script; ASCII punctuation goes),
 * with Arabic-Indic digits written as 0–9.
 */
const plainText = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s!-/:-@[-`{-~]/g, '');

/**
 * What anyone would try first: words about a masjid, and the most common
 * passwords and keyboard runs (they're removed before the rest is counted).
 */
const OBVIOUS_WORDS = [
  'masjid',
  'mosque',
  'islamic',
  'centre',
  'center',
  'jamia',
  'jame',
  'musalla',
  'bismillah',
  'allahuakbar',
  'allah',
  'islam',
  'muslim',
  'salam',
  'ramadan',
  'password',
  'passw0rd',
  'qwerty',
  'asdf',
  'zxcv',
  'iloveyou',
  'letmein',
  'welcome',
  'admin',
  'abc',
];

/**
 * Too easy to guess? The masjid's public key lets anyone try guesses on
 * their own computer, as many as they like. So after taking out the
 * masjid's name, city and code, the obvious words, and runs of four or more
 * digits (years, 123456…), at least 10 letters or digits must be left, with
 * at least 6 different characters in the whole passphrase.
 */
function isWeak(passphrase, avoid) {
  const plain = plainText(passphrase);
  if (new Set(plain).size < 6) return true;
  // Each name whole ("Al-Noor" → "alnoor") and word by word, longest first.
  const words = [];
  for (const s of avoid) {
    words.push(plainText(s));
    for (const part of String(s ?? '').split(/[\s,]+/)) words.push(plainText(part));
  }
  let rest = plain;
  for (const word of words.concat(OBVIOUS_WORDS).sort((a, b) => b.length - a.length)) {
    if (word.length >= 3) rest = rest.split(word).join('');
  }
  return rest.replace(/[0-9]{4,}/g, '').length < 10;
}

/**
 * 'short' | 'mismatch' | 'weak' | null. Without `confirm` (typing an
 * existing passphrase), only the length counts; with it (choosing a new
 * one), it mustn't be easy to guess either — `avoid`: the masjid's name,
 * city and code.
 */
export function passphraseProblem(passphrase, confirm, { avoid = [] } = {}) {
  if (String(passphrase ?? '').length < MIN_PASSPHRASE) return 'short';
  if (confirm === undefined) return null;
  if (passphrase !== confirm) return 'mismatch';
  if (isWeak(passphrase, avoid)) return 'weak';
  return null;
}

/**
 * The start of a publish key, in groups of four ("ed25519:AbCd EfGh IjKl
 * MnOp", 96 bits), for an admin to read out and the sheet's owner to compare
 * with the Publish key column before ticking Approved.
 */
export function keyFingerprint(key) {
  const k = String(key ?? '').trim();
  if (!KEY_RE.test(k)) return '';
  const body = k.slice('ed25519:'.length, 'ed25519:'.length + 16);
  return `ed25519:${body.match(/.{4}/g).join(' ')}`;
}

// ── The registration form ────────────────────────────────────────────────────

const PLACEHOLDERS = { NAME: 'name', CITY: 'city', CODE: 'code', SETTINGS: 'settings', KEY: 'key' };

/**
 * The form's pre-filled link (Google Forms → ⋮ → Get pre-filled link, made
 * with the answers NAME, CITY, CODE, SETTINGS and KEY) → where to send
 * answers and which field takes each one; null if it isn't such a link.
 * CODE, SETTINGS and KEY are required; NAME and CITY are optional.
 */
export function parseFormTemplate(template) {
  let url;
  try {
    url = new URL(String(template ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
  const m = url.pathname.match(/^(\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[\w-]+\/)viewform$/);
  if (!m) return null;
  const fields = {};
  for (const [param, value] of url.searchParams.entries()) {
    const key = PLACEHOLDERS[value.trim().toUpperCase()];
    if (key && /^entry\.\d+$/.test(param)) fields[key] = param;
  }
  if (!fields.code || !fields.settings || !fields.key) return null;
  return { action: `https://docs.google.com${m[1]}formResponse`, fields };
}

/** The answers to send, as a form body. */
export function formBody(form, values) {
  const body = new URLSearchParams();
  for (const [key, field] of Object.entries(form.fields)) body.set(field, values[key] ?? '');
  return body;
}

// ── The responses sheet ──────────────────────────────────────────────────────

/** The responses sheet's columns, found by their titles. */
const COLUMNS = {
  timestamp: /^timestamp/i,
  name: /^masjid name/i,
  city: /^city/i,
  code: /^masjid code/i,
  settings: /^settings$/i,
  key: /^publish key/i,
  approved: /^approved/i,
};

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function columnLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * The header row → each column's letter (null where it's missing), its
 * position (`at`, -1 where missing), and whether the sheet has what's
 * needed (Approved may be added later).
 */
export function sheetColumns(header) {
  const titles = (header || []).map((h) => String(h ?? '').trim());
  const cols = { at: {} };
  for (const [key, re] of Object.entries(COLUMNS)) {
    const i = titles.findIndex((t) => re.test(t));
    cols[key] = i >= 0 ? columnLetter(i) : null;
    cols.at[key] = i;
  }
  cols.ready = Boolean(cols.timestamp && cols.code && cols.settings && cols.key);
  return cols;
}

const quoted = (code) => `'${normalizeCode(code) || '-'}'`;

/** Every row's key and approval for one code, newest first. */
export function approvalsQuery(cols, code) {
  const select = cols.approved ? `${cols.key}, ${cols.approved}` : cols.key;
  return `select ${select} where ${cols.code} = ${quoted(code)} order by ${cols.timestamp} desc`;
}

/** The newest updates for one code sent with one key. */
export function updatesQuery(cols, code, key, limit = 10) {
  const k = KEY_RE.test(key) ? key : 'none';
  return (
    `select ${cols.settings} where ${cols.code} = ${quoted(code)} and ${cols.key} = '${k}' ` +
    `order by ${cols.timestamp} desc limit ${limit}`
  );
}

/** Is a code already used? */
export function codeTakenQuery(cols, code) {
  return `select ${cols.code} where ${cols.code} = ${quoted(code)} limit 1`;
}

/** Every row, oldest first (the deploy). */
export function allRowsQuery(cols) {
  return `select * order by ${cols.timestamp} asc`;
}

export const isApproved = (cell) => /^(true|yes|✓|x|1)$/i.test(String(cell ?? '').trim());

/**
 * From approvalsQuery's rows (header removed, newest first): the key on the
 * newest approved row, or null. Re-approving after a lost passphrase is
 * just ticking the newer row.
 */
export function approvedKey(rows) {
  for (const [key, approved] of rows || []) {
    const k = String(key ?? '').trim();
    if (isApproved(approved) && KEY_RE.test(k)) return k;
  }
  return null;
}

/**
 * `verify` for one row; a row it can't read counts as not verified, so one
 * bad row (anyone can send one) never stops the others being read.
 */
function verifyRow(verify, text, key, code) {
  try {
    return verify(String(text ?? ''), key, code);
  } catch {
    return null;
  }
}

/**
 * The newest update among `texts` (Settings cells) that `verify` accepts
 * for this code and key; null if none.
 * @param {(text, key, code) => ({ time, settings } | null)} verify
 */
export function newestUpdate(texts, key, code, verify) {
  let best = null;
  for (const text of texts || []) {
    const update = verifyRow(verify, text, key, code);
    if (update && (!best || update.time > best.time)) best = update;
  }
  return best;
}

/**
 * The deploy's view of the whole sheet (allRowsQuery's rows, header first):
 * each approved masjid with the name and city from its newest signed
 * settings (the form's answers if none can be read).
 * @returns {Array<{ code, name, city }>} in the order masjids registered
 */
export function sharedMasjids(rows, verify) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const cols = sheetColumns(rows[0]);
  if (!cols.ready) return [];
  const { at } = cols;
  const byCode = new Map();
  for (const row of rows.slice(1)) {
    // Only codes this app makes, written exactly so (as screens query them).
    const code = String(row[at.code] ?? '').trim();
    if (!isSharedCode(code)) continue;
    const m = byCode.get(code) || { code, name: '', city: '', key: null, texts: [] };
    m.texts.push(row[at.settings]);
    const key = String(row[at.key] ?? '').trim();
    if (at.approved >= 0 && isApproved(row[at.approved]) && KEY_RE.test(key)) {
      m.key = key; // oldest first: the last approved row wins
      m.name = String(row[at.name] ?? '').trim();
      m.city = String(row[at.city] ?? '').trim();
    }
    byCode.set(code, m);
  }
  const out = [];
  for (const m of byCode.values()) {
    if (!m.key) continue;
    const update = newestUpdate(m.texts, m.key, m.code, verify);
    if (!update) continue; // approved, but nothing a screen could apply
    out.push({
      code: m.code,
      name: String(update.settings.masjidName || '').trim() || m.name || m.code,
      city: cityFromLocName(update.settings.locName) || m.city,
    });
  }
  return out;
}

// ── Tidying the sheet ────────────────────────────────────────────────────────

/** A Timestamp cell (a Date in Apps Script, text in CSV) → ms, or null. */
function toTime(value) {
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(String(value ?? ''));
  return Number.isFinite(t) ? t : null;
}

/** Is row `a` newer than row `b`? By Timestamp, else by position. */
function newer(a, b) {
  if (a.ts != null && b.ts != null && a.ts !== b.ts) return a.ts > b.ts;
  return a.index > b.index;
}
const newestOf = (list) => list.reduce((best, e) => (!best || newer(e, best) ? e : best), null);
const latestSigned = (list) =>
  list
    .filter((e) => e.update)
    .reduce((best, e) => (!best || e.update.time > best.update.time ? e : best), null);

/** At most this many publish keys waiting to be approved are kept per masjid. */
export const MAX_WAITING_KEYS = 5;
/** Rows waiting for approval, and requests under a new key, go after this. */
export const WAITING_DAYS = 30;
/** At most this many of one masjid's rows are checked in one run. */
export const MAX_CHECKS_PER_MASJID = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The newest row of each key, for the newest `MAX_WAITING_KEYS` keys. */
function newestPerKey(list) {
  const byKey = new Map();
  for (const e of list) {
    const best = byKey.get(e.key);
    if (!best || e.update.time > best.update.time) byKey.set(e.key, e);
  }
  return [...byKey.values()].sort((a, b) => (newer(a, b) ? -1 : 1)).slice(0, MAX_WAITING_KEYS);
}

/**
 * Empty, apart from its Approved box and any other checkboxes (FALSE)? With
 * a column made checkboxes, every empty row below the responses holds one.
 */
const isEmptyRow = (row, approvedAt) =>
  !row.some((v, i) => i !== approvedAt && v !== false && String(v ?? '').trim() !== '');

/**
 * What the registration sheet's clean-up script (docs/registration-sheet.gs)
 * changes, so each masjid keeps one row:
 *
 *   - An approved masjid keeps its newest approved row, tick and all, with
 *     the newest settings signed with that row's key copied into it (the
 *     settings, name and city: never the Timestamp, so a key you tick later
 *     always outranks an older one). Its other unticked rows go. Requests
 *     under keys never approved that are newer than the approved row (a
 *     re-registration after a lost passphrase — or someone else's attempt)
 *     stay, the newest row of each of the newest few keys, until you tick or
 *     delete them, or for WAITING_DAYS.
 *   - A masjid waiting for approval keeps the newest row of each of its
 *     newest few keys, for WAITING_DAYS.
 *   - Rows that aren't validly signed for their code go, and so do rows
 *     whose code isn't one this app makes, written exactly so (test rows,
 *     junk, anything edited).
 *   - Ticks are yours: each key you ticked keeps one ticked row. Other
 *     ticked rows of the same key (copies) go, but only once that key has a
 *     row that verifies. A ticked row that doesn't verify (edited by hand,
 *     say) gets the newest settings signed with its key copied in if there
 *     are any, and is otherwise left as it is and counted in
 *     `summary.unverified`.
 *   - Empty rows stay (the next response may go there); a tick on one is
 *     cleared, and counted in `summary.cleared`.
 *
 * Screens read the result exactly as before: the newest approved row's key,
 * and the newest settings signed with it.
 *
 * Signatures are checked masjid by masjid, those with fewest rows first,
 * and at most MAX_CHECKS_PER_MASJID of one masjid's rows (the newest) per
 * run. With `budgetMs`, masjids not reached in time are left for the next
 * run. Either way `summary.partial` says so; what wasn't checked is left as
 * it is.
 *
 * With `only`, just that masjid's rows (and empty rows) are looked at (the
 * script does this after each form response); everything else is left as it
 * is. A code that isn't valid changes only empty rows.
 *
 * @param {Array<Array>} rows   the sheet's values, header row first
 * @param {Function}     verify verifyUpdate from lib/signatures.js
 * @param {{ only?: string, now?: number, budgetMs?: number, clock?: Function }} [options]
 * @returns {{ ok: boolean, reason?: string, updates: Array<{ row: number,
 *   cells: Array<[number, *]> }>, deletes: number[], summary: object }}
 *   rows and columns are 0-based positions in `rows`
 */
export function tidyPlan(
  rows,
  verify,
  { only, now = Date.now(), budgetMs = Infinity, clock = Date.now } = {}
) {
  const summary = {
    approved: 0,
    merged: 0,
    pending: 0,
    waiting: 0,
    removed: 0,
    unverified: 0,
    cleared: 0,
    expired: 0,
    partial: false,
  };
  const result = (extra) => ({ ok: true, updates: [], deletes: [], summary, ...extra });
  if (!Array.isArray(rows) || !rows.length) return result({ ok: false, reason: 'empty' });
  const cols = sheetColumns(rows[0]);
  if (!cols.ready) return result({ ok: false, reason: 'columns' });
  const { at } = cols;
  const cell = (row, k) => (at[k] >= 0 ? row[at[k]] : '');
  const target = only === undefined ? null : normalizeCode(only) || '';
  const fresh = (e) => e.ts == null || now - e.ts <= WAITING_DAYS * DAY_MS;

  const deletes = new Set();
  const updates = [];
  // First the cheap checks, row by row: empty rows, and rows that could
  // never verify. The rest are grouped by masjid for their signatures.
  const byCode = new Map();
  rows.forEach((row, index) => {
    if (index === 0) return;
    const approved = at.approved >= 0 && isApproved(cell(row, 'approved'));
    if (isEmptyRow(row, at.approved)) {
      if (approved) {
        updates.push({ row: index, cells: [[at.approved, false]] });
        summary.cleared++;
      }
      return;
    }
    const code = String(cell(row, 'code') ?? '').trim();
    if (target !== null && code !== target) return;
    const key = String(cell(row, 'key') ?? '').trim();
    if (!isSharedCode(code) || !KEY_RE.test(key)) {
      // Ticked, but there's nothing it could approve: left for you to see.
      if (approved) summary.unverified++;
      else deletes.add(index);
      return;
    }
    const entry = { index, row, code, key, approved, ts: toTime(cell(row, 'timestamp')) };
    byCode.set(code, [...(byCode.get(code) || []), entry]);
  });

  const started = clock();
  const groups = [...byCode.values()].sort((a, b) => a.length - b.length);
  for (const list of groups) {
    if (clock() - started > budgetMs) {
      summary.partial = true;
      break;
    }
    // Ticked rows always; then the newest of the rest, up to the limit.
    const others = list.filter((e) => !e.approved).sort((a, b) => (newer(a, b) ? -1 : 1));
    if (others.length > MAX_CHECKS_PER_MASJID) summary.partial = true;
    const checked = list.filter((e) => e.approved).concat(others.slice(0, MAX_CHECKS_PER_MASJID));
    const group = [];
    for (const e of checked) {
      const update = verifyRow(verify, cell(e.row, 'settings'), e.key, e.code);
      if (!update && !e.approved) deletes.add(e.index);
      else group.push({ ...e, update });
    }
    if (group.length) tidyMasjid(group);
  }

  /** One masjid's checked rows → updates and deletes. */
  function tidyMasjid(group) {
    const approved = group.filter((e) => e.approved);
    const kept = newestOf(approved);
    if (!kept) {
      const keep = newestPerKey(group.filter(fresh));
      summary.waiting += keep.length;
      for (const e of group) {
        if (keep.includes(e)) continue;
        if (!fresh(e)) summary.expired++;
        deletes.add(e.index);
      }
      return;
    }
    summary.approved++;
    const best = latestSigned(group.filter((e) => e.key === kept.key));
    if (best && best !== kept) {
      summary.merged++;
      const cells = [['settings'], ['name'], ['city']]
        .map(([k]) => [at[k], cell(best.row, k)])
        .filter(([col]) => col >= 0);
      updates.push({ row: kept.index, cells });
    }
    // One ticked row per key. Other ticked rows of a key are copies of the
    // same approval and go, but only once that key has a row that
    // verifies (for the approved key: the kept row, with the newest
    // settings in it), so the last copy of a tick is never removed.
    const keepTicked = new Set();
    const extraTicked = new Set();
    const tickedByKey = new Map();
    for (const e of approved) tickedByKey.set(e.key, [...(tickedByKey.get(e.key) || []), e]);
    for (const [key, ticked] of tickedByKey) {
      const valid =
        key === kept.key ? (best ? kept : null) : newestOf(ticked.filter((e) => e.update));
      keepTicked.add(key === kept.key ? kept : valid || newestOf(ticked));
      for (const e of ticked) if (!keepTicked.has(e) && valid) extraTicked.add(e);
      if (!valid) for (const e of ticked) if (!e.update) summary.unverified++;
    }
    const candidates = group.filter((e) => !tickedByKey.has(e.key) && newer(e, kept));
    const requests = newestPerKey(candidates.filter(fresh));
    summary.pending += requests.length;
    for (const e of group) {
      if (keepTicked.has(e) || requests.includes(e)) continue;
      if (!e.approved || extraTicked.has(e)) {
        if (candidates.includes(e) && !fresh(e)) summary.expired++;
        deletes.add(e.index);
      }
    }
  }

  summary.removed = deletes.size;
  return result({ updates, deletes: [...deletes].sort((a, b) => b - a) });
}

// ── Names ────────────────────────────────────────────────────────────────────

/** The masjid's own name and location from a settings sheet's rows. */
export function mosqueInfoFromRows(rows) {
  const info = {};
  for (const row of rows || []) {
    const key = String(row[0] ?? '').trim();
    if (key === 'masjidName' || key === 'locName') info[key] = String(row[1] ?? '').trim();
  }
  return info;
}

/** "Oakville, Ontario, Canada" → "Oakville, Ontario" (coordinates → ""). */
export function cityFromLocName(locName) {
  const text = String(locName || '').trim();
  if (!/[a-z]/i.test(text) || /°/.test(text)) return '';
  return text
    .split(',')
    .slice(0, 2)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

// ── The published list ───────────────────────────────────────────────────────

/**
 * The published masjids.json: your own entries first (masjids with their
 * own sheet get the name and city saved in it, `infoBySheet`), then the
 * approved self-serve masjids from the shared sheet, marked `shared`.
 * A code you list with its own sheet keeps it.
 *
 * @param {object} registry        public/masjids.json
 * @param {Array}  shared          from sharedMasjids
 * @param {Map}    infoBySheet     sheetId → { masjidName, locName }
 * @returns {{ registry: object, added: string[], skipped: string[] }}
 */
export function buildDirectory(registry, shared = [], infoBySheet = new Map()) {
  const out = {};
  const added = [];
  const skipped = [];
  for (const [code, entry] of Object.entries(registry || {})) {
    if (code.startsWith('_') || !entry || typeof entry !== 'object') {
      out[code] = entry;
      continue;
    }
    const next = { ...entry };
    const info = entry.sheetId ? infoBySheet.get(entry.sheetId) : null;
    if (info?.masjidName) next.name = info.masjidName;
    const city = cityFromLocName(info?.locName);
    if (city) next.city = city;
    out[code] = next;
  }
  for (const m of shared) {
    const own = out[m.code];
    if (own && (own.sheetId || own.csvUrl)) {
      skipped.push(`${m.code}: listed in masjids.json with its own sheet`);
      continue;
    }
    out[m.code] = { ...own, name: m.name, city: m.city, shared: true };
    added.push(m.code);
  }
  return { registry: out, added, skipped };
}

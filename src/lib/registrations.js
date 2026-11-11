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

/** 'short' | 'mismatch' | null. Without `confirm`, only the length counts. */
export function passphraseProblem(passphrase, confirm) {
  if (String(passphrase ?? '').length < MIN_PASSPHRASE) return 'short';
  if (confirm !== undefined && passphrase !== confirm) return 'mismatch';
  return null;
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
 * The newest update among `texts` (Settings cells) that `verify` accepts
 * for this code and key; null if none.
 * @param {(text, key, code) => ({ time, settings } | null)} verify
 */
export function newestUpdate(texts, key, code, verify) {
  let best = null;
  for (const text of texts || []) {
    const update = verify(String(text ?? ''), key, code);
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
    const code = normalizeCode(row[at.code]);
    if (!code) continue;
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
  list.reduce((best, e) => (!best || e.update.time > best.update.time ? e : best), null);

/**
 * What the registration sheet's clean-up script (docs/registration-sheet.gs)
 * changes, so each masjid keeps one row:
 *
 *   - An approved masjid keeps its newest approved row, tick and all, with
 *     the newest settings signed with that row's key copied into it; its
 *     other rows go. A newer request under a different key (a re-registration
 *     after a lost passphrase — or someone else's attempt) stays, the newest
 *     one only, until you tick or delete it.
 *   - A masjid waiting for approval keeps the newest row of each key.
 *   - Rows that aren't validly signed for their code (test rows, junk,
 *     anything edited) go.
 *
 * Screens read the result exactly as before: one approved row whose
 * settings are the newest valid ones.
 *
 * @param {Array<Array>} rows   the sheet's values, header row first
 * @param {Function}     verify verifyUpdate from lib/signatures.js
 * @returns {{ ok: boolean, reason?: string, updates: Array<{ row: number,
 *   cells: Array<[number, *]> }>, deletes: number[], summary: object }}
 *   rows and columns are 0-based positions in `rows`
 */
export function tidyPlan(rows, verify) {
  const summary = { approved: 0, merged: 0, pending: 0, waiting: 0, removed: 0 };
  const result = (extra) => ({ ok: true, updates: [], deletes: [], summary, ...extra });
  if (!Array.isArray(rows) || !rows.length) return result({ ok: false, reason: 'empty' });
  const cols = sheetColumns(rows[0]);
  if (!cols.ready) return result({ ok: false, reason: 'columns' });
  const { at } = cols;
  const cell = (row, k) => (at[k] >= 0 ? row[at[k]] : '');

  const deletes = new Set();
  const byCode = new Map();
  rows.forEach((row, index) => {
    if (index === 0 || !row.some((v) => String(v ?? '').trim() !== '')) return;
    const code = normalizeCode(cell(row, 'code'));
    const key = String(cell(row, 'key') ?? '').trim();
    const update =
      code && KEY_RE.test(key) ? verify(String(cell(row, 'settings') ?? ''), key, code) : null;
    if (!update) {
      deletes.add(index);
      return;
    }
    const entry = {
      index,
      row,
      code,
      key,
      update,
      ts: toTime(cell(row, 'timestamp')),
      approved: at.approved >= 0 && isApproved(cell(row, 'approved')),
    };
    byCode.set(code, [...(byCode.get(code) || []), entry]);
  });

  const updates = [];
  for (const group of byCode.values()) {
    const approved = group.filter((e) => e.approved);
    const kept = newestOf(approved);
    if (kept) {
      summary.approved++;
      const best = latestSigned(group.filter((e) => e.key === kept.key));
      if (best !== kept) {
        summary.merged++;
        const cells = [['timestamp'], ['settings'], ['name'], ['city']]
          .map(([k]) => [at[k], cell(best.row, k)])
          .filter(([col]) => col >= 0);
        updates.push({ row: kept.index, cells });
      }
      const everApproved = new Set(approved.map((e) => e.key));
      const request = newestOf(group.filter((e) => !everApproved.has(e.key) && newer(e, kept)));
      if (request) summary.pending++;
      for (const e of group) if (e !== kept && e !== request) deletes.add(e.index);
    } else {
      const byKey = new Map();
      for (const e of group) byKey.set(e.key, [...(byKey.get(e.key) || []), e]);
      for (const list of byKey.values()) {
        summary.waiting++;
        const keep = latestSigned(list);
        for (const e of list) if (e !== keep) deletes.add(e.index);
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

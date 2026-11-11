// ── lib/sheetFormat.js — masjid codes and reading CSV sheets ─────────────────
//
// Small, dependency-free helpers shared by the app (lib/remoteSettings.js,
// lib/registrations.js) and the Node build script (scripts/build-directory.mjs),
// which can't import modules that read Vite's import.meta.env.

/** "tor-4k7q " → "TOR4K7Q"; null if it isn't a usable code (4–16 letters/digits). */
export function normalizeCode(input) {
  const code = String(input ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

/** A Google Sheet's ID from the ID itself or a whole link to the sheet; '' otherwise. */
export function sheetIdFrom(text) {
  const s = String(text ?? '').trim();
  const fromLink = s.match(/\/spreadsheets\/d\/([\w-]{20,100})/);
  if (fromLink) return fromLink[1];
  return /^[\w-]{20,100}$/.test(s) ? s : '';
}

/** CSV of the sheet's first tab, readable cross-origin when the sheet is
 *  shared "anyone with the link can view". `headers=1` fixes the header to
 *  the first row: left to guess, Google can fold the first setting of an
 *  all-text sheet into the header and drop it. */
export function sheetCsvUrl(sheetId) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&headers=1`;
}

/** The same, answering a query in Google's query language, e.g.
 *  "select E where D = 'ABC234'" (columns by letter). */
export function sheetQueryUrl(sheetId, query) {
  return `${sheetCsvUrl(sheetId)}&tq=${encodeURIComponent(query)}`;
}

/**
 * What a sheet's reply is: 'csv'; 'signIn' (an HTML page: the sheet isn't
 * shared "Anyone with the link: Viewer"); or 'queryError' (Google answers
 * a query naming a missing column with JSON, still as HTTP 200).
 */
export function sheetReplyKind(text) {
  const head = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (head.startsWith('<')) return 'signIn';
  if (head.startsWith('{') && /"status"\s*:\s*"error"/.test(head)) return 'queryError';
  return 'csv';
}

/** Stable JSON (sorted keys): the same settings always give the same text. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** RFC 4180 CSV → rows of strings (quoted commas, quotes and newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvField(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

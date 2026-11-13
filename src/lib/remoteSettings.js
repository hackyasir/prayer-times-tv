// ── lib/remoteSettings.js — settings shared by every screen of a masjid ─────
//
// Each masjid has a short code (e.g. TOR4K7Q). A screen given that code —
// in its address (?masjid=TOR4K7Q) or in Settings → Masjid — follows that
// masjid's settings from one of two sources, chosen per deployment with
// the VITE_SETTINGS_SOURCE build variable (a GitHub repository variable;
// see docs/remote-settings.md):
//
//   sheet       A Google Sheet per masjid ("anyone with the link can
//               view"), listed in public/masjids.json. Screens read it
//               every few minutes.
//   cloudflare  A small Cloudflare Worker (worker/). Admins press Publish
//               in Settings; screens get the change pushed over a live
//               connection, and also re-check regularly.
//
// Offline stays as it is: a screen always runs on its own saved settings,
// and keeps the last good copy it downloaded. Nothing is applied unless it
// passes the same checks as an imported settings file.
//
// This module is pure (no React, no timers) so it can be tested directly;
// hooks/useRemoteSettings.js runs it.

import { normalizeImportedSettings, roundDeviceLocation } from './settingsImport.js';
import { csvField, normalizeCode, parseCsv, sheetCsvUrl, stableStringify } from './sheetFormat.js';
import { describeSetting } from './settingDescriptions.js';

export { normalizeCode, parseCsv, sheetCsvUrl, stableStringify };

export const SOURCES = ['none', 'sheet', 'cloudflare'];

/**
 * Settings that belong to one physical screen and are never replaced by
 * the masjid's shared settings.
 */
export const DEVICE_KEYS = ['screenLabel', 'viewingDistance', 'viewingCalibrated'];

/** Kept out of the sheet template: device settings and the logo (a Google
 *  Sheets cell holds at most 50,000 characters). */
const SHEET_EXCLUDED = new Set([...DEVICE_KEYS, 'logoDataUrl']);

export const CODE_STORAGE_KEY = 'masjid_code';
export const MODE_STORAGE_KEY = 'masjid_mode';
export const SYNC_STORAGE_KEY = 'masjid_sync_v1';

/**
 * What the masjid decides: its place, how its prayer times are worked out,
 * its iqamah, Jumu'ah and Eid, its name and logo, and its announcements.
 * On every screen following the masjid these always match the masjid's
 * copy and can't be changed on the screen (only an admin can, by
 * publishing). Everything else — language, theme, text size, beeps,
 * ticker style, blackout — is each screen's own.
 */
export const MASJID_KEYS = [
  'lat',
  'lng',
  'locName',
  'cityTz',
  'masjidName',
  'logoDataUrl',
  'method',
  'shadow',
  'highLatRule',
  'hijriOffset',
  'iqamah',
  'iqamahAutoCalc',
  'iqamahAutoBuffers',
  'iqamahRoundTo',
  'iqamahFajrBeforeSunrise',
  'iqamahRule',
  'jumuah',
  'eidFitr',
  'eidAdha',
  'eidDaysBefore',
  'eidLocation',
  'announcements',
];

/**
 * How a screen is used with its masjid (Settings → Share & follow):
 *   follow  (default) "My own screen" — at home, on a phone: the masjid's
 *           settings above, locked; everything else is the screen's own.
 *   masjid  "A screen in the masjid": mirrors all the masjid's settings
 *           (except the device's own label and calibration), and its
 *           Settings is behind the deployment's PIN.
 *   manage  "I manage this masjid": nothing is locked; the screen's own
 *           settings are the masjid's, and Apply also publishes them to
 *           every screen (with the masjid's publish passphrase, or a
 *           Cloudflare sign-in). It takes changes other admins publish.
 * The mode is a convenience, not security: any screen only reads public
 * settings; only the passphrase (or sign-in) can change them.
 */
export const MODES = ['follow', 'masjid', 'manage'];

/**
 * The masjid code and mode a screen starts with: from its address
 * (?masjid=CODE, &screen=masjid), else what it saved. A link can't re-point
 * a screen whose Settings is behind the PIN and that already shows a masjid
 * (a masjid screen, or one managing it): that takes the PIN, in Settings.
 */
export function placeFromAddress({ urlCode, urlMode, savedCode, savedMode, pinSet }) {
  const mode = MODES.includes(savedMode) ? savedMode : 'follow';
  if (!urlCode) return { code: savedCode || null, mode };
  if (pinSet && savedCode && mode !== 'follow' && urlCode !== savedCode) {
    return { code: savedCode, mode };
  }
  return { code: urlCode, mode: urlMode || mode };
}

/** "masjid" for a masjid-screen setup link (?masjid=CODE&screen=masjid). */
export function modeFromSearch(search) {
  try {
    return new URLSearchParams(search || '').get('screen') === 'masjid' ? 'masjid' : null;
  } catch {
    return null;
  }
}

/** Only the listed keys of an object. */
export function pickKeys(obj, keys) {
  const out = {};
  for (const key of keys) if (obj && key in obj) out[key] = obj[key];
  return out;
}

/** The part of a new copy of the masjid's settings a screen in this mode takes. */
export function sharedForMode(remote, mode) {
  return mode === 'follow' ? pickKeys(remote, MASJID_KEYS) : { ...remote };
}

/**
 * What an admin publishes from this screen: from a managing screen (or a
 * masjid screen), everything; from a follower's screen, only the masjid's
 * settings, on top of the masjid's current copy (`shared`) — not this
 * person's own display. Never the device's own settings, and the logo only
 * where it fits (`withLogo`; a Google Sheets cell is too small for it).
 */
export function publishPayload(settings, shared, mode, { withLogo = true } = {}) {
  const payload =
    mode === 'follow' ? { ...shared, ...pickKeys(settings, MASJID_KEYS) } : { ...settings };
  for (const key of DEVICE_KEYS) delete payload[key];
  if (!withLogo) delete payload.logoDataUrl;
  return payload;
}

/**
 * Does opening Settings need the PIN? Only when one is set, and never on a
 * follower's screen (their Settings holds only their own display choices).
 */
export function settingsNeedPin({ pinSet, code, mode }) {
  return Boolean(pinSet) && !(code && mode === 'follow');
}

// ── Directory ("Find your masjid") ───────────────────────────────────────────

/**
 * The masjids people can find and follow, from masjids.json:
 *   { "TOR4K7Q": { "name": "Masjid Al-Noor", "city": "Toronto", "sheetId": "…" } }
 * With the Google Sheet source an entry needs its own sheet or `"shared":
 * true` (a self-serve masjid in the registration sheet, added by the
 * deploy); with Cloudflare the name is enough. `"listed": false` keeps a
 * masjid out of the list (it can still be followed by its link).
 */
export function directoryEntries(registry, source) {
  if (!isPlainObject(registry)) return [];
  return Object.entries(registry)
    .filter(
      ([code, e]) => !code.startsWith('_') && normalizeCode(code) === code && isPlainObject(e)
    )
    .filter(([, e]) => e.listed !== false && typeof e.name === 'string' && e.name.trim())
    .filter(([code, e]) => source !== 'sheet' || e.shared === true || resolveSheet(registry, code))
    .map(([code, e]) => ({
      code,
      name: e.name.trim(),
      city: typeof e.city === 'string' ? e.city.trim() : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Entries whose name, city or code contain every word of the query. */
export function filterDirectory(entries, query) {
  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return entries;
  return entries.filter((e) => {
    const text = `${e.name} ${e.city} ${e.code}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** The link people use to follow a masjid (or set up a masjid screen). */
export function followLink(pageUrl, code, mode = 'follow') {
  try {
    const url = new URL(pageUrl);
    url.search = '';
    url.hash = '';
    url.searchParams.set('masjid', code);
    if (mode === 'masjid') url.searchParams.set('screen', 'masjid');
    return url.toString();
  } catch {
    return '';
  }
}

// ── Masjid codes ─────────────────────────────────────────────────────────────

/** The code in an address query string (?masjid=… or ?code=…), or null. */
export function codeFromSearch(search) {
  try {
    const params = new URLSearchParams(search || '');
    return normalizeCode(params.get('masjid') ?? params.get('code'));
  } catch {
    return null;
  }
}

// ── Applying shared settings ─────────────────────────────────────────────────

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Merge a masjid's shared settings over a screen's current ones.
 * Keys the shared copy doesn't mention keep the screen's values; device
 * keys always keep the screen's values; the result passes the same checks
 * as an imported file.
 *
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function mergeRemote(current, remote, defaults) {
  if (!isPlainObject(remote)) return { ok: false, error: 'invalid-shape' };
  const incoming = { ...remote };
  for (const key of DEVICE_KEYS) delete incoming[key];
  // A logo must be an image; anything else keeps the screen's own logo.
  if (
    'logoDataUrl' in incoming &&
    !/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(incoming.logoDataUrl || '')
  ) {
    if (incoming.logoDataUrl !== '') delete incoming.logoDataUrl;
  }
  const normalized = normalizeImportedSettings({ ...current, ...incoming }, defaults);
  if (!normalized.ok) return normalized;
  for (const key of DEVICE_KEYS) {
    if (key in current) normalized.value[key] = current[key];
  }
  return normalized;
}

/** Short fingerprint of a settings object (FNV-1a over stable JSON). */
export function contentVersion(settings) {
  const s = stableStringify(settings);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `h${(h >>> 0).toString(36)}`;
}

// ── Saved sync state ─────────────────────────────────────────────────────────

/** The last good shared copy for a code (survives restarts and offline). */
export function loadSyncState(storage, code) {
  try {
    const raw = storage?.getItem(SYNC_STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    return state && state.code === code ? state : null;
  } catch {
    return null;
  }
}

export function saveSyncState(storage, state) {
  try {
    // A location once taken from a device is kept only to about 1 km here
    // too (see lib/settingsImport.js).
    const saved = state?.settings
      ? { ...state, settings: roundDeviceLocation(state.settings) }
      : state;
    storage?.setItem(SYNC_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: the screen still runs; it just
    // re-downloads after a restart.
  }
}

// ── Google Sheet source ──────────────────────────────────────────────────────

/**
 * The sheet for a code from public/masjids.json:
 *   { "TOR4K7Q": { "sheetId": "1AbC…", "name": "…" } }
 * An entry may give "csvUrl" instead, for a CSV file hosted elsewhere.
 * Keys starting with "_" are notes and are ignored.
 */
export function resolveSheet(registry, code) {
  if (!isPlainObject(registry) || !code || code.startsWith('_')) return null;
  const entry = registry[code];
  if (!isPlainObject(entry)) return null;
  if (typeof entry.csvUrl === 'string' && /^https:\/\//.test(entry.csvUrl)) {
    return { csvUrl: entry.csvUrl, name: entry.name || '' };
  }
  if (typeof entry.sheetId === 'string' && /^[\w-]{20,100}$/.test(entry.sheetId)) {
    return { csvUrl: sheetCsvUrl(entry.sheetId), name: entry.name || '' };
  }
  return null;
}

/** Text in a cell → the type the setting's default has. */
function coerce(text, sample) {
  const t = String(text).trim();
  if (typeof sample === 'number') {
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof sample === 'boolean') {
    if (/^(true|yes|1|on)$/i.test(t)) return true;
    if (/^(false|no|0|off)$/i.test(t)) return false;
    return undefined;
  }
  if (sample !== null && typeof sample === 'object') {
    try {
      return JSON.parse(t);
    } catch {
      return undefined;
    }
  }
  return text; // strings keep their spacing and line breaks
}

/**
 * Rows of a settings sheet → a (partial) settings object.
 *
 * Column A is the setting, column B its value; a first row "key,value" and
 * rows starting with "#" are skipped, as are empty values (so a cell
 * Google Sheets blanked never wipes a setting). Nested settings use dots,
 * with list positions counted from 1:
 *   iqamah.fajr        20
 *   jumuah.1.time      13:00
 *   jumuah.1.enabled   TRUE
 * A whole list or group may also be given as JSON in one cell.
 *
 * @returns {{ settings: object, skipped: string[] }}  skipped = unknown keys
 *   or values that couldn't be read
 */
export function sheetRowsToSettings(rows, defaults) {
  const settings = {};
  const skipped = [];
  for (const row of rows || []) {
    const key = String(row[0] ?? '').trim();
    const value = row[1] ?? '';
    if (!key || key.startsWith('#') || /^key$/i.test(key)) continue;
    if (String(value).trim() === '') continue;
    const [top, ...rest] = key.split('.');
    // Device settings never come from the sheet (a logo may, though it
    // isn't in the template).
    if (!(top in defaults) || (SHEET_EXCLUDED.has(top) && top !== 'logoDataUrl')) {
      skipped.push(key);
      continue;
    }
    if (rest.length === 0) {
      const v = coerce(value, defaults[top]);
      if (v === undefined) skipped.push(key);
      else settings[top] = v;
      continue;
    }
    // Dotted path into a group or list: start from the defaults' shape.
    const base = settings[top] ?? structuredCopy(defaults[top]);
    let target = base;
    let sample = defaults[top];
    let ok = true;
    for (let i = 0; i < rest.length; i++) {
      // A path that runs past a plain value (iqamah.fajr.extra) is unreadable.
      if (target === null || typeof target !== 'object') {
        ok = false;
        break;
      }
      const seg = Array.isArray(target) ? Number(rest[i]) - 1 : rest[i];
      const last = i === rest.length - 1;
      if (Array.isArray(target) && !(Number.isInteger(seg) && seg >= 0 && seg < 12)) {
        ok = false;
        break;
      }
      const sampleNext = Array.isArray(sample) ? sample[0] : sample?.[seg];
      if (last) {
        const v = coerce(value, sampleNext ?? '');
        if (v === undefined) ok = false;
        else target[seg] = v;
      } else {
        if (target[seg] === undefined) {
          target[seg] = Array.isArray(sampleNext)
            ? []
            : { ...(isPlainObject(sampleNext) ? sampleNext : {}) };
        }
        target = target[seg];
        sample = sampleNext;
      }
    }
    if (ok) settings[top] = base;
    else skipped.push(key);
  }
  // A list given out of order (slot 3 without slot 2) gets default slots
  // in the gaps rather than holes.
  for (const [key, value] of Object.entries(settings)) {
    if (Array.isArray(value) && Array.isArray(defaults[key])) {
      settings[key] = Array.from(value, (item) => item ?? structuredCopy(defaults[key][0]));
    }
  }
  return { settings, skipped };
}

function structuredCopy(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/**
 * A screen's settings as a sheet to import into Google Sheets: key, value,
 * and a plain-English description of each row (the app reads only the
 * first two columns). Groups and lists are flattened with dots; device
 * settings and the logo are left out.
 */
export function settingsToSheetCsv(settings) {
  const lines = [['key', 'value', 'description']];
  const walk = (prefix, value) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(`${prefix}.${i + 1}`, item));
    } else if (isPlainObject(value)) {
      for (const [k, v] of Object.entries(value)) walk(`${prefix}.${k}`, v);
    } else {
      const text = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : value;
      lines.push([prefix, text, describeSetting(prefix)]);
    }
  };
  for (const [key, value] of Object.entries(settings || {})) {
    if (SHEET_EXCLUDED.has(key)) continue;
    walk(key, value);
  }
  return `${lines.map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}

// ── Cloudflare source ────────────────────────────────────────────────────────

const trimSlash = (url) => String(url || '').replace(/\/+$/, '');

export function cloudflareUrls(apiUrl, code) {
  const base = trimSlash(apiUrl);
  const path = `/m/${encodeURIComponent(code)}`;
  return {
    state: `${base}${path}`,
    live: `${base.replace(/^http/i, 'ws')}${path}/live`,
    publish: `${base}${path}/publish`,
    origin: (() => {
      try {
        return new URL(base).origin;
      } catch {
        return '';
      }
    })(),
  };
}

/** Wait before reconnecting the live connection: 5 s, 10 s, 20 s … 5 min. */
export function reconnectDelay(attempt) {
  return Math.min(300_000, 5_000 * 2 ** Math.max(0, attempt));
}

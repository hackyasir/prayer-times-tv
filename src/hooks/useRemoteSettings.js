// ── useRemoteSettings — follow a masjid's shared settings ────────────────────
//
// Runs the sync described in lib/remoteSettings.js:
//   - the masjid code comes from the address (?masjid=TOR4K7Q, saved on
//     first use) or from Settings → Masjid;
//   - the shared settings are read at start, every few minutes, and as soon
//     as the network comes back; with the Cloudflare source, a live
//     connection also delivers each Publish within seconds;
//   - the masjid's own settings (MASJID_KEYS: place, method, iqamah,
//     Jumu'ah, Eid, name, announcements) always match its copy — they are
//     re-applied on every check and when Settings closes, so they can't be
//     changed on the screen;
//   - a follower (mode "follow", the default) keeps every other setting as
//     its own; a masjid screen (mode "masjid") also takes the masjid's
//     display settings whenever the masjid publishes a new version;
//   - followers check every 30 minutes; masjid screens every few minutes,
//     plus the live connection (Cloudflare);
//   - nothing is applied while Settings is open — it waits until it closes;
//   - offline, the screen simply keeps running on its saved settings.
//
// With the Google Sheet source a masjid is either one you list with its own
// sheet in public/masjids.json, or a self-serve masjid in the shared
// registration sheet (lib/registrations.js): its screens apply only updates
// signed with the key you approved, and its admins register and publish
// from Settings with the masjid's publish passphrase.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULTS } from '../context/SettingsContext.jsx';
import {
  REGISTER_FORM_URL,
  REGISTRATIONS_SHEET_ID,
  SETTINGS_API_URL,
  SETTINGS_SOURCE,
} from '../lib/constants.js';
import {
  CODE_STORAGE_KEY,
  MASJID_KEYS,
  MODES,
  MODE_STORAGE_KEY,
  modeFromSearch,
  pickKeys,
  publishPayload,
  sharedForMode,
  cloudflareUrls,
  codeFromSearch,
  contentVersion,
  loadSyncState,
  mergeRemote,
  normalizeCode,
  parseCsv,
  reconnectDelay,
  resolveSheet,
  saveSyncState,
  sheetRowsToSettings,
  stableStringify,
} from '../lib/remoteSettings.js';
import {
  KEY_RE,
  MAX_UPDATE_LENGTH,
  approvalsQuery,
  approvedKey,
  cityFromLocName,
  codeTakenQuery,
  formBody,
  newMasjidCode,
  newestUpdate,
  parseFormTemplate,
  passphraseProblem,
  sheetColumns,
  updatesQuery,
} from '../lib/registrations.js';
import { sheetQueryUrl, sheetReplyKind } from '../lib/sheetFormat.js';

const CHECK_EVERY_MS = { sheet: 3 * 60_000, cloudflare: 15 * 60_000 };
// Followers' iqamah times change rarely; checking less often keeps a whole
// community of followers inside the free tiers.
const FOLLOWER_CHECK_MS = 30 * 60_000;
// Keep-alive: often enough for networks that drop quiet connections
// (Cloudflare closes connections idle for about 100 s), rarely enough to
// stay well inside the free plan (incoming messages count 20 to a request).
const PING_EVERY_MS = 50_000;
const LIVE_TIMEOUT_MS = 130_000; // no reply for this long → reconnect
const PUBLISH_TIMEOUT_MS = 15 * 60_000;
// After sending a signed update to the form: look for it in the sheet after
// these waits (about a minute in all).
const CONFIRM_WAITS_MS = [3000, 3000, 4000, 5000, 5000, 10_000, 10_000, 15_000];

class SyncError extends Error {
  constructor(phase, via) {
    super(phase);
    // notFound | notShared | invalid | offline | error, and for the shared
    // sheet: notApproved | noValid | setup
    this.phase = phase;
    this.via = via;
  }
}

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The masjid's key from its passphrase, or null if this browser can't work
 * it out (it needs WebAssembly, which the page's policy must allow).
 */
async function passphraseKey(passphrase, code, kdf) {
  try {
    const { derivePublishKey } = await import('../lib/passphraseKey.js');
    return await derivePublishKey(passphrase, code, kdf);
  } catch {
    return null;
  }
}

/** Why the registration sheet couldn't be used, for the admin's message. */
const sendProblem = (err) =>
  err?.phase === 'offline'
    ? 'offline'
    : err?.phase === 'setup' || err?.phase === 'notShared'
      ? 'setup'
      : 'error';

function initialCode(storage) {
  const fromUrl = typeof window !== 'undefined' ? codeFromSearch(window.location.search) : null;
  if (fromUrl) {
    try {
      storage?.setItem(CODE_STORAGE_KEY, fromUrl);
    } catch {
      // not saved; the address still carries it
    }
    return fromUrl;
  }
  try {
    return normalizeCode(storage?.getItem(CODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function initialMode(storage) {
  const fromUrl = typeof window !== 'undefined' ? modeFromSearch(window.location.search) : null;
  try {
    if (fromUrl) storage?.setItem(MODE_STORAGE_KEY, fromUrl);
    const saved = fromUrl || storage?.getItem(MODE_STORAGE_KEY);
    return MODES.includes(saved) ? saved : 'follow';
  } catch {
    return fromUrl || 'follow';
  }
}

/** Rows (header first) answering a query on a Google Sheet. */
async function querySheet(sheetId, query, signal) {
  let res;
  try {
    res = await fetch(sheetQueryUrl(sheetId, query), { cache: 'no-store', signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // A sheet that isn't shared answers with a sign-in redirect, which the
    // browser refuses to read.
    throw new SyncError(navigator.onLine === false ? 'offline' : 'notShared', 'shared');
  }
  if (!res.ok) throw new SyncError(res.status === 404 ? 'notShared' : 'error', 'shared');
  const text = await res.text();
  const kind = sheetReplyKind(text);
  if (kind === 'signIn') throw new SyncError('notShared', 'shared');
  if (kind === 'queryError') throw new SyncError('setup', 'shared');
  return parseCsv(text);
}

/**
 * @param {object} p
 * @param {object}   p.applied        current settings
 * @param {Function} p.updateApplied  saves new settings
 * @param {boolean}  p.paused         Settings (or the PIN prompt) is open
 */
export default function useRemoteSettings({
  applied,
  updateApplied,
  paused,
  source = SETTINGS_SOURCE,
  apiUrl = SETTINGS_API_URL,
  baseUrl = import.meta.env.BASE_URL || '/',
  sharedSheetId = REGISTRATIONS_SHEET_ID,
  formUrl = REGISTER_FORM_URL,
  // For tests: a cheaper passphrase key, and shorter waits.
  kdf = undefined,
  confirmWaits = CONFIRM_WAITS_MS,
}) {
  const enabled = source === 'sheet' || (source === 'cloudflare' && Boolean(apiUrl));
  const sharedSheet = source === 'sheet' ? sharedSheetId : '';
  const parsedForm = useMemo(() => parseFormTemplate(formUrl), [formUrl]);
  const form = sharedSheet ? parsedForm : null;
  const canRegister = Boolean(sharedSheet && form);
  // Why Register your masjid is off (Settings explains it in development).
  const registerProblems =
    source === 'sheet' ? [!sharedSheet && 'sheetId', !parsedForm && 'formUrl'].filter(Boolean) : [];

  const [storage] = useState(safeStorage);
  const [code, setCodeState] = useState(() => (enabled ? initialCode(storage) : null));
  const [mode, setModeState] = useState(() => initialMode(storage));
  const [status, setStatus] = useState(() => {
    const cached = code ? loadSyncState(storage, code) : null;
    return {
      phase: code ? 'checking' : 'off',
      lastSync: cached?.checkedAt ?? null,
      live: false,
      skipped: 0,
      name: cached?.name || '',
      via: cached?.via || null,
    };
  });

  // Latest values for callbacks run by timers and sockets.
  const appliedRef = useRef(applied);
  const pausedRef = useRef(paused);
  const pendingRef = useRef(null);
  const publishingRef = useRef(false);
  const checkRef = useRef(() => {});
  // Shared sheet: its column letters, the masjid's approved key, and the
  // admin's signing key once the passphrase is typed (memory only).
  const columnsRef = useRef(null);
  const approvedKeyRef = useRef(null);
  const keyRef = useRef(null);
  const [unlockedCode, setUnlockedCode] = useState(null);
  useEffect(() => {
    appliedRef.current = applied;
    pausedRef.current = paused;
  }, [applied, paused]);

  // A different masjid: forget the last one's key, and what was known
  // about it (name, own sheet or self-serve) until its first check.
  const codeSeen = useRef(false);
  useEffect(() => {
    approvedKeyRef.current = null;
    if (keyRef.current && keyRef.current.code !== code) {
      keyRef.current = null;
      setUnlockedCode(null);
    }
    if (!codeSeen.current) {
      codeSeen.current = true; // the first render already read the saved copy
      return;
    }
    const cached = code ? loadSyncState(storage, code) : null;
    setStatus((s) => ({
      ...s,
      lastSync: cached?.checkedAt ?? null,
      skipped: 0,
      name: cached?.name || '',
      via: cached?.via || null,
    }));
  }, [code, storage]);

  // ── Shared registration sheet ──
  const sharedColumns = useCallback(
    async (signal) => {
      // Re-read the titles until there's an Approved column (added later).
      if (columnsRef.current?.approved) return columnsRef.current;
      const rows = await querySheet(sharedSheet, 'select * limit 0', signal);
      const cols = sheetColumns(rows[0]);
      if (!cols.ready) throw new SyncError('setup', 'shared');
      columnsRef.current = cols;
      return cols;
    },
    [sharedSheet]
  );

  /**
   * The code's keys in the sheet: the one you approved (null while it waits
   * for approval) and every key it was registered with (throws notFound).
   */
  const sharedKeys = useCallback(
    async (forCode, signal) => {
      const cols = await sharedColumns(signal);
      const rows = (await querySheet(sharedSheet, approvalsQuery(cols, forCode), signal)).slice(1);
      if (!rows.length) throw new SyncError('notFound', 'shared');
      const keys = new Set(
        rows.map((r) => String(r[0] ?? '').trim()).filter((k) => KEY_RE.test(k))
      );
      return { approved: approvedKey(rows), keys };
    },
    [sharedSheet, sharedColumns]
  );

  /** The key you approved for this code (throws notFound / notApproved). */
  const sharedApprovedKey = useCallback(
    async (forCode, signal) => {
      const { approved } = await sharedKeys(forCode, signal);
      if (!approved) throw new SyncError('notApproved', 'shared');
      return approved;
    },
    [sharedKeys]
  );

  /** The newest update signed with the approved key (throws noValid). */
  const sharedNewest = useCallback(
    async (forCode, key, signal) => {
      const cols = await sharedColumns(signal);
      const rows = await querySheet(sharedSheet, updatesQuery(cols, forCode, key), signal);
      const { verifyUpdate } = await import('../lib/signatures.js');
      const update = newestUpdate(
        rows.slice(1).map((r) => r[0]),
        key,
        forCode,
        verifyUpdate
      );
      if (!update) throw new SyncError('noValid', 'shared');
      return update;
    },
    [sharedSheet, sharedColumns]
  );

  // Apply one copy of the masjid's settings (or hold it while Settings is
  // open). A new version applies in full for this screen's mode; an
  // unchanged one still puts the masjid's own settings back if the screen
  // has drifted from them — except on a managing screen, where nothing is
  // locked (it takes only new versions, published by another admin).
  // `extra.fromCache` = re-applying the saved copy, not a fresh download.
  const receive = useCallback(
    (remote, version, extra = {}) => {
      const now = Date.now();
      const cached = loadSyncState(storage, code);
      const isNew = !cached || cached.version !== version;
      if (pausedRef.current) {
        if (isNew) {
          pendingRef.current = { remote, version, extra };
          setStatus((s) => ({ ...s, phase: 'pending', via: extra.via || s.via }));
        }
        return;
      }
      const incoming = isNew
        ? sharedForMode(remote, mode)
        : mode === 'manage'
          ? {}
          : pickKeys(remote, MASJID_KEYS);
      const merged = mergeRemote(appliedRef.current, incoming, DEFAULTS);
      if (!merged.ok) {
        setStatus((s) => ({ ...s, phase: 'invalid' }));
        return;
      }
      if (stableStringify(merged.value) !== stableStringify(appliedRef.current)) {
        updateApplied(merged.value);
      }
      if (extra.fromCache) return;
      saveSyncState(storage, {
        code,
        source,
        version,
        settings: remote,
        appliedAt: isNew ? now : (cached?.appliedAt ?? now),
        checkedAt: now,
        csvUrl: extra.csvUrl ?? cached?.csvUrl,
        name: extra.name || cached?.name || '',
        via: extra.via || cached?.via || null,
        signedAt: extra.signedAt ?? cached?.signedAt,
        signedKey: extra.signedKey ?? cached?.signedKey,
      });
      setStatus((s) => ({
        ...s,
        phase: 'ok',
        lastSync: now,
        skipped: extra.skipped ?? s.skipped,
        name: extra.name || s.name,
        via: extra.via || s.via,
      }));
    },
    [code, mode, source, storage, updateApplied]
  );

  // When Settings closes: apply a copy that arrived meanwhile, or put the
  // masjid's own settings back (unless an admin is publishing a change).
  // Also once at start, so a restart offline still enforces them.
  useEffect(() => {
    if (paused || !enabled || !code) return;
    if (pendingRef.current) {
      const { remote, version, extra } = pendingRef.current;
      pendingRef.current = null;
      receive(remote, version, extra);
      return;
    }
    if (publishingRef.current) return;
    const cached = loadSyncState(storage, code);
    if (cached?.settings) receive(cached.settings, cached.version, { fromCache: true });
  }, [paused, enabled, code, storage, receive]);

  // ── Reading the shared settings ──
  useEffect(() => {
    if (!enabled || !code) {
      setStatus((s) => ({ ...s, phase: 'off', live: false }));
      return undefined;
    }
    setStatus((s) => ({ ...s, phase: 'checking' }));
    let stopped = false;
    let inFlight = false;
    // AbortController is Chromium 66+; older TVs just let a request finish.
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const signal = controller?.signal;

    async function readShared(name) {
      let key;
      try {
        key = await sharedApprovedKey(code, signal);
      } catch (err) {
        if (err?.phase === 'notApproved' || err?.phase === 'notFound')
          approvedKeyRef.current = null;
        throw err;
      }
      approvedKeyRef.current = key;
      const update = await sharedNewest(code, key, signal);
      // Never go back: an older signed update (say, old rows sent to the
      // form again) doesn't replace a newer one this screen already has
      // from the same key.
      const cached = loadSyncState(storage, code);
      if (cached?.settings && cached.signedKey === key && update.time < (cached.signedAt || 0)) {
        return {
          settings: cached.settings,
          version: cached.version ?? `s${cached.signedAt}`,
          extra: { name: cached.name || name, via: 'shared' },
        };
      }
      return {
        settings: update.settings,
        version: `s${update.time}`,
        extra: {
          name: update.settings.masjidName || name,
          via: 'shared',
          signedAt: update.time,
          signedKey: key,
        },
      };
    }

    async function readSheet() {
      const cached = loadSyncState(storage, code);
      let csvUrl = cached?.csvUrl;
      let name = cached?.name || '';
      let listKnown = false;
      try {
        const res = await fetch(`${baseUrl}masjids.json`, { cache: 'no-store', signal });
        if (res.ok) {
          listKnown = true;
          const sheet = resolveSheet(await res.json(), code);
          csvUrl = sheet?.csvUrl;
          if (sheet?.name) name = sheet.name;
        }
      } catch {
        // Offline or list unavailable: use the sheet address saved last time.
      }
      if (!csvUrl) {
        // Not a masjid with its own sheet: a self-serve masjid, if any.
        if (sharedSheet) return readShared(name);
        throw new SyncError(listKnown ? 'notFound' : 'offline');
      }
      let text;
      try {
        const res = await fetch(csvUrl, { cache: 'no-store', signal });
        if (!res.ok) throw new SyncError(res.status === 404 ? 'notShared' : 'error');
        text = await res.text();
      } catch (err) {
        if (err instanceof SyncError) throw err;
        throw new SyncError(navigator.onLine === false ? 'offline' : 'notShared');
      }
      if (/^\s*</.test(text)) throw new SyncError('notShared'); // a sign-in page, not CSV
      const { settings, skipped } = sheetRowsToSettings(parseCsv(text), DEFAULTS);
      if (!Object.keys(settings).length) throw new SyncError('invalid');
      return {
        settings,
        version: contentVersion(settings),
        // The masjid's own saved name, not just how it's listed.
        extra: { csvUrl, name: settings.masjidName || name, skipped: skipped.length, via: 'sheet' },
      };
    }

    async function readCloudflare() {
      const { state } = cloudflareUrls(apiUrl, code);
      let res;
      try {
        res = await fetch(state, { cache: 'no-store', signal });
      } catch {
        throw new SyncError('offline');
      }
      if (res.status === 404) throw new SyncError('notFound');
      if (!res.ok) throw new SyncError('error');
      const body = await res.json().catch(() => null);
      if (!body || typeof body.settings !== 'object') throw new SyncError('invalid');
      return {
        settings: body.settings,
        version: String(body.version),
        extra: { name: body.settings.masjidName || '' },
      };
    }

    async function check() {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const got = source === 'sheet' ? await readSheet() : await readCloudflare();
        if (!stopped) receive(got.settings, got.version, got.extra);
      } catch (err) {
        if (!stopped && err?.name !== 'AbortError') {
          const phase = err instanceof SyncError ? err.phase : 'error';
          setStatus((s) => ({ ...s, phase, via: err?.via || s.via }));
        }
      } finally {
        inFlight = false;
      }
    }
    checkRef.current = check;

    check();
    const every =
      mode === 'follow' ? FOLLOWER_CHECK_MS : CHECK_EVERY_MS[source] || CHECK_EVERY_MS.sheet;
    const timer = setInterval(check, every);
    const onOnline = () => check();
    window.addEventListener('online', onOnline);

    // Live connection (Cloudflare, masjid screens): each Publish arrives
    // within seconds. Followers rely on their regular check instead.
    let ws = null;
    let attempt = 0;
    let pingTimer = null;
    let retryTimer = null;
    let lastHeard = Date.now();
    function connect() {
      if (
        stopped ||
        source !== 'cloudflare' ||
        mode !== 'masjid' ||
        typeof WebSocket !== 'function'
      ) {
        return;
      }
      try {
        ws = new WebSocket(cloudflareUrls(apiUrl, code).live);
      } catch {
        retryTimer = setTimeout(connect, reconnectDelay(attempt++));
        return;
      }
      ws.onopen = () => {
        attempt = 0;
        lastHeard = Date.now();
        setStatus((s) => ({ ...s, live: true }));
        pingTimer = setInterval(() => {
          if (Date.now() - lastHeard > LIVE_TIMEOUT_MS) {
            ws.close();
            return;
          }
          try {
            ws.send('ping');
          } catch {
            // closing; onclose reconnects
          }
        }, PING_EVERY_MS);
      };
      ws.onmessage = (event) => {
        lastHeard = Date.now();
        if (event.data === 'pong') return;
        try {
          const msg = JSON.parse(event.data);
          if (msg && typeof msg.settings === 'object' && msg.version != null) {
            receive(msg.settings, String(msg.version), { name: msg.settings.masjidName || '' });
          }
        } catch {
          // not a settings message
        }
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        setStatus((s) => ({ ...s, live: false }));
        if (!stopped) retryTimer = setTimeout(connect, reconnectDelay(attempt++));
      };
    }
    connect();

    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
      controller?.abort();
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // already closed
        }
      }
    };
  }, [
    enabled,
    code,
    mode,
    source,
    apiUrl,
    baseUrl,
    storage,
    receive,
    sharedSheet,
    sharedApprovedKey,
    sharedNewest,
  ]);

  /** Follow a masjid code (or null to stop following). @returns the saved code */
  const setCode = useCallback(
    (input) => {
      const next = input == null || input === '' ? null : normalizeCode(input);
      if (input && !next) return false;
      try {
        if (next) storage?.setItem(CODE_STORAGE_KEY, next);
        else storage?.removeItem(CODE_STORAGE_KEY);
      } catch {
        // not saved; works until the next restart
      }
      setCodeState(next);
      return true;
    },
    [storage]
  );

  /** "follow" or "masjid" (see MODES in lib/remoteSettings.js). */
  const setMode = useCallback(
    (next) => {
      if (!MODES.includes(next)) return;
      try {
        storage?.setItem(MODE_STORAGE_KEY, next);
      } catch {
        // not saved; works until the next restart
      }
      // Forget which version was applied, so the next check applies the
      // masjid's copy in full for the new mode.
      const cached = code ? loadSyncState(storage, code) : null;
      if (cached) saveSyncState(storage, { ...cached, version: null });
      setModeState(next);
    },
    [storage, code]
  );

  const checkNow = useCallback(() => checkRef.current(), []);

  // ── Self-serve masjids: register, unlock, publish ──

  /**
   * Sign settings with a masjid's key, send them to the registration form
   * (no sign-in; the browser can't see Google's reply), and look for them
   * in the sheet to be sure they arrived.
   * @returns {Promise<{ ok: true, time } | { ok: false, reason }>}
   */
  const sendSigned = useCallback(
    async ({ forCode, pair, settings }) => {
      let cols;
      try {
        cols = await sharedColumns();
      } catch (err) {
        return { ok: false, reason: sendProblem(err) };
      }
      const { signUpdate, updateSignature } = await import('../lib/signatures.js');
      // Newer than anything already sent, even from a device whose clock is
      // behind.
      const time = Math.max(Date.now(), (loadSyncState(storage, forCode)?.signedAt || 0) + 1);
      const text = signUpdate({ code: forCode, time, settings }, pair.secretKey);
      if (text.length > MAX_UPDATE_LENGTH) return { ok: false, reason: 'tooBig' };
      const body = formBody(form, {
        name: settings.masjidName || '',
        city: cityFromLocName(settings.locName) || settings.locName || '',
        code: forCode,
        settings: text,
        key: pair.publicKey,
      });
      try {
        await fetch(form.action, { method: 'POST', mode: 'no-cors', body });
      } catch {
        if (navigator.onLine === false) return { ok: false, reason: 'offline' };
        // Otherwise it may still have arrived: look for it.
      }
      const sig = updateSignature(text);
      for (const wait of confirmWaits) {
        await sleep(wait);
        try {
          const query = updatesQuery(cols, forCode, pair.publicKey, 5);
          const rows = (await querySheet(sharedSheet, query)).slice(1);
          if (rows.some((r) => String(r[0] ?? '').includes(sig))) return { ok: true, time };
        } catch {
          // try again after the next wait
        }
      }
      return { ok: false, reason: 'notConfirmed' };
    },
    [form, sharedSheet, sharedColumns, storage, confirmWaits]
  );

  /**
   * Register this screen's settings as a new self-serve masjid (or, with
   * `again`, the masjid it follows, under a new passphrase). On success
   * the screen manages the new code (its key kept in memory until Settings
   * closes); other screens can follow it once you approve it.
   * @returns {Promise<{ ok: true, code } | { ok: false, reason }>}
   *   reason: short | offline | setup | keyFailed | tooBig | notConfirmed | error
   */
  const register = useCallback(
    async ({ passphrase, settings, again = false }) => {
      if (!canRegister || (again && !code)) return { ok: false, reason: 'error' };
      const problem = passphraseProblem(passphrase);
      if (problem) return { ok: false, reason: problem };
      let next = again ? code : null;
      if (!next) {
        try {
          const cols = await sharedColumns();
          let listed = {};
          try {
            const res = await fetch(`${baseUrl}masjids.json`, { cache: 'no-store' });
            if (res.ok) listed = (await res.json()) || {};
          } catch {
            // the sheet check below still applies
          }
          for (let i = 0; i < 5 && !next; i++) {
            const candidate = newMasjidCode();
            if (candidate in listed) continue;
            const taken = await querySheet(sharedSheet, codeTakenQuery(cols, candidate));
            if (taken.length < 2) next = candidate;
          }
        } catch (err) {
          return { ok: false, reason: sendProblem(err) };
        }
        if (!next) return { ok: false, reason: 'error' };
      }
      const pair = await passphraseKey(passphrase, next, kdf);
      if (!pair) return { ok: false, reason: 'keyFailed' };
      const shared = again ? loadSyncState(storage, next)?.settings || {} : {};
      const payload = publishPayload(settings, shared, again ? mode : 'manage', {
        withLogo: false,
      });
      const sent = await sendSigned({ forCode: next, pair, settings: payload });
      if (!sent.ok) return sent;
      if (again) {
        // The new key counts once you approve its row; until then the old
        // one still does, so nothing is unlocked.
        checkRef.current();
        return { ok: true, code: next };
      }
      // This screen's settings are what it just sent: keep them as the
      // masjid's copy, and keep the key for this Settings visit.
      const now = Date.now();
      saveSyncState(storage, {
        code: next,
        source,
        version: `s${sent.time}`,
        settings: payload,
        appliedAt: now,
        checkedAt: now,
        name: payload.masjidName || '',
        via: 'shared',
        signedAt: sent.time,
        signedKey: pair.publicKey,
      });
      keyRef.current = { code: next, ...pair };
      setUnlockedCode(next);
      setMode('manage');
      setCode(next);
      return { ok: true, code: next };
    },
    [
      canRegister,
      code,
      mode,
      source,
      kdf,
      baseUrl,
      sharedSheet,
      sharedColumns,
      sendSigned,
      setCode,
      setMode,
      storage,
    ]
  );

  /**
   * An admin types the masjid's publish passphrase (for the code this screen
   * follows, or `forCode` — managing a masjid from another device): keep the
   * masjid's key in memory, until Settings closes, if it's the one you
   * approved — or, while the masjid waits for approval, the one it
   * registered with (what it publishes then counts once approved).
   * @returns {Promise<{ ok: boolean, reason? }>}
   *   reason: wrong | unknownCode | offline | setup | keyFailed | error
   */
  const unlock = useCallback(
    async (passphrase, forCode = code) => {
      const target = normalizeCode(forCode);
      if (!sharedSheet || !target) return { ok: false, reason: 'error' };
      if (passphraseProblem(passphrase)) return { ok: false, reason: 'wrong' };
      let keys;
      try {
        keys = await sharedKeys(target);
      } catch (err) {
        const reason = err?.phase === 'notFound' ? 'unknownCode' : sendProblem(err);
        return { ok: false, reason };
      }
      const pair = await passphraseKey(passphrase, target, kdf);
      if (!pair) return { ok: false, reason: 'keyFailed' };
      const ok = keys.approved ? pair.publicKey === keys.approved : keys.keys.has(pair.publicKey);
      if (!ok) return { ok: false, reason: 'wrong' };
      if (target === code) approvedKeyRef.current = keys.approved;
      keyRef.current = { code: target, ...pair };
      setUnlockedCode(target);
      return { ok: true };
    },
    [sharedSheet, code, kdf, sharedKeys]
  );

  /** Forget the admin's key. */
  const lock = useCallback(() => {
    keyRef.current = null;
    setUnlockedCode(null);
  }, []);

  // The key is kept only while Settings is open.
  useEffect(() => {
    if (!paused) lock();
  }, [paused, lock]);

  /**
   * Send these settings to every screen of the masjid.
   *   Cloudflare: opens the Worker's publish page (where the admin signs
   *   in) and hands it the settings. Must be called from a click, or the
   *   browser blocks the window.
   *   Shared sheet: signs them with the key unlock() checked and sends
   *   them to the registration form.
   * Resolves with { ok, version } or { ok: false, reason? }.
   */
  const publish = useCallback(
    async (settings) => {
      if (!code) return { ok: false };
      const shared = loadSyncState(storage, code)?.settings || {};

      if (source === 'sheet') {
        const pair = keyRef.current;
        if (!sharedSheet || !form || !pair || pair.code !== code) {
          return { ok: false, reason: 'locked' };
        }
        const payload = publishPayload(settings, shared, mode, { withLogo: false });
        publishingRef.current = true;
        try {
          const sent = await sendSigned({ forCode: code, pair, settings: payload });
          if (!sent.ok) return sent;
          // This screen already has these settings: keep them as the
          // masjid's current copy, so closing Settings doesn't undo them.
          const now = Date.now();
          const cached = loadSyncState(storage, code);
          saveSyncState(storage, {
            ...cached,
            code,
            source,
            version: `s${sent.time}`,
            settings: payload,
            appliedAt: now,
            checkedAt: now,
            name: payload.masjidName || cached?.name || '',
            via: 'shared',
            signedAt: sent.time,
            signedKey: pair.publicKey,
          });
          setStatus((s) => ({
            ...s,
            phase: 'ok',
            lastSync: now,
            name: payload.masjidName || s.name,
          }));
          return { ok: true, version: sent.time };
        } finally {
          publishingRef.current = false;
        }
      }

      if (source !== 'cloudflare' || !apiUrl) return { ok: false };
      const urls = cloudflareUrls(apiUrl, code);
      const payload = publishPayload(settings, shared, mode);
      const win = window.open(urls.publish, 'masjid-publish');
      if (!win) return { ok: false, blocked: true };
      publishingRef.current = true;
      return new Promise((resolve) => {
        const done = (result) => {
          window.removeEventListener('message', onMessage);
          clearTimeout(timeout);
          publishingRef.current = false;
          resolve(result);
        };
        const onMessage = (event) => {
          if (event.origin !== urls.origin || !event.data || typeof event.data !== 'object') return;
          if (event.data.type === 'ready') {
            event.source?.postMessage({ type: 'settings', code, settings: payload }, urls.origin);
          } else if (event.data.type === 'published') {
            done({ ok: true, version: event.data.version });
            checkRef.current();
          } else if (event.data.type === 'cancelled') {
            done({ ok: false });
          }
        };
        const timeout = setTimeout(() => done({ ok: false }), PUBLISH_TIMEOUT_MS);
        window.addEventListener('message', onMessage);
      });
    },
    [source, apiUrl, code, mode, storage, sharedSheet, form, sendSigned]
  );

  /** This screen manages `forCode` (Cloudflare, or once unlock() accepted
   *  its passphrase): nothing locked, and Apply publishes. */
  const manage = useCallback(
    (forCode = code) => {
      const next = normalizeCode(forCode);
      if (!next) return false;
      setMode('manage');
      if (next !== code) setCode(next);
      return true;
    },
    [code, setCode, setMode]
  );

  // The masjid's settings are locked on this screen while it follows a code
  // (not while it manages it).
  const locked = enabled && Boolean(code) && mode !== 'manage';

  return {
    enabled,
    source,
    code,
    setCode,
    mode,
    setMode,
    locked,
    status,
    checkNow,
    publish,
    // Self-serve masjids (shared registration sheet)
    canRegister,
    registerProblems,
    register,
    unlock,
    lock,
    manage,
    unlocked: Boolean(code) && unlockedCode === code,
  };
}

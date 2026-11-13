// ── Settings Context ─────────────────────────────────────────────────────────
//
// Centralises ALL persistent dashboard settings (location, calc method,
// iqamah offsets, Jumu'ah / Eid slots, theme, font scale, progress style,
// screen protection, chime toggle, Hijri offset, etc) into a single React Context.
//
// The dashboard distinguishes APPLIED settings (currently in effect) from
// DRAFT settings (being edited in the Settings panel). The drafts only
// commit on "Apply"; Cancel discards them. This pattern previously required
// 30+ paired useState calls in App.jsx. Context flattens it to two objects.
//
//   {
//     applied,        // currently-live config — drives the dashboard render
//     drafts,         // what the Settings panel mutates
//     updateApplied(partial)  — change applied values directly (shared
//                              masjid settings, city search, etc — bypasses
//                              the draft/apply cycle)
//     updateDrafts(partial)   — change drafts (Settings panel inputs)
//     beginEditing()          — copy applied → drafts (call when opening panel)
//     applyDrafts()           — drafts → applied + persist to localStorage
//   }
//
// Drafts live inside the same context to keep all settings concerns in one
// place — components that need drafts (Settings panel) can pull them directly;
// components that just render (Header, Footer, widgets) ignore drafts.

import { createContext, useContext, useState, useCallback } from 'react';
import { STORAGE_KEY } from '../lib/constants.js';
import { isDeviceLocationLabel, normalizeImportedSettings } from '../lib/settingsImport.js';
import { deviceLanguage, IQAMAH_PRESETS } from '../lib/regionDefaults.js';

// ── Defaults & localStorage helpers ──────────────────────────────────────────
//
// These are the defaults applied on first load (no localStorage entry yet)
// and the fallback if the saved JSON is unparseable. Updating defaults here
// doesn't break existing installations — loadSettings spreads saved fields
// over defaults, so any saved value wins; defaults only fill in missing keys.

export const DEFAULTS = {
  lat: 43.6532,
  lng: -79.3832,
  locName: 'Toronto, Ontario, Canada',
  cityTz: 'America/Toronto',
  masjidName: '',
  // Optional per-screen label (e.g. "Main Hall", "Women's Section",
  // "Community Center"). When set, replaces the "Prayer Times · Digital
  // Display" subtitle. Useful when one masjid runs several screens.
  screenLabel: '',
  // ── Mosque branding ──────────────────────────────────────────────────
  // Optional logo uploaded by the admin. Stored as a base64 data URL so
  // it survives in localStorage with no backend or file system access.
  // - Empty string = no logo; UI falls back to the built-in MosqueIcon SVG.
  // - When set, the header replaces the default icon with this image.
  // - Size capped at ~100 KB in the upload handler to prevent storage bloat
  //   (localStorage has a ~5 MB total budget on most browsers).
  logoDataUrl: '',
  method: 'MWL',
  shadow: 1,
  iqamah: { fajr: 30, dhuhr: 30, asr: 30, maghrib: 0, isha: 20 },
  // ── Auto-iqamah (Smart Mode) ─────────────────────────────────────────────
  // When iqamahAutoCalc is true, the iqamah offsets above are IGNORED at
  // runtime. Instead (lib/iqamah.js), each iqamah is at least
  // iqamahAutoBuffers[key] minutes after the adhan, moved up to the next
  // :00 / :15 / :30 / :45; Maghrib is exactly adhan + its minutes.
  // ON by default, so a new display shows sensible iqamah times without
  // setup; mosques with fixed posted times switch it off.
  //
  // Default minimum waits, and the waits they produce:
  //   Fajr 20 → 20–34 min   time for the two sunnah rak'ahs; people arrive
  //                          in the dark
  //   Dhuhr 10, Asr 10 → 10–24 min   wudu + the sunnah before Dhuhr
  //   Maghrib 5 → 5 min     short window; prayed soon after the adhan
  //   Isha 10 → 10–24 min
  iqamahAutoCalc: true,
  // The "rounded" preset (lib/regionDefaults.js). First-time setup switches
  // to the usual preset for the country (Gulf, South Asia, Maldives).
  iqamahAutoBuffers: { ...IQAMAH_PRESETS.rounded.buffers },
  // Rounding step for automatic iqamah, in minutes: 15 (quarter-hour), 5 or
  // 1 (exact). Maghrib is never rounded.
  iqamahRoundTo: IQAMAH_PRESETS.rounded.roundTo,
  // Fajr only: hold iqamah until this many minutes before sunrise (0 = off),
  // for mosques that pray Fajr late (common Hanafi practice).
  iqamahFajrBeforeSunrise: IQAMAH_PRESETS.rounded.fajrBeforeSunrise,
  // Which auto-iqamah rule the buffers above were saved under. Rule 2 =
  // "minimum wait, rounded up; Maghrib exact". Settings saved without it
  // used rule 1 (nearest quarter-hour): untouched rule-1 defaults move to the
  // minimums above, customised ones are converted so their times stay the
  // same — see lib/settingsImport.js.
  iqamahRule: 2,
  // Jumu'ah slots are adhan-time-only (no separate iqamah field).
  // The board shows a single congregational time per slot.
  jumuah: [
    { time: '13:00', enabled: true },
    { time: '13:45', enabled: false },
    { time: '14:30', enabled: false },
    { time: '15:15', enabled: false },
  ],
  // Eid prayer schedules. Two SEPARATE arrays for Fitr and Adha because
  // many mosques run different schedules for the two Eids (different times,
  // different slot counts, etc.). Auto-detection (via Hijri calendar) picks
  // which set is active when Eid approaches — no manual on/off toggle needed
  // for the whole banner.
  //
  // Each slot: { time, enabled }
  //   - `enabled`: per-slot toggle (matches the Jumu'ah pattern). Disabled
  //     slots are hidden in the banner. Default: only 1st slot enabled
  //     (most mosques have 1 Eid jamaat; staff toggles more on if needed).
  //   - `time`: 'HH:MM' (24h). Greyed out when disabled.
  //
  // No `label` field — banner label is auto-set from the upcoming Eid kind
  // (Fitr or Adha) via Hijri calendar detection.
  eidFitr: [
    { time: '08:00', enabled: true },
    { time: '09:00', enabled: false },
    { time: '10:00', enabled: false },
    { time: '11:00', enabled: false },
  ],
  eidAdha: [
    { time: '07:30', enabled: true },
    { time: '08:30', enabled: false },
    { time: '09:30', enabled: false },
    { time: '10:30', enabled: false },
  ],
  eidDaysBefore: 7, // show Eid banner this many days before the actual Eid
  eidLocation: '', // optional venue/address (e.g. community center) — shown in
  //                  the Eid banner and auto-announcements when set
  hijriOffset: 0, // ±days adjustment for Hijri date display
  highLatRule: 'middleOfNight', // for cities above ~48° latitude
  // 'middleOfNight' | 'seventhOfNight' | 'twilightAngle'
  theme: 'Classic Gold',
  ecoMode: true,
  // Prayer beeps — split into adhan + iqamah so admins can enable either
  // independently. Both OFF by default: browsers block sound until someone
  // has interacted with the page, so on an unattended TV a default beep
  // would play on some days and not others; and in a prayer hall the real
  // adhan / iqamah call is the signal. Mosques that want a beep turn it on.
  // Legacy `chimeEnabled` from earlier versions is migrated in loadSettings:
  // a stored true value sets BOTH new flags true; false sets both false.
  chimeAdhan: false,
  chimeIqamah: false,
  fontScale: 100, // % — 100 = default, 70..130 manual fine-tune in settings
  // ── Viewing-distance scaling ─────────────────────────────────────────────
  // Legibility at distance is governed by ANGULAR size (cap-height ÷ distance),
  // not screen size — so the app cannot auto-detect it from the panel alone.
  // Instead we offer three ways to set one scale multiplier (viewingScale),
  // which combines with fontScale to drive the global --t-fs.
  //   'manual'    → viewingScale = 1, user uses the fontScale slider only
  //   'distance'  → pick how far the furthest viewer is (one tap)
  //   'calibrate' → walk to the far point, tune by eye, store the result
  viewingMode: 'manual', // 'manual' | 'distance' | 'calibrate'
  viewingDistance: 'medium', // 'close' | 'medium' | 'large' | 'grand'
  viewingCalibrated: 1.0, // custom multiplier from calibrate mode (0.8..3.0)
  progressStyle: 'hero', // 'ring' | 'daybar' | 'moon' | 'hero' | 'line'
  lang: 'en', // UI language: 'en' | 'ar' | 'ur' — see src/i18n/. A brand-new
  //            display starts in the device's language (see loadSettings).
  autoAnnouncements: false, // prepend basic computed notices to ticker
  announcements: '', // Newline-separated list shown in the bottom ticker.
  tickerMode: 'scroll', // 'scroll' | 'static'
  tickerStaticSeconds: 8, // static mode dwell time per item
  // Empty string = hide ticker entirely.

  // ── Blackout mode (Phase 3) ──────────────────────────────────────────────
  // From `blackoutLeadSeconds` before each iqamah until `blackoutDurations[key]`
  // minutes after, the dashboard goes dark with a small Arabic invocation
  // centred — reverent, focused, no distractions during prayer.
  // Defaults: ~30s lead, prayer-specific durations matching typical mosque
  // congregational prayer lengths (Maghrib shortest, Isha longest).
  blackoutEnabled: false,
  blackoutLeadSeconds: 30,
  blackoutOpacity: 70, // % opacity of the overlay (0..100)
  // 0 = fully transparent (dashboard fully visible)
  // 85 = default — clearly "in prayer mode" but
  //      dashboard still faintly visible underneath
  // 100 = fully opaque (pure black, current behaviour)
  // jumuah covers the khutbah + prayer from each Jumu'ah slot time; eid
  // covers the Eid prayer + khutbah from each Eid slot time.
  blackoutDurations: { fajr: 10, dhuhr: 10, asr: 10, maghrib: 7, isha: 12, jumuah: 40, eid: 30 },
};

/**
 * True once any settings have been saved on this device (by Apply, or by
 * the masjid's shared settings). App uses this to suggest the country's
 * usual calculation method only during first-time setup, so picking a city
 * later never replaces a method the admin chose.
 */
export function hasSavedSettings() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Storage unavailable — treat as nothing saved.
    return false;
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // First run: start in the device's language (Arabic / Urdu / English).
    if (!raw) return { ...DEFAULTS, lang: deviceLanguage() };
    const stored = JSON.parse(raw);
    const normalized = normalizeImportedSettings(stored, DEFAULTS);
    if (!normalized.ok) return DEFAULTS;
    // Coordinates once taken from the device are rounded when read (see
    // lib/settingsImport.js): save them rounded, so the precise ones don't
    // stay on the device either.
    const { lat, lng, locName } = normalized.value;
    if (isDeviceLocationLabel(locName) && (stored.lat !== lat || stored.lng !== lng)) {
      saveSettings({ ...stored, lat, lng });
    }
    return normalized.value;
  } catch {
    return DEFAULTS;
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota exceeded or storage unavailable (e.g. Safari private mode).
    // Silently ignore — settings won't persist this session but the app
    // continues working with in-memory state. Logging would spam console.
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  // applied = currently in effect (renders the dashboard)
  const [applied, setApplied] = useState(loadSettings);
  // drafts = what the Settings panel edits; initially mirrors applied
  const [drafts, setDrafts] = useState(applied);

  // Direct setter for applied — used when settings change without going
  // through the panel (shared masjid settings, city-search select).
  // Auto-persists to localStorage so a page reload keeps the new state.
  const updateApplied = useCallback((partial) => {
    setApplied((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  // Setter for drafts — used by the Settings panel's input handlers.
  // Accepts either a partial object `{key:value}` for direct field updates,
  // OR a function `(prevDrafts) => newDrafts` for functional updates. Does
  // NOT persist; the user must click "Apply" for that.
  const updateDrafts = useCallback((partialOrFn) => {
    setDrafts((prev) =>
      typeof partialOrFn === 'function' ? partialOrFn(prev) : { ...prev, ...partialOrFn }
    );
  }, []);

  // Called when the panel opens — snapshot applied into drafts so the
  // panel starts from the current state, not stale drafts from last edit.
  const beginEditing = useCallback(() => {
    setDrafts(applied);
  }, [applied]);

  // Called when "Apply" is clicked — commit drafts to applied + persist.
  const applyDrafts = useCallback(() => {
    setApplied(drafts);
    saveSettings(drafts);
  }, [drafts]);

  const value = {
    applied,
    drafts,
    updateApplied,
    updateDrafts,
    beginEditing,
    applyDrafts,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/**
 * Hook for consuming the settings context. Throws if used outside the
 * provider — that's a programmer error and we'd rather fail loud than
 * render with mysteriously-missing data.
 */
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings() called outside <SettingsProvider>');
  }
  return ctx;
}

// ── Settings Context ─────────────────────────────────────────────────────────
//
// Centralises ALL persistent dashboard settings (location, calc method,
// iqamah offsets, Jumu'ah / Eid slots, theme, font scale, progress style,
// chime toggle, Hijri offset, etc) into a single React Context.
//
// The dashboard distinguishes APPLIED settings (currently in effect) from
// DRAFT settings (being edited in the Settings panel). The drafts only
// commit on "Apply"; Cancel discards them. This pattern previously required
// 30+ paired useState calls in App.jsx. Context flattens it to two objects.
//
//   {
//     applied,        // currently-live config — drives the dashboard render
//     drafts,         // what the Settings panel mutates
//     updateApplied(partial)  — change applied values directly (geolocation
//                              auto-update, city search, etc — bypasses
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
  // runtime. Instead, iqamah is computed daily as:
  //   adhan + iqamahAutoBuffers[key] minutes, then rounded UP to the next
  //   :00 / :15 / :30 / :45.
  // Maghrib's default buffer is 0 (immediate iqamah is common at sunset).
  // OPT-IN: default OFF so existing setups behave identically.
  iqamahAutoCalc: true,
  iqamahAutoBuffers: { fajr: 30, dhuhr: 15, asr: 15, maghrib: 0, isha: 10 },
  jumuah: [
    { time: '13:00', iqamah: 20, enabled: true },
    { time: '13:45', iqamah: 20, enabled: false },
    { time: '14:30', iqamah: 20, enabled: false },
    { time: '15:15', iqamah: 20, enabled: false },
  ],
  // Eid prayer schedules. Two SEPARATE arrays for Fitr and Adha because
  // many mosques run different schedules for the two Eids (different times,
  // different slot counts, etc.). Auto-detection (via Hijri calendar) picks
  // which set is active when Eid approaches — no manual on/off toggle needed
  // for the whole banner.
  //
  // Each slot: { time, iqamah, enabled }
  //   - `enabled`: per-slot toggle (matches the Jumu'ah pattern). Disabled
  //     slots are hidden in the banner. Default: only 1st slot enabled
  //     (most mosques have 1 Eid jamaat; staff toggles more on if needed).
  //   - `time`: 'HH:MM' (24h). Greyed out when disabled.
  //   - `iqamah`: minutes after adhan.
  //
  // No `label` field — banner label is auto-set from the upcoming Eid kind
  // (Fitr or Adha) via Hijri calendar detection.
  eidFitr: [
    { time: '08:00', iqamah: 10, enabled: true },
    { time: '09:00', iqamah: 10, enabled: false },
    { time: '10:00', iqamah: 10, enabled: false },
    { time: '11:00', iqamah: 10, enabled: false },
  ],
  eidAdha: [
    { time: '07:30', iqamah: 10, enabled: true },
    { time: '08:30', iqamah: 10, enabled: false },
    { time: '09:30', iqamah: 10, enabled: false },
    { time: '10:30', iqamah: 10, enabled: false },
  ],
  eidDaysBefore: 7, // show Eid banner this many days before the actual Eid
  hijriOffset: 0, // ±days adjustment for Hijri date display
  highLatRule: 'middleOfNight', // for cities above ~48° latitude
  // 'middleOfNight' | 'seventhOfNight' | 'twilightAngle'
  theme: 'Classic Gold',
  // Prayer beeps — split into adhan + iqamah so admins can enable either
  // independently. Default: iqamah ON (the "stand up, prayer starting now"
  // signal everyone wants), adhan OFF (most mosques play the actual adhan
  // from speakers; a beep would compete with that audio).
  // Legacy `chimeEnabled` from earlier versions is migrated in loadSettings:
  // a stored true value sets BOTH new flags true; false sets both false.
  chimeAdhan: false,
  chimeIqamah: true,
  fontScale: 100, // % — 100 = default, 70..130 adjustable in settings
  progressStyle: 'hero', // 'ring' | 'daybar' | 'moon' | 'hero' | 'line'
  lang: 'en', // UI language: 'en' | 'ar' | 'ur' — see src/i18n/
  announcements: '', // Newline-separated list shown in the bottom ticker.
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
  blackoutDurations: { fajr: 10, dhuhr: 10, asr: 10, maghrib: 7, isha: 12 },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw);

    // ── Legacy migration: chimeEnabled → chimeAdhan + chimeIqamah ─────────
    // Pre-split builds had a single `chimeEnabled` flag that controlled both
    // adhan and iqamah beeps. If we find that key in storage and the new
    // split keys aren't present, map the old value to both new fields so
    // users don't lose their preference on upgrade. After migration, the
    // old key is harmless (just ignored), so we don't actively delete it.
    if ('chimeEnabled' in stored && !('chimeAdhan' in stored) && !('chimeIqamah' in stored)) {
      stored.chimeAdhan = !!stored.chimeEnabled;
      stored.chimeIqamah = !!stored.chimeEnabled;
    }

    // ── Legacy migration: single `eid` array → eidFitr + eidAdha ──────────
    // Pre-Hijri-auto-detection builds had ONE `eid` array with `enabled` and
    // `label` per slot. The label distinguished Fitr vs Adha; staff toggled
    // `enabled` manually around each Eid.
    //
    // The new system has TWO separate arrays (eidFitr + eidAdha) and uses
    // the Hijri calendar to auto-detect which Eid is approaching. So we
    // migrate the old `eid` array by:
    //   - Looking at the FIRST slot's label to guess which Eid the user
    //     was configuring most recently
    //   - Putting all slots (stripped of `enabled` + `label`) into that
    //     Eid's new array
    //   - Leaving the OTHER Eid at DEFAULTS values
    if (
      'eid' in stored &&
      Array.isArray(stored.eid) &&
      !('eidFitr' in stored) &&
      !('eidAdha' in stored)
    ) {
      const cleanedSlots = stored.eid.map((e) => ({
        time: e.time || '',
        iqamah: Number(e.iqamah) || 20,
        enabled: e.enabled !== false, // preserve original enabled flag
      }));
      const guessedKind = stored.eid[0]?.label?.toLowerCase().includes('adha') ? 'adha' : 'fitr';
      if (guessedKind === 'adha') {
        stored.eidAdha = cleanedSlots;
        stored.eidFitr = DEFAULTS.eidFitr;
      } else {
        stored.eidFitr = cleanedSlots;
        stored.eidAdha = DEFAULTS.eidAdha;
      }
    }

    return { ...DEFAULTS, ...stored };
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
  // through the panel (geolocation, city-search select, geolocation pin).
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

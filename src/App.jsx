import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { HADITHS, GEO_API, SETTINGS_PIN, SHOW_TEST_BTNS } from './lib/constants.js';
import { calcQibla, tzOffsetHours } from './lib/prayerCalc.js';
import { toHijri, toHijriParts, findUpcomingEid } from './lib/hijri.js';
import { addMins, fmt12 } from './lib/formatters.js';
import { computeIqamah } from './lib/iqamah.js';
import { findNonAscendingSlot, buildOrderErrorMessage } from './lib/scheduleValidation.js';
import { normalizeImportedSettings } from './lib/settingsImport.js';
import { buildThemeVars } from './lib/themes.js';

// Custom hooks — pure logic extracted to their own files
import useCityTime from './hooks/useCityTime.js';
import usePrayerTimes from './hooks/usePrayerTimes.js';
import useWeather from './hooks/useWeather.js';
import useAudioUnlock from './hooks/useAudioUnlock.js';
import useChime from './hooks/useChime.js';
import useLunarPhase from './hooks/useLunarPhase.js';
import useBlackoutMode from './hooks/useBlackoutMode.js';

// Settings context — wraps applied + draft state, persists to localStorage
import { useSettings, DEFAULTS } from './context/SettingsContext.jsx';
import { useT, fmtStr } from './i18n/I18nContext.jsx';

// Visual components — extracted to their own files
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Ticker from './components/Ticker.jsx';
import BlackoutOverlay from './components/BlackoutOverlay.jsx';
import Clock from './components/Clock.jsx';
import PrayerList from './components/PrayerList.jsx';
import PinOverlay from './components/PinOverlay.jsx';
import SettingsPanel from './components/settings/SettingsPanel.jsx';
import PrintableSchedule from './components/PrintableSchedule.jsx';
// Layout widgets — pulled into the surrounding chrome (header / above
// clock / below prayer list / under countdown). These are the dashboard's
// only widget set after removing the classic bottom-band cards.
import SunArc from './components/widgets/SunArc.jsx';
import MoonArc from './components/widgets/MoonArc.jsx';
import WeatherStrip from './components/widgets/WeatherStrip.jsx';
import FastBar from './components/widgets/FastBar.jsx';
import HeaderQibla from './components/widgets/HeaderQibla.jsx';

// ── App-only static data ─────────────────────────────────────────────────────
// HADITHS, GEO_API, SETTINGS_PIN, SHOW_TEST_BTNS now live in lib/constants.js
// (imported at the top of this file).

// ── Themes ───────────────────────────────────────────────────────────────────
// Theme definitions + buildThemeVars now live in src/lib/themes.js
// (imported at top of file).

// ── CSS ───────────────────────────────────────────────────────────────────
// Static styles now live in src/styles/*.css and are imported by main.jsx.
// Theme CSS variables (--t-*) are still injected dynamically below since
// they change when the user picks a different theme in Settings.

// ── Audio: prayer beep ─────────────────────────────────────────────────────
// _getBeep + primeAudio + playBeep now live in src/lib/audio.js
// (imported at top of file)

// ── App ───────────────────────────────────────────────────────────────────────

// ── Persistent settings ──────────────────────────────────────────────────────
// DEFAULTS + loadSettings + saveSettings now live in src/context/SettingsContext.jsx
// (the SettingsProvider in main.jsx wraps the app and provides them via useSettings).

import IslamicGeometryEngine from './IslamicGeometryEngine';

function formatGeoLabel(latitude, longitude) {
  const latAbs = Math.abs(latitude).toFixed(2);
  const lngAbs = Math.abs(longitude).toFixed(2);
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lngDir = longitude >= 0 ? 'E' : 'W';
  return `${latAbs}°${latDir}  ${lngAbs}°${lngDir}`;
}

export default function App() {
  // ── Persistent settings via React Context ──────────────────────────────
  // applied = currently in effect; drafts = what the Settings panel edits.
  // localStorage is owned by the SettingsProvider — direct setters here
  // (e.g. setLat from geolocation) call updateApplied which persists.
  const { applied, drafts, updateApplied, updateDrafts, beginEditing } = useSettings();

  // Translation hook — used for alerts and any inline strings rendered
  // directly from App.jsx. Most translated text lives in child components
  // that call useT() themselves.
  const { t } = useT();

  // Destructure applied → individual reactive values used throughout App.jsx
  const {
    lat,
    lng,
    locName,
    masjidName,
    screenLabel,
    logoDataUrl,
    cityTz,
    method,
    shadow,
    highLatRule,
    iqamah: rawIqamah,
    jumuah,
    eidFitr,
    eidAdha,
    eidDaysBefore,
    eidLocation,
    iqamahAutoCalc,
    iqamahAutoBuffers,
    hijriOffset,
    theme,
    ecoMode,
    chimeAdhan,
    chimeIqamah,
    fontScale,
    progressStyle,
    autoAnnouncements,
    announcements,
    tickerMode,
    tickerStaticSeconds,
    blackoutEnabled,
    blackoutLeadSeconds,
    blackoutDurations,
    blackoutOpacity,
  } = applied;

  // (Setter shims for setLat/setMethod/etc. were removed — App.jsx now
  // uses updateApplied({...}) directly. The shims were dead code from an
  // earlier refactor.)

  // Draft mirror — destructure drafts. Each `setDraftX(value)` updates ONE
  // field via updateDrafts. The shims accept either a value or a function
  // (prev → next). Using updateDrafts's functional form keeps multiple
  // sequential updates within the same tick race-safe.
  const draftMethod = drafts.method;
  const draftAsr = drafts.shadow === 2 ? 'Hanafi' : 'Standard';
  const draftIqamah = drafts.iqamah;
  const draftIqamahAutoCalc = drafts.iqamahAutoCalc;
  const draftIqamahAutoBuffers = drafts.iqamahAutoBuffers;
  const draftJumuah = drafts.jumuah;
  const draftEidFitr = drafts.eidFitr;
  const draftEidAdha = drafts.eidAdha;
  const draftEidDays = drafts.eidDaysBefore;
  const draftHijri = drafts.hijriOffset;
  const draftHighLat = drafts.highLatRule;
  const draftTheme = drafts.theme;
  const draftEcoMode = drafts.ecoMode;
  const draftChimeAdhan = drafts.chimeAdhan;
  const draftChimeIqamah = drafts.chimeIqamah;
  const draftFontScale = drafts.fontScale;
  const draftProgress = drafts.progressStyle;
  const draftLang = drafts.lang;
  const draftAutoAnnouncements = drafts.autoAnnouncements;
  const draftAnnouncements = drafts.announcements;
  const draftTickerMode = drafts.tickerMode;
  const draftTickerStaticSeconds = drafts.tickerStaticSeconds;
  const draftBlackoutEnabled = drafts.blackoutEnabled;
  const draftBlackoutDurations = drafts.blackoutDurations;
  const draftBlackoutOpacity = drafts.blackoutOpacity;
  // Simple shims — each updates a single field with race-safe functional form
  const setDraftMethod = (v) =>
    updateDrafts((prev) => ({ ...prev, method: typeof v === 'function' ? v(prev.method) : v }));
  const setDraftIqamah = (v) =>
    updateDrafts((prev) => ({ ...prev, iqamah: typeof v === 'function' ? v(prev.iqamah) : v }));
  const setDraftIqamahAutoCalc = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      iqamahAutoCalc: typeof v === 'function' ? v(prev.iqamahAutoCalc) : v,
    }));
  const setDraftIqamahAutoBuffers = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      iqamahAutoBuffers: typeof v === 'function' ? v(prev.iqamahAutoBuffers) : v,
    }));
  const setDraftJumuah = (v) =>
    updateDrafts((prev) => ({ ...prev, jumuah: typeof v === 'function' ? v(prev.jumuah) : v }));
  const setDraftEidFitr = (v) =>
    updateDrafts((prev) => ({ ...prev, eidFitr: typeof v === 'function' ? v(prev.eidFitr) : v }));
  const setDraftEidAdha = (v) =>
    updateDrafts((prev) => ({ ...prev, eidAdha: typeof v === 'function' ? v(prev.eidAdha) : v }));
  const setDraftEidDays = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      eidDaysBefore: typeof v === 'function' ? v(prev.eidDaysBefore) : v,
    }));
  const draftEidLocation = drafts.eidLocation;
  const setDraftEidLocation = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      eidLocation: typeof v === 'function' ? v(prev.eidLocation) : v,
    }));
  const draftScreenLabel = drafts.screenLabel;
  const setDraftScreenLabel = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      screenLabel: typeof v === 'function' ? v(prev.screenLabel) : v,
    }));
  const setDraftHijri = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      hijriOffset: typeof v === 'function' ? v(prev.hijriOffset) : v,
    }));
  const setDraftHighLat = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      highLatRule: typeof v === 'function' ? v(prev.highLatRule) : v,
    }));
  const setDraftTheme = (v) =>
    updateDrafts((prev) => ({ ...prev, theme: typeof v === 'function' ? v(prev.theme) : v }));
  const setDraftEcoMode = (v) =>
    updateDrafts((prev) => ({ ...prev, ecoMode: typeof v === 'function' ? v(prev.ecoMode) : v }));
  const setDraftChimeAdhan = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      chimeAdhan: typeof v === 'function' ? v(prev.chimeAdhan) : v,
    }));
  const setDraftChimeIqamah = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      chimeIqamah: typeof v === 'function' ? v(prev.chimeIqamah) : v,
    }));
  const setDraftFontScale = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      fontScale: typeof v === 'function' ? v(prev.fontScale) : v,
    }));
  const setDraftProgress = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      progressStyle: typeof v === 'function' ? v(prev.progressStyle) : v,
    }));
  const setDraftLang = (v) =>
    updateDrafts((prev) => ({ ...prev, lang: typeof v === 'function' ? v(prev.lang) : v }));
  const setDraftAutoAnnouncements = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      autoAnnouncements: typeof v === 'function' ? v(prev.autoAnnouncements) : v,
    }));
  const setDraftAnnouncements = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      announcements: typeof v === 'function' ? v(prev.announcements) : v,
    }));
  const setDraftTickerMode = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      tickerMode: typeof v === 'function' ? v(prev.tickerMode) : v,
    }));
  const setDraftTickerStaticSeconds = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      tickerStaticSeconds: typeof v === 'function' ? v(prev.tickerStaticSeconds) : v,
    }));
  const setDraftBlackoutEnabled = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      blackoutEnabled: typeof v === 'function' ? v(prev.blackoutEnabled) : v,
    }));
  const setDraftBlackoutDurations = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      blackoutDurations: typeof v === 'function' ? v(prev.blackoutDurations) : v,
    }));
  const setDraftBlackoutOpacity = (v) =>
    updateDrafts((prev) => ({
      ...prev,
      blackoutOpacity: typeof v === 'function' ? v(prev.blackoutOpacity) : v,
    }));
  // Asr translates Hanafi/Standard ↔ shadow 1/2
  const setDraftAsr = (v) =>
    updateDrafts((prev) => {
      const prevLabel = prev.shadow === 2 ? 'Hanafi' : 'Standard';
      const nextLabel = typeof v === 'function' ? v(prevLabel) : v;
      return { ...prev, shadow: nextLabel === 'Hanafi' ? 2 : 1 };
    });

  // ── Non-persistent UI state (stays local — not part of settings) ────────
  const [draftMasjid, setDraftMasjid] = useState('');
  const [draftLogo, setDraftLogo] = useState('');
  const [testFriday, setTestFriday] = useState(false);
  const [testPrayer, setTestPrayer] = useState(null); // null = use real active prayer
  const [testBlackoutUntil, setTestBlackoutUntil] = useState(null); // Date | null
  // Test the final-60-sec giant pulsing countdown view. When set to a Date
  // in the future, App overrides `secsToNext` below to count toward that
  // Date — Clock then renders the .countdown-big huge-digit view because
  // secsToNext is <= 60. Auto-clears via the same effect that clears the
  // blackout test (see below).
  const [testCountdownUntil, setTestCountdownUntil] = useState(null); // Date | null
  // Test moon mode — when true, forces the centre-column arc to show
  // MoonArc regardless of whether the sun is currently up. Useful for
  // verifying the night-mode visual without waiting for sunset.
  const [testMoonActive, setTestMoonActive] = useState(false);
  // Test Eid — when set, forces the Eid banner to appear with the given
  // Eid kind regardless of Hijri date. Lets staff preview the Eid banner
  // without waiting for the actual day. null = use real Hijri detection.
  const [testEidKind, setTestEidKind] = useState(null); // null | 'fitr' | 'adha'
  // Test moon phase — when null, MoonArc uses real lunar illumination from
  // suncalc. When set to 0..1, it overrides the phase value (Test Phase
  // footer button cycles through 8 preset phases for visual verification).
  const [testMoonPhase, setTestMoonPhase] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showSett, setShowSett] = useState(false);
  // ── Printable monthly schedule view ─────────────────────────────────
  // When true, App swaps out the live dashboard for the static printable
  // schedule. Triggered from Settings → Display tab. Plain boolean state
  // (no URL routing) — kiosk usage is single-page; we don't need history
  // navigation. Returns false (back to dashboard) via the schedule's own
  // close button.
  const [showPrint, setShowPrint] = useState(false);
  // City search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle'); // idle|searching|done|error
  const [selectedCity, setSelectedCity] = useState(null); // { name, country, lat, lng }
  const searchTimer = useRef(null);

  // Blackout dismiss state — when the user holds-to-dismiss during a
  // blackout window, we record the timestamp here. useBlackoutMode checks
  // whether dismissedAt falls inside the current candidate window and
  // suppresses activation if so. Next prayer's window starts fresh, so this
  // doesn't need cleanup — old timestamps simply don't match new windows.
  const [blackoutDismissedAt, setBlackoutDismissedAt] = useState(null);

  // Custom hook: city-time anchor (now ticks + cityNowParts derived in cityTz)
  const { now, cityNow, cityNowParts, isFriday } = useCityTime(cityTz);

  // Custom hook: weather fetch + 10-min refresh
  const { weather, weatherState } = useWeather(lat, lng);

  // Custom hook: audio unlock on first user gesture
  // Auto-unlock browser audio on first user gesture. Hook attaches global
  // listeners and primes the audio singleton — no return value needed since
  // the banner UI was removed. If chimes are disabled in settings the hook
  // is harmless: it primes audio but nothing actually plays.
  useAudioUnlock();

  // (Static CSS is imported in main.jsx via src/styles/index.css — Vite
  // handles bundling. Theme CSS variables still need runtime injection
  // because they change when the user picks a different theme; see below.)

  // Inject theme CSS variables — re-runs whenever theme changes
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'theme-vars';
    el.textContent = buildThemeVars(theme);
    // Replace existing theme style if present
    const existing = document.getElementById('theme-vars');
    if (existing) existing.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [theme]);

  // Test-blackout auto-clear: once the test window has expired, clear the
  // testBlackoutUntil flag so the Footer button label flips back to its
  // default state. The check runs whenever `now` ticks (every second).
  useEffect(() => {
    if (testBlackoutUntil && now >= testBlackoutUntil) {
      setTestBlackoutUntil(null);
    }
    if (testCountdownUntil && now >= testCountdownUntil) {
      setTestCountdownUntil(null);
    }
  }, [now, testBlackoutUntil, testCountdownUntil]);

  // (now-tick is owned by useCityTime hook)
  // (audio-unlock-on-first-gesture is owned by useAudioUnlock hook)

  // ── Iqamah chime trigger (now via useChime hook below) ────────────────────
  // The chime fires at adhan AND iqamah times for each daily prayer +
  // Jumu'ah (Fridays) + Eid (when banner active). See hook for details.

  // Auto-geolocation on mount.
  // CRITICAL: must also update the timezone so the clock matches reality.
  // Without this, the saved timezone leaks across geolocation changes.
  // We use the device's resolved timezone — close enough for auto-detection
  // (city search later resolves a more precise IANA tz).
  const didAutoGeoRef = useRef(false);
  useEffect(() => {
    if (didAutoGeoRef.current) return;
    didAutoGeoRef.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Batch all geolocation fields into one updateApplied — saves to
        // localStorage exactly once and triggers a single re-render.
        let tz = null;
        try {
          tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          // Some browsers (very old Safari, locked-down kiosks) throw on
          // Intl.DateTimeFormat with no args. tz stays null; downstream
          // code falls back to the device's UTC offset.
        }
        updateApplied({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          locName: formatGeoLabel(pos.coords.latitude, pos.coords.longitude),
          ...(tz ? { cityTz: tz } : {}),
        });
      },
      () => { }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Weather fetch is owned by useWeather hook above)

  // ── Single source of truth: NOW in the selected city's timezone ────────
  // (Owned by useCityTime hook — gives us `now`, `cityNow`, `cityNowParts`, `isFriday`)

  // Prayer times + active/next/ringProgress derivation
  // (rawNext from the hook may be Dhuhr on Friday; we override below to
  //  Jumu'ah's first upcoming slot when applicable — see nextSubst)
  const {
    todayTimes,
    tomorrowTimes,
    yesterdayTimes,
    active: rawActive,
    next: rawNext,
    secsToNext: rawSecsToNext,
    ringProgress,
  } = usePrayerTimes({ cityNow, now, lat, lng, method, shadow, cityTz, highLatRule });

  // ── Effective iqamah offsets ─────────────────────────────────────────────
  // When `iqamahAutoCalc` is ON, compute each prayer's iqamah by:
  //   1. Take today's adhan time
  //   2. Add `iqamahAutoBuffers[key]` minutes → target
  //   3. Round target to the NEAREST quarter-hour (:00 / :15 / :30 / :45)
  //   4. SAFETY FLOOR: if rounded result < adhan, bump to the next
  //      quarter-hour ≥ adhan. Iqamah must never be before adhan.
  //   5. Express as minute-offset from adhan
  //
  // Rounding policy rationale:
  //   - 10:18 adhan + 15min buffer = 10:33 → nearest quarter = 10:30 ✓
  //     (3 min away vs 12 min to 10:45 — closer)
  //   - 4:17 adhan + 1min buffer = 4:18 → nearest = 4:15 → SAFETY → 4:30
  //     (4:15 is before adhan! Bump up to next quarter ≥ 4:17)
  //   - When buf=0 we skip rounding entirely (iqamah=adhan exactly) since
  //     rounding 8:37 with buf=0 would shift to 8:45 which is wrong for
  //     mosques that follow "iqamah immediately after adhan" convention.
  //
  // Computed once per day (the dependency on todayTimes.fajr's date string
  // makes useMemo recalc only at midnight or when settings change).
  const iqamah = useMemo(() => {
    if (!iqamahAutoCalc) return rawIqamah;
    const out = {};
    for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      const adhan = todayTimes?.[key];
      if (!adhan) {
        out[key] = rawIqamah[key] || 0;
        continue;
      }

      const iqamahTime = computeIqamah(adhan, {
        autoCalc: true,
        bufferMinutes: iqamahAutoBuffers?.[key] ?? 0,
      });
      out[key] = iqamahTime ? Math.round((iqamahTime - adhan) / 60000) : rawIqamah[key] || 0;
    }
    return out;
  }, [
    iqamahAutoCalc,
    rawIqamah,
    iqamahAutoBuffers,
    todayTimes,
  ]);

  // Display helpers — recalc only when needed
  // CRITICAL: clock must show the CITY's local time (not device's local time),
  // so prayer times and the displayed clock always match. We extract h/m/s
  // for the city's timezone via Intl.DateTimeFormat.
  const h12 = cityNowParts.h % 12 || 12;
  const timeStr = `${h12}:${String(cityNowParts.m).padStart(2, '0')}`;
  const secStr = `:${String(cityNowParts.s).padStart(2, '0')} ${cityNowParts.h >= 12 ? 'PM' : 'AM'}`;
  const dateStr = `${cityNowParts.weekday}, ${cityNowParts.monthName} ${cityNowParts.dayNum}, ${cityNowParts.yearNum}`;
  const hijri = useMemo(() => {
    if (hijriOffset === 0) return toHijri(cityNow);
    const adjusted = new Date(cityNow);
    adjusted.setDate(adjusted.getDate() + hijriOffset);
    return (
      toHijri(adjusted) +
      (hijriOffset !== 0 ? ` (${hijriOffset > 0 ? '+' : ''}${hijriOffset})` : '')
    );
  }, [hijriOffset, cityNow]);
  const qibla = useMemo(() => Math.round(calcQibla(lat, lng)), [lat, lng]);

  // ── Parametric inputs for IslamicGeometryEngine ──────────────────────────
  // Sun elevation: 0° = horizon, +90° = zenith, negative = below horizon
  // Approximated from current time relative to sunrise/solar-noon/sunset
  const sunElevation = useMemo(() => {
    const sr = todayTimes.sunrise,
      ss = todayTimes.maghrib;
    if (!sr || !ss) return -10;
    const nowMs = now.getTime();
    const srMs = sr.getTime(),
      ssMs = ss.getTime();
    if (nowMs < srMs || nowMs > ssMs) {
      // Night — interpolate descent below horizon (max -18° astronomical twilight)
      return nowMs < srMs
        ? -18 + (18 * (nowMs - (srMs - 3600000))) / 3600000
        : -18 * Math.min(1, (nowMs - ssMs) / 3600000);
    }
    // Day — sine arc peaking at solar noon
    const maxEl = 90 - Math.abs(lat - 23.5); // approximate max elevation
    return maxEl * Math.sin((Math.PI * (nowMs - srMs)) / (ssMs - srMs));
  }, [now, todayTimes, lat]);

  // Lunar phase — owned by useLunarPhase hook (computed from Hijri day)
  const lunarPhase = useLunarPhase(hijri);

  // Blackout mode — derives whether the dashboard should be in salah-blackout
  // RIGHT NOW based on today's & yesterday's iqamah times + per-prayer
  // durations from settings. Returns null/null when inactive (overlay
  // renders nothing). See src/hooks/useBlackoutMode.js for the windowing
  // logic + how yesterday's Isha edge case is handled.
  const blackout = useBlackoutMode({
    enabled: blackoutEnabled,
    leadSeconds: blackoutLeadSeconds,
    durations: blackoutDurations,
    todayTimes,
    yesterdayTimes,
    iqamah,
    now,
    dismissedAt: blackoutDismissedAt,
    forceUntil: testBlackoutUntil,
  });

  // Jumu'ah / Eid date helpers — must produce ABSOLUTE UTC instants whose
  // wall-clock value in the city's timezone equals (today_in_city @ HH:MM).
  // Same trick as calcTimes: Date.UTC(...) - cityTzOffset_ms.
  const cityTzOff = useMemo(
    () => tzOffsetHours(cityTz, now),
    [cityTz, now]
  );
  function makeCityDateAt(hh, mm) {
    const Y = cityNow.getFullYear();
    const M = cityNow.getMonth();
    const D = cityNow.getDate();
    return new Date(Date.UTC(Y, M, D, hh, mm, 0) - cityTzOff * 3600 * 1000);
  }

  // Jumu'ah — Friday is the CITY's day-of-week (or testFriday override for QA)
  const isFridayEffective = isFriday || testFriday;
  const activeJumuahSlots = jumuah.filter((j) => j.enabled);
  function jumuahDate(timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number);
    return makeCityDateAt(hh, mm);
  }
  // Compare absolute instants against the absolute `now`
  const nextJumuah = isFridayEffective
    ? (activeJumuahSlots.map((j) => jumuahDate(j.time)).find((t) => t > now) ?? null)
    : null;

  // ── Jumu'ah substitution for next-prayer display ─────────────────────────
  // On Fridays with at least one upcoming Jumu'ah slot, the dashboard's
  // "next prayer" should say Jumu'ah, not Dhuhr — Jumu'ah REPLACES Dhuhr in
  // congregational practice. We override here AFTER the hook runs so the
  // hook's pure prayer-time logic stays decoupled from Jumu'ah configuration.
  // Substitution conditions ALL must hold:
  //   - it's effectively Friday (real or QA test)
  //   - there's an upcoming Jumu'ah slot today
  //   - the hook's next prayer is Dhuhr (so we don't replace e.g. Fajr or Asr)
  let next = rawNext;
  let active = rawActive;
  let secsToNext = rawSecsToNext;
  if (isFridayEffective && nextJumuah && rawNext?.key === 'dhuhr') {
    next = {
      key: 'jumuah',
      en: "Jumu'ah",
      ar: 'الجمعة',
      time: nextJumuah,
    };
    secsToNext = Math.max(0, Math.floor((nextJumuah - now) / 1000));
  }

  // ── Test countdown override ──────────────────────────────────────────────
  // When the "Test Countdown" footer button is pressed, shrink secsToNext
  // toward testCountdownUntil so Clock renders the .countdown-big huge-digit
  // mode (auto-activates when secsToNext <= 60). The "Until X" label below
  // the countdown keeps the actual next prayer's name + time for realism.
  if (testCountdownUntil) {
    const remaining = Math.max(0, Math.floor((testCountdownUntil - now) / 1000));
    secsToNext = remaining;
    // Fabricate `next` if absent (extremely rare — only when no prayer
    // times are loaded yet) so Clock has something to render.
    if (!next) {
      next = { key: 'fajr', en: 'Fajr', ar: 'الفجر', time: testCountdownUntil };
    }
  }

  // ── Eid auto-detection ───────────────────────────────────────────────────
  // Uses Hijri calendar to figure out which Eid (if any) is approaching
  // within the next `eidDaysBefore` days. When detected, picks the matching
  // schedule (eidFitr or eidAdha) and sets the banner label accordingly.
  //
  // No manual toggle needed — the banner appears N days before Eid, stays
  // through the day, and auto-hides after the last iqamah + 30 min.
  const upcomingEidReal = useMemo(
    () => findUpcomingEid(now, hijriOffset, eidDaysBefore),
    // Re-evaluate when the day changes (cheap — runs at most once per minute
    // but result only changes once per day in practice).
    [now, hijriOffset, eidDaysBefore]
  );
  // Apply test override: if `testEidKind` is set, force-show that Eid's
  // banner with eidDate = today and daysUntil = 0. Lets the dev/admin
  // preview the banner via footer Test Fitr / Test Adha buttons without
  // waiting for actual Eid.
  const upcomingEid = testEidKind
    ? {
      kind: testEidKind,
      eidDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      daysUntil: 0,
    }
    : upcomingEidReal;

  // Pick the right schedule (eidFitr or eidAdha) and filter out disabled or
  // empty-time slots. Slot is active when enabled=true AND time is set.
  const activeEidSlots = upcomingEid.kind
    ? (upcomingEid.kind === 'fitr' ? eidFitr : eidAdha).filter(
      (e) => e.enabled && e.time && e.time.length > 0
    )
    : [];
  // Auto-generated label based on detected Eid kind
  const eidLabelAuto =
    upcomingEid.kind === 'fitr' ? 'Eid ul-Fitr' : upcomingEid.kind === 'adha' ? 'Eid ul-Adha' : '';

  // Eid time helper — anchors HH:MM to the actual upcoming Eid Gregorian date
  // (not "today" — that was the bug). If upcomingEid has no date yet (no Eid
  // in window), falls back to today's date (banner won't render anyway).
  function eidDate(timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number);
    const base = upcomingEid.eidDate || cityNow;
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  }
  const lastEidTime = activeEidSlots.length
    ? eidDate(activeEidSlots[activeEidSlots.length - 1].time)
    : null;
  const eidEnd = lastEidTime;
  // Banner shows when:
  //   - An upcoming Eid was detected (kind !== null) AND
  //   - We have at least one configured slot for that Eid AND
  //   - We're on the Eid date itself: banner stays until last iqamah + 30 min
  //     OR we're in the lead-up window (daysUntil > 0 && daysUntil ≤ eidDaysBefore)
  //   - EXCEPTION: when testEidKind is active, always show the banner so
  //     staff can preview it at any time of day, regardless of whether the
  //     configured Eid prayer time has already passed for "today".
  const showEidBanner =
    upcomingEid.kind !== null &&
    activeEidSlots.length > 0 &&
    (() => {
      if (testEidKind) return true; // test mode — always show
      if (!eidEnd) return false;
      if (upcomingEid.daysUntil > 0) return true; // real Eid in lead-up
      return addMins(eidEnd, 30) > now; // real Eid on its day
    })();
  const nextEid = showEidBanner
    ? (activeEidSlots.map((e) => eidDate(e.time)).find((t) => t > now) ?? null)
    : null;

  const autoAnnouncementText = (() => {
    if (!autoAnnouncements) return '';

    const lines = [];
    const seen = new Set();
    const pushLine = (line) => {
      const text = (line || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      lines.push(text);
    };

    const splitHM = (totalMinutes) => {
      const mins = Math.max(0, totalMinutes);
      return { h: Math.floor(mins / 60), m: mins % 60 };
    };

    const nowHijriDate = new Date(cityNow);
    nowHijriDate.setDate(nowHijriDate.getDate() + hijriOffset);
    const tomorrowHijriDate = new Date(nowHijriDate);
    tomorrowHijriDate.setDate(tomorrowHijriDate.getDate() + 1);

    const todayHijri = toHijriParts(nowHijriDate);
    const tomorrowHijri = toHijriParts(tomorrowHijriDate);
    const todayWeekday = cityNow.getDay();
    const tomorrowWeekday = (todayWeekday + 1) % 7;

    const isWhiteDay = todayHijri.d >= 13 && todayHijri.d <= 15;
    const isTomorrowWhiteDay = tomorrowHijri.d >= 13 && tomorrowHijri.d <= 15;
    if (isWhiteDay) {
      pushLine(
        fmtStr(t('auto.announcement.whiteDaysToday'), {
          day: String(todayHijri.d),
        })
      );
    } else if (isTomorrowWhiteDay) {
      pushLine(
        fmtStr(t('auto.announcement.whiteDaysTomorrow'), {
          day: String(tomorrowHijri.d),
        })
      );
    }

    // Monday/Thursday Sunnah fast awareness (city-local weekday)
    if (todayWeekday === 1) {
      pushLine(t('auto.announcement.sunnahMondayToday'));
    } else if (todayWeekday === 4) {
      pushLine(t('auto.announcement.sunnahThursdayToday'));
    } else if (tomorrowWeekday === 1) {
      pushLine(t('auto.announcement.sunnahMondayTomorrow'));
    } else if (tomorrowWeekday === 4) {
      pushLine(t('auto.announcement.sunnahThursdayTomorrow'));
    }

    // Key annual Sunnah fast awareness by Hijri date (with local offset)
    // Arafah: 9 Dhu al-Hijjah (month 12)
    if (todayHijri.m === 12 && todayHijri.d === 9) {
      pushLine(`! ${t('auto.announcement.arafahToday')}`);
    } else if (tomorrowHijri.m === 12 && tomorrowHijri.d === 9) {
      pushLine(`! ${t('auto.announcement.arafahTomorrow')}`);
    }

    // Ashura / Tasu'a: 10 and 9 Muharram (month 1)
    if (todayHijri.m === 1 && todayHijri.d === 9) {
      pushLine(t('auto.announcement.tasuaToday'));
    } else if (todayHijri.m === 1 && todayHijri.d === 10) {
      pushLine(`! ${t('auto.announcement.ashuraToday')}`);
    } else if (tomorrowHijri.m === 1 && tomorrowHijri.d === 9) {
      pushLine(t('auto.announcement.tasuaTomorrow'));
    } else if (tomorrowHijri.m === 1 && tomorrowHijri.d === 10) {
      pushLine(`! ${t('auto.announcement.ashuraTomorrow')}`);
    }

    // Shawwal six voluntary fasts reminder: month 10 after Eid day
    if (todayHijri.m === 10 && todayHijri.d >= 2 && todayHijri.d <= 29) {
      pushLine(t('auto.announcement.shawwalWindow'));
    }

    if (active?.key) {
      const prayerLabel = t(`prayer.${active.key}`) || active.en || '';
      pushLine(fmtStr(t('auto.announcement.nowInPrayer'), { prayer: prayerLabel }));
    }

    if (next && Number.isFinite(secsToNext)) {
      const { h, m } = splitHM(Math.floor(secsToNext / 60));
      const prayerLabel = t(`prayer.${next.key}`) || next.en || '';
      pushLine(
        fmtStr(t('auto.announcement.nextPrayer'), {
          prayer: prayerLabel,
          h: String(h),
          m: String(m),
        })
      );
    }

    const congregationCandidates = [];

    if (showEidBanner && nextEid) {
      congregationCandidates.push({
        key: 'eid',
        time: nextEid,
        label: t('prayer.eid'),
      });
    }

    if (isFridayEffective && nextJumuah) {
      congregationCandidates.push({
        key: 'jumuah',
        time: nextJumuah,
        label: t('prayer.jumuah'),
      });
    }

    for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      if (isFridayEffective && key === 'dhuhr') continue;
      const adhan = todayTimes?.[key];
      if (!adhan) continue;
      const iqamahAt = addMins(adhan, iqamah?.[key] ?? 0);
      if (!iqamahAt || iqamahAt <= now) continue;
      congregationCandidates.push({
        key,
        time: iqamahAt,
        label: t(`prayer.${key}`),
      });
    }

    congregationCandidates.sort((a, b) => a.time - b.time);
    const nextCongregation = congregationCandidates[0] || null;

    if (nextCongregation) {
      const minsAway = Math.max(0, Math.floor((nextCongregation.time - now) / 60000));
      const { h, m } = splitHM(minsAway);
      const urgentPrefix = minsAway <= 10 ? '! ' : '';
      pushLine(
        `${urgentPrefix}${fmtStr(t('auto.announcement.nextCongregation'), {
          prayer: nextCongregation.label,
          time: fmt12(nextCongregation.time, cityTz),
          h: String(h),
          m: String(m),
        })}`
      );
    }

    if (blackout?.active && blackout?.endsAt) {
      const minsLeft = Math.max(0, Math.ceil((blackout.endsAt - now) / 60000));
      const { h, m } = splitHM(minsLeft);
      pushLine(
        `! ${fmtStr(t('auto.announcement.blackoutActive'), {
          time: fmt12(blackout.endsAt, cityTz),
          h: String(h),
          m: String(m),
        })}`
      );
    }

    if (isFridayEffective && activeJumuahSlots.length > 0) {
      const times = activeJumuahSlots
        .map((slot) => fmt12(jumuahDate(slot.time), cityTz))
        .join(' • ');
      pushLine(fmtStr(t('auto.announcement.jumuahToday'), { times }));
    }

    if (showEidBanner && upcomingEid?.kind) {
      const venue = eidLocation ? ` — ${eidLocation}` : '';
      if (upcomingEid.daysUntil > 0) {
        const eidLabel =
          upcomingEid.kind === 'fitr' ? t('auto.eid.fitr') : t('auto.eid.adha');
        pushLine(
          fmtStr(t('auto.announcement.eidInDays'), {
            eid: eidLabel,
            days: String(upcomingEid.daysUntil),
          }) + venue
        );
      } else {
        const times = activeEidSlots
          .map((slot) => fmt12(eidDate(slot.time), cityTz))
          .join(' • ');
        pushLine(fmtStr(t('auto.announcement.eidToday'), { times }) + venue);
      }
    }

    if (upcomingEid?.kind && upcomingEid.daysUntil === 0) {
      const eidLabel = upcomingEid.kind === 'fitr' ? t('auto.eid.fitr') : t('auto.eid.adha');
      pushLine(`! ${fmtStr(t('auto.announcement.eidGreeting'), { eid: eidLabel })}`);
    }

    return lines.join('\n');
  })();

  const manualAnnouncements = (announcements || '').trim();
  const mergedAnnouncements = autoAnnouncementText
    ? manualAnnouncements
      ? `${autoAnnouncementText}\n${manualAnnouncements}`
      : autoAnnouncementText
    : manualAnnouncements;

  // Hook: fire adhan/iqamah beep at the right times. Each flag gates its
  // own event type — caller can have either, both, or neither enabled.
  useChime({
    chimeAdhan,
    chimeIqamah,
    now,
    todayTimes,
    iqamah,
    isFriday: isFridayEffective,
    activeJumuahSlots,
    showEidBanner,
    activeEidSlots,
    jumuahDate,
    eidDate,
  });

  const doOpenSettings = useCallback(() => {
    // Snapshot applied → drafts so the panel starts from the current state
    beginEditing();
    // Also reset the non-persistent UI state (search, masjid name preview)
    setDraftMasjid(masjidName);
    setDraftLogo(logoDataUrl);
    setSearchQuery('');
    setSearchResults([]);
    setSearchStatus('idle');
    setSelectedCity(null);
    setShowSett(true);
  }, [beginEditing, masjidName, logoDataUrl]);

  const openSettings = useCallback(() => {
    if (SETTINGS_PIN) {
      // Always ask PIN — never cache the unlock
      setPinInput('');
      setPinError(false);
      setShowPin(true);
      return;
    }
    doOpenSettings();
  }, [doOpenSettings]);

  function submitPin() {
    if (pinInput === SETTINGS_PIN) {
      setShowPin(false);
      doOpenSettings();
    } else {
      setPinError(true);
      setPinInput('');
    }
  }

  async function handleSearchInput(q) {
    setSearchQuery(q);
    setSelectedCity(null);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setSearchStatus('idle');
      return;
    }
    setSearchStatus('searching');
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${GEO_API}?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`
        );
        const data = await res.json();
        const results = (data.results || []).map((r) => ({
          id: r.id,
          name: r.name,
          country: r.country || '',
          admin1: r.admin1 || '',
          lat: r.latitude,
          lng: r.longitude,
          tz: r.timezone || '',
        }));
        setSearchResults(results);
        setSearchStatus(results.length ? 'done' : 'empty');
      } catch {
        setSearchStatus('error');
      }
    }, 350);
  }

  function handleSelectCity(city) {
    setSelectedCity(city);
    setSearchQuery(city.name);
    setSearchResults([]);
    setSearchStatus('idle');
  }
  // city.tz comes from Open-Meteo geocoding API (IANA timezone string)

  // ── Export / Import settings ─────────────────────────────────────────────
  // Lets admins back up their config (themes, prayer offsets, Jumu'ah slots,
  // blackout durations, etc.) and restore it elsewhere — useful when:
  //   - moving the dashboard to a new device
  //   - sharing a curated setup between multiple masajid
  //   - rolling back after a bad change
  // Format: JSON. We export the `applied` state (what's currently in effect),
  // not drafts, so the file always reflects a known-good configuration.
  function exportSettings() {
    const payload = JSON.stringify(applied, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `prayer-times-settings-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import reads a JSON file and merges it into DRAFTS (not applied) so the
  // user can review the loaded settings in the panel and click Apply to
  // commit, or Cancel to discard. Unknown keys are silently dropped at
  // applySettings sanitization; missing keys fall through to DEFAULTS.
  // Returns a Promise resolving to true on success, false on parse error,
  // so the caller can show feedback.
  function importSettings(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const normalized = normalizeImportedSettings(parsed, DEFAULTS);
          if (!normalized.ok) throw new Error('invalid settings shape');
          // Merge into drafts so the panel can show the new values; user
          // must click Apply to commit. We use updateDrafts with a function
          // form so it spreads atomically over the current drafts state.
          updateDrafts(() => normalized.value);
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  // Reset drafts to factory DEFAULTS. The user reviews the wiped state in
  // the panel and clicks Apply to commit (or Cancel to discard). This is
  // a destructive operation — the panel's Reset button uses a 2-click
  // confirmation pattern to avoid accidental wipes. Same flow as import:
  // changes live in drafts until Apply, so nothing is lost until then.
  function resetSettings() {
    updateDrafts(() => ({ ...DEFAULTS }));
  }

  function applySettings() {
    const jumuahOrderError = findNonAscendingSlot(drafts.jumuah);
    const eidFitrOrderError = findNonAscendingSlot(drafts.eidFitr);
    const eidAdhaOrderError = findNonAscendingSlot(drafts.eidAdha);
    const firstOrderError =
      (jumuahOrderError && buildOrderErrorMessage('Jumuah', jumuahOrderError)) ||
      (eidFitrOrderError && buildOrderErrorMessage('Eid ul-Fitr', eidFitrOrderError)) ||
      (eidAdhaOrderError && buildOrderErrorMessage('Eid ul-Adha', eidAdhaOrderError)) ||
      '';

    if (firstOrderError) {
      window.alert(firstOrderError);
      return;
    }

    // Clamp/sanitize drafts before applying. The Settings panel inputs let
    // users type freely; we enforce ranges here at commit time.
    const sanitizedIqamah = Object.fromEntries(
      Object.entries(drafts.iqamah).map(([k, v]) => [k, Math.min(60, Math.max(0, Number(v) || 0))])
    );
    const sanitizedJumuah = drafts.jumuah.map((j) => ({
      time: j.time || '',
      enabled: j.enabled !== false,
    }));
    const sanitizedEidFitr = drafts.eidFitr.map((e) => ({
      time: e.time || '',
      enabled: e.enabled !== false,
    }));
    const sanitizedEidAdha = drafts.eidAdha.map((e) => ({
      time: e.time || '',
      enabled: e.enabled !== false,
    }));
    const sanitizedDays = Math.min(30, Math.max(0, Number(drafts.eidDaysBefore) || 0));
    const sanitizedHijri = Math.min(3, Math.max(-3, Number(drafts.hijriOffset) || 0));
    const sanitizedFont = Math.min(130, Math.max(70, Number(drafts.fontScale) || 100));
    // Blackout per-prayer durations: clamp 0..60 min. 0 = effectively disabled
    // for that prayer (window collapses to just the leadSeconds before iqamah).
    const sanitizedBlackoutDur = Object.fromEntries(
      Object.entries(drafts.blackoutDurations).map(([k, v]) => [
        k,
        Math.min(60, Math.max(0, Number(v) || 0)),
      ])
    );
    // Blackout opacity: clamp 0..100 percent.
    const sanitizedBlackoutOpacity = Math.min(
      100,
      Math.max(0, Number(drafts.blackoutOpacity) || 0)
    );
    // Auto-iqamah buffers: clamp 0..60 min per prayer.
    const sanitizedAutoBuf = Object.fromEntries(
      Object.entries(drafts.iqamahAutoBuffers || {}).map(([k, v]) => [
        k,
        Math.min(60, Math.max(0, Number(v) || 0)),
      ])
    );

    // Build the new applied state in one shot. City selection (if any)
    // overrides lat/lng/cityTz/locName since the city search bypasses drafts.
    const newMasjid = draftMasjid.trim();
    const newApplied = {
      ...drafts,
      iqamah: sanitizedIqamah,
      jumuah: sanitizedJumuah,
      eidFitr: sanitizedEidFitr,
      eidAdha: sanitizedEidAdha,
      eidDaysBefore: sanitizedDays,
      eidLocation: (drafts.eidLocation || '').slice(0, 120),
      screenLabel: (drafts.screenLabel || '').slice(0, 60),
      hijriOffset: sanitizedHijri,
      fontScale: sanitizedFont,
      blackoutDurations: sanitizedBlackoutDur,
      blackoutOpacity: sanitizedBlackoutOpacity,
      iqamahAutoBuffers: sanitizedAutoBuf,
      masjidName: newMasjid,
      logoDataUrl: draftLogo || '',
    };
    if (selectedCity) {
      newApplied.lat = selectedCity.lat;
      newApplied.lng = selectedCity.lng;
      newApplied.locName = selectedCity.admin1
        ? `${selectedCity.name}, ${selectedCity.admin1}, ${selectedCity.country}`
        : `${selectedCity.name}, ${selectedCity.country}`;
      if (selectedCity.tz) newApplied.cityTz = selectedCity.tz;
    }

    // updateApplied handles localStorage persistence automatically
    updateApplied(newApplied);
    setShowSett(false);
  }

  function geolocate() {
    if (!navigator.geolocation) return alert(t('alert.geoUnsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Batch lat/lng/cityTz/locName into one update
        updateApplied({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          cityTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locName: formatGeoLabel(pos.coords.latitude, pos.coords.longitude),
        });
        setShowSett(false);
      },
      () => alert(t('alert.geoFailed'))
    );
  }

  // Keyboard accessibility shortcuts:
  // - Alt+S or Ctrl+, opens Settings
  // - Escape closes PIN or Settings overlays
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const inTypingField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.key === 'Escape') {
        if (showPin) {
          setShowPin(false);
          return;
        }
        if (showSett) {
          setShowSett(false);
        }
        return;
      }

      if (inTypingField) return;
      const key = event.key.toLowerCase();
      const openSettingsShortcut = (event.altKey && key === 's') || (event.ctrlKey && key === ',');
      if (!openSettingsShortcut || showSett || showPin) return;

      event.preventDefault();
      openSettings();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSett, showPin, openSettings]);

  // ── Early return: printable monthly schedule view ──────────────────
  // When the user clicks "Print Monthly Schedule" in Settings, we render
  // ONLY the schedule (no header, no footer, no widgets) so it occupies
  // the full viewport and prints cleanly. The schedule's own close
  // button flips the flag back to show the live dashboard.
  if (showPrint) {
    return (
      <PrintableSchedule
        lat={lat}
        lng={lng}
        cityTz={cityTz}
        method={method}
        shadow={shadow}
        highLatRule={highLatRule}
        iqamah={rawIqamah}
        iqamahAutoCalc={iqamahAutoCalc}
        iqamahAutoBuffers={iqamahAutoBuffers}
        hijriOffset={hijriOffset}
        masjidName={masjidName}
        locName={locName}
        logoDataUrl={logoDataUrl}
        jumuah={jumuah}
        eidFitr={eidFitr}
        eidAdha={eidAdha}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <>
      <div className={`app${ecoMode ? ' app--eco' : ''}`} style={{ '--t-fs': fontScale / 100 }}>
        {/* Islamic Geometry Engine — parametric, real-time */}
        <IslamicGeometryEngine
          activePrayer={testPrayer || active?.key || 'fajr'}
          sunElevation={sunElevation}
          minutesToNext={secsToNext ? Math.floor(secsToNext / 60) : 60}
          lunarPhase={lunarPhase}
          theme={theme}
          ecoMode={ecoMode}
        />
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />

        {/* Header */}
        <Header
          masjidName={masjidName}
          screenLabel={screenLabel}
          logoDataUrl={logoDataUrl}
          locName={locName}
          hijri={hijri}
          onOpenSettings={openSettings}
          activePrayerKey={testPrayer || active?.key || 'fajr'}
          lunarPhase={lunarPhase}
          centerSlot={<HeaderQibla qibla={qibla} />}
        />

        {/* Grid */}
        <div className="grid">
          {/* Main row: prayer list + clock side-by-side (or stacked in portrait) */}
          <div className="grid-main">
            {/* Left: prayer list with Adhan + Iqamah */}
            <PrayerList
              todayTimes={todayTimes}
              iqamah={iqamah}
              active={active}
              now={now}
              cityTz={cityTz}
              isFriday={isFridayEffective}
              activeJumuahSlots={activeJumuahSlots}
              nextJumuah={nextJumuah}
              jumuahDate={jumuahDate}
              activeEidSlots={activeEidSlots}
              nextEid={nextEid}
              eidDate={eidDate}
              showEidBanner={showEidBanner}
              eidLabelAuto={eidLabelAuto}
              eidLocation={eidLocation}
              footerSlot={<WeatherStrip weather={weather} weatherState={weatherState} />}
            />

            {/* Centre: clock + countdown */}
            <Clock
              timeStr={timeStr}
              secStr={secStr}
              dateStr={dateStr}
              next={next}
              secsToNext={secsToNext}
              progressStyle={progressStyle}
              ringProgress={ringProgress}
              todayTimes={todayTimes}
              tomorrowTimes={tomorrowTimes}
              now={now}
              cityTz={cityTz}
              activeKey={active?.key}
              hadiths={HADITHS}
              topSlot={(() => {
                // Determine whether to show sun or moon arc:
                //   - testMoonActive forces moon (Test Moon button)
                //   - Otherwise: sun if currently between sunrise & sunset,
                //     moon otherwise (covers pre-dawn, dusk, and overnight)
                const sun = todayTimes?.sunrise;
                const set = todayTimes?.maghrib; // maghrib ≈ sunset
                const isDay = !testMoonActive && sun && set && now >= sun && now < set;
                return isDay ? (
                  <SunArc todayTimes={todayTimes} now={now} cityTz={cityTz} />
                ) : (
                  <MoonArc
                    lat={lat}
                    lng={lng}
                    now={now}
                    cityTz={cityTz}
                    phaseOverride={testMoonPhase}
                  />
                );
              })()}
              bottomSlot={
                <FastBar
                  todayTimes={todayTimes}
                  tomorrowTimes={tomorrowTimes}
                  now={now}
                  cityTz={cityTz}
                />
              }
            />
          </div>
          {/* end grid-main */}

          {/* (Bottom widget row removed — each widget now lives in its
              surrounding chrome: HeaderQibla in header, SunArc/MoonArc above
              clock, WeatherStrip below prayer list, FastBar under countdown.) */}
        </div>
        {/* end grid */}

        {/* App footer — outside .grid, always at bottom of .app */}
        <div className="app-footer">
          <Ticker
            announcements={mergedAnnouncements}
            mode={tickerMode}
            staticSeconds={tickerStaticSeconds}
            cityNow={cityNow}
          />
          <Footer
            showTestBtns={SHOW_TEST_BTNS}
            testFriday={testFriday}
            testPrayer={testPrayer}
            testBlackoutActive={!!testBlackoutUntil}
            testCountdownActive={!!testCountdownUntil}
            testMoonActive={testMoonActive}
            testMoonPhaseValue={testMoonPhase}
            testEidKind={testEidKind}
            activeKey={active?.key || 'fajr'}
            onToggleFriday={() => setTestFriday((f) => !f)}
            onCyclePrayer={(curKey) => {
              const cycle = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
              const cur = testPrayer || curKey || 'fajr';
              const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
              setTestPrayer(next);
            }}
            onClearPrayer={() => setTestPrayer(null)}
            onTestBlackout={() => {
              setBlackoutDismissedAt(null);
              setTestBlackoutUntil(new Date(Date.now() + 60 * 1000));
            }}
            onTestCountdown={() => {
              // 60-second window in the future — Clock will render its
              // .countdown-big mode (auto-triggered when secsToNext <= 60).
              setTestCountdownUntil(new Date(Date.now() + 60 * 1000));
            }}
            onToggleMoon={() => {
              // Test Moon — force the arc above the clock to render MoonArc
              // (with phase visualization) regardless of whether the sun
              // is up. Toggles off on second click.
              setTestMoonActive((m) => !m);
            }}
            onCyclePhase={() => {
              // Test Phase — cycle through 9 stops: real-phase (null),
              // new (0), waxing-crescent (.125), first-quarter (.25),
              // waxing-gibbous (.375), full (.5), waning-gibbous (.625),
              // last-quarter (.75), waning-crescent (.875), back to real.
              // Each click advances by one stop. Forces Test Moon ON so
              // the change is visible immediately.
              const stops = [null, 0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
              const idx = stops.indexOf(testMoonPhase);
              const nextIdx = (idx + 1) % stops.length;
              setTestMoonPhase(stops[nextIdx]);
              if (stops[nextIdx] != null) setTestMoonActive(true);
            }}
            onToggleTestFitr={() => {
              // Force-show Eid ul-Fitr banner. Toggles off on second click,
              // or switches from Adha to Fitr if Adha test was active.
              setTestEidKind((k) => (k === 'fitr' ? null : 'fitr'));
            }}
            onToggleTestAdha={() => {
              // Force-show Eid ul-Adha banner. Toggles off on second click,
              // or switches from Fitr to Adha if Fitr test was active.
              setTestEidKind((k) => (k === 'adha' ? null : 'adha'));
            }}
          />
        </div>
      </div>
      {/* end .app */}

      {/* (standalone footer removed — integrated into bottom-band above) */}

      {/* Audio unlock — handled silently by useAudioUnlock hook on first
          user gesture (any click anywhere). No visual banner; if chimes are
          enabled, the unlock happens automatically the first time anyone
          touches the dashboard, which is good enough for kiosk use. */}

      {/* PIN entry overlay */}
      <PinOverlay
        visible={showPin}
        input={pinInput}
        error={pinError}
        onChange={(v) => {
          setPinInput(v);
          setPinError(false);
        }}
        onSubmit={submitPin}
        onCancel={() => setShowPin(false)}
      />

      {/* Settings overlay — extracted to components/settings/SettingsPanel.jsx */}
      {showSett && (
        <SettingsPanel
          onCancel={() => setShowSett(false)}
          onApply={applySettings}
          draftMethod={draftMethod}
          setDraftMethod={setDraftMethod}
          draftAsr={draftAsr}
          setDraftAsr={setDraftAsr}
          draftIqamah={draftIqamah}
          setDraftIqamah={setDraftIqamah}
          draftIqamahAutoCalc={draftIqamahAutoCalc}
          setDraftIqamahAutoCalc={setDraftIqamahAutoCalc}
          draftIqamahAutoBuffers={draftIqamahAutoBuffers}
          setDraftIqamahAutoBuffers={setDraftIqamahAutoBuffers}
          draftJumuah={draftJumuah}
          setDraftJumuah={setDraftJumuah}
          draftEidFitr={draftEidFitr}
          setDraftEidFitr={setDraftEidFitr}
          draftEidAdha={draftEidAdha}
          setDraftEidAdha={setDraftEidAdha}
          draftEidDays={draftEidDays}
          setDraftEidDays={setDraftEidDays}
          draftEidLocation={draftEidLocation}
          setDraftEidLocation={setDraftEidLocation}
          draftHijri={draftHijri}
          setDraftHijri={setDraftHijri}
          draftHighLat={draftHighLat}
          setDraftHighLat={setDraftHighLat}
          draftTheme={draftTheme}
          setDraftTheme={setDraftTheme}
          draftEcoMode={draftEcoMode}
          setDraftEcoMode={setDraftEcoMode}
          draftChimeAdhan={draftChimeAdhan}
          setDraftChimeAdhan={setDraftChimeAdhan}
          draftChimeIqamah={draftChimeIqamah}
          setDraftChimeIqamah={setDraftChimeIqamah}
          draftFontScale={draftFontScale}
          setDraftFontScale={setDraftFontScale}
          draftProgress={draftProgress}
          setDraftProgress={setDraftProgress}
          draftMasjid={draftMasjid}
          setDraftMasjid={setDraftMasjid}
          draftScreenLabel={draftScreenLabel}
          setDraftScreenLabel={setDraftScreenLabel}
          draftLogo={draftLogo}
          setDraftLogo={setDraftLogo}
          draftLang={draftLang}
          setDraftLang={setDraftLang}
          draftAutoAnnouncements={draftAutoAnnouncements}
          setDraftAutoAnnouncements={setDraftAutoAnnouncements}
          draftAnnouncements={draftAnnouncements}
          setDraftAnnouncements={setDraftAnnouncements}
          draftTickerMode={draftTickerMode}
          setDraftTickerMode={setDraftTickerMode}
          draftTickerStaticSeconds={draftTickerStaticSeconds}
          setDraftTickerStaticSeconds={setDraftTickerStaticSeconds}
          draftBlackoutEnabled={draftBlackoutEnabled}
          setDraftBlackoutEnabled={setDraftBlackoutEnabled}
          draftBlackoutDurations={draftBlackoutDurations}
          setDraftBlackoutDurations={setDraftBlackoutDurations}
          draftBlackoutOpacity={draftBlackoutOpacity}
          setDraftBlackoutOpacity={setDraftBlackoutOpacity}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchStatus={searchStatus}
          onSearchInput={handleSearchInput}
          onSelectCity={handleSelectCity}
          onClearCity={() => {
            setSelectedCity(null);
            setSearchQuery('');
            setSearchStatus('idle');
          }}
          selectedCity={selectedCity}
          onGeolocate={geolocate}
          onExportSettings={exportSettings}
          onImportSettings={importSettings}
          onResetSettings={resetSettings}
          onPrintSchedule={() => {
            setShowSett(false);
            setShowPrint(true);
          }}
          cityNow={cityNow}
          cityTz={cityTz}
          currentLocName={locName}
          currentLat={lat}
          currentLng={lng}
          todayTimes={todayTimes}
        />
      )}

      {/* Blackout overlay — full-viewport during salah. Rendered LAST so its
          z-index sits above everything else including PinOverlay/SettingsPanel.
          When active, it covers them too (preventing accidental Settings
          interaction during prayer). */}
      <BlackoutOverlay
        active={blackout.active}
        endsAt={blackout.endsAt}
        now={now}
        opacity={blackoutOpacity}
        onDismiss={() => setBlackoutDismissedAt(new Date())}
      />
    </>
  );
}

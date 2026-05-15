import { useState, useEffect, useMemo, useRef } from 'react';
import {
  METHOD_LABELS,
  HADITHS,
  GEO_API,
  SETTINGS_PIN,
  SHOW_TEST_BTNS,
} from './lib/constants.js';
import { calcQibla, tzOffsetHours } from './lib/prayerCalc.js';
import { toHijri } from './lib/hijri.js';
import { addMins } from './lib/formatters.js';
import { buildThemeVars } from './lib/themes.js';

// Custom hooks — pure logic extracted to their own files
import useCityTime     from './hooks/useCityTime.js';
import usePrayerTimes  from './hooks/usePrayerTimes.js';
import useWeather      from './hooks/useWeather.js';
import useAudioUnlock  from './hooks/useAudioUnlock.js';
import useChime        from './hooks/useChime.js';
import useLunarPhase   from './hooks/useLunarPhase.js';
import useBlackoutMode from './hooks/useBlackoutMode.js';

// Settings context — wraps applied + draft state, persists to localStorage
import { useSettings } from './context/SettingsContext.jsx';
import { useT }        from './i18n/I18nContext.jsx';

// Visual components — extracted to their own files
import Header              from './components/Header.jsx';
import Footer              from './components/Footer.jsx';
import Ticker              from './components/Ticker.jsx';
import BlackoutOverlay     from './components/BlackoutOverlay.jsx';
import Clock               from './components/Clock.jsx';
import PrayerList          from './components/PrayerList.jsx';
import AudioUnlockBanner   from './components/AudioUnlockBanner.jsx';
import PinOverlay          from './components/PinOverlay.jsx';
import SettingsPanel       from './components/settings/SettingsPanel.jsx';
import WeatherCard         from './components/widgets/WeatherCard.jsx';
import SunDayCycle         from './components/widgets/SunDayCycle.jsx';
import FastQiblaCard       from './components/widgets/FastQiblaCard.jsx';

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

export default function App() {
  // ── Persistent settings via React Context ──────────────────────────────
  // applied = currently in effect; drafts = what the Settings panel edits.
  // localStorage is owned by the SettingsProvider — direct setters here
  // (e.g. setLat from geolocation) call updateApplied which persists.
  const {
    applied,
    drafts,
    updateApplied,
    updateDrafts,
    beginEditing,
  } = useSettings();

  // Translation hook — used for alerts and any inline strings rendered
  // directly from App.jsx. Most translated text lives in child components
  // that call useT() themselves.
  const { t } = useT();

  // Destructure applied → individual reactive values used throughout App.jsx
  const {
    lat, lng, locName, masjidName, cityTz,
    method, shadow, highLatRule,
    iqamah, jumuah, eid, eidDaysBefore,
    hijriOffset, theme, chimeAdhan, chimeIqamah, fontScale, progressStyle,
    announcements,
    blackoutEnabled, blackoutLeadSeconds, blackoutDurations, blackoutOpacity,
  } = applied;

  // Setter shims — preserve the existing setLat/setMethod/etc API so the
  // rest of App.jsx (still using direct-style mutations) keeps working.
  // Each shim spreads {key:value} into updateApplied which merges + persists.
  const setLat          = v => updateApplied({ lat: v });
  const setLng          = v => updateApplied({ lng: v });
  const setLocName      = v => updateApplied({ locName: v });
  const setMasjidName   = v => updateApplied({ masjidName: v });
  const setCityTz       = v => updateApplied({ cityTz: v });
  const setMethod       = v => updateApplied({ method: v });
  const setShadow       = v => updateApplied({ shadow: v });
  const setIqamah       = v => updateApplied({ iqamah: v });
  const setJumuah       = v => updateApplied({ jumuah: v });
  const setEid          = v => updateApplied({ eid: v });
  const setEidDaysBefore= v => updateApplied({ eidDaysBefore: v });
  const setHijriOffset  = v => updateApplied({ hijriOffset: v });
  const setTheme        = v => updateApplied({ theme: v });
  const setChimeAdhan   = v => updateApplied({ chimeAdhan: v });
  const setChimeIqamah  = v => updateApplied({ chimeIqamah: v });
  const setFontScale    = v => updateApplied({ fontScale: v });
  const setProgressStyle= v => updateApplied({ progressStyle: v });

  // Draft mirror — destructure drafts. Each `setDraftX(value)` updates ONE
  // field via updateDrafts. The shims accept either a value or a function
  // (prev → next). Using updateDrafts's functional form keeps multiple
  // sequential updates within the same tick race-safe.
  const draftMethod   = drafts.method;
  const draftAsr      = drafts.shadow === 2 ? 'Hanafi' : 'Standard';
  const draftIqamah   = drafts.iqamah;
  const draftJumuah   = drafts.jumuah;
  const draftEid      = drafts.eid;
  const draftEidDays  = drafts.eidDaysBefore;
  const draftHijri    = drafts.hijriOffset;
  const draftHighLat  = drafts.highLatRule;
  const draftTheme    = drafts.theme;
  const draftChimeAdhan  = drafts.chimeAdhan;
  const draftChimeIqamah = drafts.chimeIqamah;
  const draftFontScale= drafts.fontScale;
  const draftProgress = drafts.progressStyle;
  const draftLang     = drafts.lang;
  const draftAnnouncements = drafts.announcements;
  const draftBlackoutEnabled   = drafts.blackoutEnabled;
  const draftBlackoutDurations = drafts.blackoutDurations;
  const draftBlackoutOpacity   = drafts.blackoutOpacity;
  // Simple shims — each updates a single field with race-safe functional form
  const setDraftMethod    = v => updateDrafts(prev => ({ ...prev, method:        typeof v === 'function' ? v(prev.method)        : v }));
  const setDraftIqamah    = v => updateDrafts(prev => ({ ...prev, iqamah:        typeof v === 'function' ? v(prev.iqamah)        : v }));
  const setDraftJumuah    = v => updateDrafts(prev => ({ ...prev, jumuah:        typeof v === 'function' ? v(prev.jumuah)        : v }));
  const setDraftEid       = v => updateDrafts(prev => ({ ...prev, eid:           typeof v === 'function' ? v(prev.eid)           : v }));
  const setDraftEidDays   = v => updateDrafts(prev => ({ ...prev, eidDaysBefore: typeof v === 'function' ? v(prev.eidDaysBefore) : v }));
  const setDraftHijri     = v => updateDrafts(prev => ({ ...prev, hijriOffset:   typeof v === 'function' ? v(prev.hijriOffset)   : v }));
  const setDraftHighLat   = v => updateDrafts(prev => ({ ...prev, highLatRule:   typeof v === 'function' ? v(prev.highLatRule)   : v }));
  const setDraftTheme     = v => updateDrafts(prev => ({ ...prev, theme:         typeof v === 'function' ? v(prev.theme)         : v }));
  const setDraftChimeAdhan  = v => updateDrafts(prev => ({ ...prev, chimeAdhan:  typeof v === 'function' ? v(prev.chimeAdhan)  : v }));
  const setDraftChimeIqamah = v => updateDrafts(prev => ({ ...prev, chimeIqamah: typeof v === 'function' ? v(prev.chimeIqamah) : v }));
  const setDraftFontScale = v => updateDrafts(prev => ({ ...prev, fontScale:     typeof v === 'function' ? v(prev.fontScale)     : v }));
  const setDraftProgress  = v => updateDrafts(prev => ({ ...prev, progressStyle: typeof v === 'function' ? v(prev.progressStyle) : v }));
  const setDraftLang      = v => updateDrafts(prev => ({ ...prev, lang:          typeof v === 'function' ? v(prev.lang)          : v }));
  const setDraftAnnouncements = v => updateDrafts(prev => ({ ...prev, announcements: typeof v === 'function' ? v(prev.announcements) : v }));
  const setDraftBlackoutEnabled   = v => updateDrafts(prev => ({ ...prev, blackoutEnabled:   typeof v === 'function' ? v(prev.blackoutEnabled)   : v }));
  const setDraftBlackoutDurations = v => updateDrafts(prev => ({ ...prev, blackoutDurations: typeof v === 'function' ? v(prev.blackoutDurations) : v }));
  const setDraftBlackoutOpacity   = v => updateDrafts(prev => ({ ...prev, blackoutOpacity:   typeof v === 'function' ? v(prev.blackoutOpacity)   : v }));
  // Asr translates Hanafi/Standard ↔ shadow 1/2
  const setDraftAsr = v => updateDrafts(prev => {
    const prevLabel = prev.shadow === 2 ? 'Hanafi' : 'Standard';
    const nextLabel = typeof v === 'function' ? v(prevLabel) : v;
    return { ...prev, shadow: nextLabel === 'Hanafi' ? 2 : 1 };
  });

  // ── Non-persistent UI state (stays local — not part of settings) ────────
  const [draftMasjid, setDraftMasjid] = useState('');
  const [testFriday,  setTestFriday]  = useState(false);
  const [testPrayer,  setTestPrayer]  = useState(null); // null = use real active prayer
  const [testBlackoutUntil, setTestBlackoutUntil] = useState(null); // Date | null
  const [showPin,    setShowPin]    = useState(false);
  const [pinInput,   setPinInput]   = useState('');
  const [pinError,   setPinError]   = useState(false);
  const [showSett,   setShowSett]   = useState(false);
  // City search state
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus,  setSearchStatus]  = useState('idle'); // idle|searching|done|error
  const [selectedCity,  setSelectedCity]  = useState(null);  // { name, country, lat, lng }
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
  const { audioReady, setAudioReady } = useAudioUnlock();

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
  }, [now, testBlackoutUntil]);

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
      pos => {
        // Batch all geolocation fields into one updateApplied — saves to
        // localStorage exactly once and triggers a single re-render.
        let tz = null;
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
        updateApplied({
          lat:     pos.coords.latitude,
          lng:     pos.coords.longitude,
          locName: `${pos.coords.latitude.toFixed(2)}°N  ${pos.coords.longitude.toFixed(2)}°E`,
          ...(tz ? { cityTz: tz } : {}),
        });
      },
      () => {}
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Weather fetch is owned by useWeather hook above)

  // ── Single source of truth: NOW in the selected city's timezone ────────
  // (Owned by useCityTime hook — gives us `now`, `cityNow`, `cityNowParts`, `isFriday`)

  // Prayer times + active/next/ringProgress derivation
  const {
    todayTimes,
    tomorrowTimes,
    yesterdayTimes,
    active,
    activeStart,
    next,
    secsToNext,
    ringProgress,
  } = usePrayerTimes({ cityNow, now, lat, lng, method, shadow, cityTz, highLatRule });

  // Display helpers — recalc only when needed
  // CRITICAL: clock must show the CITY's local time (not device's local time),
  // so prayer times and the displayed clock always match. We extract h/m/s
  // for the city's timezone via Intl.DateTimeFormat.
  const h12     = cityNowParts.h % 12 || 12;
  const timeStr = `${h12}:${String(cityNowParts.m).padStart(2, '0')}`;
  const secStr  = `:${String(cityNowParts.s).padStart(2, '0')} ${cityNowParts.h >= 12 ? 'PM' : 'AM'}`;
  const dateStr = `${cityNowParts.weekday}, ${cityNowParts.monthName} ${cityNowParts.dayNum}, ${cityNowParts.yearNum}`;
  const hijri = useMemo(() => {
    if (hijriOffset === 0) return toHijri(cityNow);
    const adjusted = new Date(cityNow);
    adjusted.setDate(adjusted.getDate() + hijriOffset);
    return toHijri(adjusted) + (hijriOffset !== 0 ? ` (${hijriOffset > 0 ? '+' : ''}${hijriOffset})` : '');
  }, [cityNow.toDateString(), hijriOffset]);
  const qibla   = useMemo(() => Math.round(calcQibla(lat, lng)), [lat, lng]);

  const dayMins = todayTimes.sunrise && todayTimes.maghrib
    ? Math.round((todayTimes.maghrib - todayTimes.sunrise) / 60000)
    : null;

  // ── Parametric inputs for IslamicGeometryEngine ──────────────────────────
  // Sun elevation: 0° = horizon, +90° = zenith, negative = below horizon
  // Approximated from current time relative to sunrise/solar-noon/sunset
  const sunElevation = useMemo(() => {
    const sr = todayTimes.sunrise, ss = todayTimes.maghrib;
    if (!sr || !ss) return -10;
    const nowMs = now.getTime();
    const srMs  = sr.getTime(), ssMs = ss.getTime();
    if (nowMs < srMs || nowMs > ssMs) {
      // Night — interpolate descent below horizon (max -18° astronomical twilight)
      return nowMs < srMs
        ? -18 + 18 * (nowMs - (srMs - 3600000)) / 3600000
        : -18 * Math.min(1, (nowMs - ssMs) / 3600000);
    }
    // Day — sine arc peaking at solar noon
    const noon   = (srMs + ssMs) / 2;
    const half   = (ssMs - srMs) / 2;
    const maxEl  = 90 - Math.abs(lat - 23.5); // approximate max elevation
    return maxEl * Math.sin(Math.PI * (nowMs - srMs) / (ssMs - srMs));
  }, [now, todayTimes, lat]);

  // Lunar phase — owned by useLunarPhase hook (computed from Hijri day)
  const lunarPhase = useLunarPhase(hijri);

  // Blackout mode — derives whether the dashboard should be in salah-blackout
  // RIGHT NOW based on today's & yesterday's iqamah times + per-prayer
  // durations from settings. Returns null/null when inactive (overlay
  // renders nothing). See src/hooks/useBlackoutMode.js for the windowing
  // logic + how yesterday's Isha edge case is handled.
  const blackout = useBlackoutMode({
    enabled:        blackoutEnabled,
    leadSeconds:    blackoutLeadSeconds,
    durations:      blackoutDurations,
    todayTimes,
    yesterdayTimes,
    iqamah,
    now,
    dismissedAt:    blackoutDismissedAt,
    forceUntil:     testBlackoutUntil,
  });

  // Jumu'ah / Eid date helpers — must produce ABSOLUTE UTC instants whose
  // wall-clock value in the city's timezone equals (today_in_city @ HH:MM).
  // Same trick as calcTimes: Date.UTC(...) - cityTzOffset_ms.
  const cityTzOff = useMemo(
    () => tzOffsetHours(cityTz, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityTz, now.toDateString()]
  );
  function makeCityDateAt(hh, mm) {
    const Y = cityNow.getFullYear();
    const M = cityNow.getMonth();
    const D = cityNow.getDate();
    return new Date(Date.UTC(Y, M, D, hh, mm, 0) - cityTzOff * 3600 * 1000);
  }

  // Jumu'ah — Friday is the CITY's day-of-week (or testFriday override for QA)
  const isFridayEffective = isFriday || testFriday;
  const activeJumuahSlots = jumuah.filter(j => j.enabled);
  function jumuahDate(timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number);
    return makeCityDateAt(hh, mm);
  }
  // Compare absolute instants against the absolute `now`
  const nextJumuah = isFridayEffective
    ? activeJumuahSlots.map(j => jumuahDate(j.time)).find(t => t > now) ?? null
    : null;

  // Eid helpers — same approach
  const activeEidSlots = eid.filter(e => e.enabled);
  function eidDate(timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number);
    return makeCityDateAt(hh, mm);
  }
  const lastEidTime  = activeEidSlots.length
    ? eidDate(activeEidSlots[activeEidSlots.length - 1].time)
    : null;
  const eidIqamahEnd = lastEidTime
    ? addMins(lastEidTime, activeEidSlots[activeEidSlots.length - 1]?.iqamah ?? 20)
    : null;
  // Banner — all comparisons against absolute `now`
  const showEidBanner = activeEidSlots.length > 0 && (() => {
    if (!eidIqamahEnd) return false;
    const firstEidTime = eidDate(activeEidSlots[0].time);
    const msBefore = firstEidTime - now;
    const daysUntil = msBefore / (1000 * 60 * 60 * 24);
    if (daysUntil > 0 && daysUntil <= eidDaysBefore) return true;
    if (daysUntil <= 0) return addMins(eidIqamahEnd, 30) > now;
    return false;
  })();
  const nextEid = showEidBanner
    ? activeEidSlots.map(e => eidDate(e.time)).find(t => t > now) ?? null
    : null;

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

  function openSettings() {
    if (SETTINGS_PIN) {
      // Always ask PIN — never cache the unlock
      setPinInput(''); setPinError(false); setShowPin(true); return;
    }
    _doOpenSettings();
  }

  function _doOpenSettings() {
    // Snapshot applied → drafts so the panel starts from the current state
    beginEditing();
    // Also reset the non-persistent UI state (search, masjid name preview)
    setDraftMasjid(masjidName);
    setSearchQuery('');
    setSearchResults([]);
    setSearchStatus('idle');
    setSelectedCity(null);
    setShowSett(true);
  }

  function submitPin() {
    if (pinInput === SETTINGS_PIN) {
      setShowPin(false);
      _doOpenSettings();
    } else {
      setPinError(true); setPinInput('');
    }
  }

  async function handleSearchInput(q) {
    setSearchQuery(q);
    setSelectedCity(null);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); setSearchStatus('idle'); return; }
    setSearchStatus('searching');
    searchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${GEO_API}?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`);
        const data = await res.json();
        const results = (data.results || []).map(r => ({
          id:      r.id,
          name:    r.name,
          country: r.country || '',
          admin1:  r.admin1 || '',
          lat:     r.latitude,
          lng:     r.longitude,
          tz:      r.timezone || '',
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

  function applySettings() {
    // Clamp/sanitize drafts before applying. The Settings panel inputs let
    // users type freely; we enforce ranges here at commit time.
    const sanitizedIqamah = Object.fromEntries(
      Object.entries(drafts.iqamah).map(([k, v]) => [k, Math.min(60, Math.max(0, Number(v) || 0))])
    );
    const sanitizedJumuah = drafts.jumuah.map(j => ({
      ...j, iqamah: Math.min(60, Math.max(0, Number(j.iqamah) || 0)),
    }));
    const sanitizedEid = drafts.eid.map(e => ({
      ...e, iqamah: Math.min(60, Math.max(0, Number(e.iqamah) || 0)),
    }));
    const sanitizedDays  = Math.min(30, Math.max(0, Number(drafts.eidDaysBefore) || 0));
    const sanitizedHijri = Math.min(3,  Math.max(-3, Number(drafts.hijriOffset)  || 0));
    const sanitizedFont  = Math.min(130, Math.max(70, Number(drafts.fontScale)   || 100));
    // Blackout per-prayer durations: clamp 0..60 min. 0 = effectively disabled
    // for that prayer (window collapses to just the leadSeconds before iqamah).
    const sanitizedBlackoutDur = Object.fromEntries(
      Object.entries(drafts.blackoutDurations).map(([k, v]) => [k, Math.min(60, Math.max(0, Number(v) || 0))])
    );
    // Blackout opacity: clamp 0..100 percent.
    const sanitizedBlackoutOpacity = Math.min(100, Math.max(0, Number(drafts.blackoutOpacity) || 0));

    // Build the new applied state in one shot. City selection (if any)
    // overrides lat/lng/cityTz/locName since the city search bypasses drafts.
    const newMasjid = draftMasjid.trim();
    const newApplied = {
      ...drafts,
      iqamah:            sanitizedIqamah,
      jumuah:            sanitizedJumuah,
      eid:               sanitizedEid,
      eidDaysBefore:     sanitizedDays,
      hijriOffset:       sanitizedHijri,
      fontScale:         sanitizedFont,
      blackoutDurations: sanitizedBlackoutDur,
      blackoutOpacity:   sanitizedBlackoutOpacity,
      masjidName:        newMasjid,
    };
    if (selectedCity) {
      newApplied.lat     = selectedCity.lat;
      newApplied.lng     = selectedCity.lng;
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
      pos => {
        // Batch lat/lng/cityTz/locName into one update
        updateApplied({
          lat:     pos.coords.latitude,
          lng:     pos.coords.longitude,
          cityTz:  Intl.DateTimeFormat().resolvedOptions().timeZone,
          locName: `${pos.coords.latitude.toFixed(2)}°N  ${pos.coords.longitude.toFixed(2)}°E`,
        });
        setShowSett(false);
      },
      () => alert(t('alert.geoFailed'))
    );
  }

  return (
    <>
      <div className="app" style={{ '--t-fs': fontScale / 100 }}>
        {/* Islamic Geometry Engine — parametric, real-time */}
        <IslamicGeometryEngine
          activePrayer={testPrayer || active?.key || 'fajr'}
          sunElevation={sunElevation}
          minutesToNext={secsToNext ? Math.floor(secsToNext / 60) : 60}
          lunarPhase={lunarPhase}
          theme={theme}
        />
        <div className="corner tl"/><div className="corner tr"/>
        <div className="corner bl"/><div className="corner br"/>

        {/* Header */}
        <Header
          masjidName={masjidName}
          locName={locName}
          hijri={hijri}
          method={method}
          activePrayerKey={testPrayer || active?.key || 'fajr'}
          lunarPhase={lunarPhase}
        />

        {/* Grid */}
        <div className="grid">

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
          />

          {/* Bottom band: widgets + integrated status strip (replaces standalone footer) */}
          <div className="bottom-band">
            <div className="rcol">

            {/* ── Weather ── */}
            <WeatherCard weather={weather} weatherState={weatherState}/>

            {/* ── Sun Day Cycle ── */}
            <SunDayCycle
              todayTimes={todayTimes}
              now={now}
              cityTz={cityTz}
              dayMins={dayMins}
            />

            {/* ── Today's Fast + Qibla merged ── */}
            <FastQiblaCard
              todayTimes={todayTimes}
              now={now}
              cityTz={cityTz}
              qibla={qibla}
            />

          </div>
            {/* Announcement ticker — sits between widget row and status strip.
                Renders nothing when announcements is empty (default). */}
            <Ticker announcements={announcements}/>

            {/* Status strip — inside the bottom band, sits below the widget cards */}
            <Footer
              method={method}
              showTestBtns={SHOW_TEST_BTNS}
              testFriday={testFriday}
              testPrayer={testPrayer}
              testBlackoutActive={!!testBlackoutUntil}
              activeKey={active?.key || 'fajr'}
              onOpenSettings={openSettings}
              onToggleFriday={() => setTestFriday(f => !f)}
              onCyclePrayer={(curKey) => {
                const cycle = ['fajr','sunrise','dhuhr','asr','maghrib','isha'];
                const cur = testPrayer || curKey || 'fajr';
                const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                setTestPrayer(next);
              }}
              onClearPrayer={() => setTestPrayer(null)}
              onTestBlackout={() => {
                // 60-second test window. Resets blackoutDismissedAt so a prior
                // dismiss doesn't suppress the test.
                setBlackoutDismissedAt(null);
                setTestBlackoutUntil(new Date(Date.now() + 60 * 1000));
              }}
            />
          </div>{/* end bottom-band */}
        </div>{/* end grid */}
      </div>{/* end .app */}

      {/* (standalone footer removed — integrated into bottom-band above) */}


      {/* Audio unlock banner — shows only when chimes are on but browser hasn't
          received any user interaction yet. Disappears on first interaction. */}
      <AudioUnlockBanner
        visible={(chimeAdhan || chimeIqamah) && !audioReady}
        onUnlock={() => setAudioReady(true)}
      />

      {/* PIN entry overlay */}
      {/* PIN entry overlay */}
      <PinOverlay
        visible={showPin}
        input={pinInput}
        error={pinError}
        onChange={v => { setPinInput(v); setPinError(false); }}
        onSubmit={submitPin}
        onCancel={() => setShowPin(false)}
      />

      {/* Settings overlay — extracted to components/settings/SettingsPanel.jsx */}
      <SettingsPanel
        visible={showSett}
        onCancel={() => setShowSett(false)}
        onApply={applySettings}
        draftMethod={draftMethod}    setDraftMethod={setDraftMethod}
        draftAsr={draftAsr}          setDraftAsr={setDraftAsr}
        draftIqamah={draftIqamah}    setDraftIqamah={setDraftIqamah}
        draftJumuah={draftJumuah}    setDraftJumuah={setDraftJumuah}
        draftEid={draftEid}          setDraftEid={setDraftEid}
        draftEidDays={draftEidDays}  setDraftEidDays={setDraftEidDays}
        draftHijri={draftHijri}      setDraftHijri={setDraftHijri}
        draftHighLat={draftHighLat}  setDraftHighLat={setDraftHighLat}
        draftTheme={draftTheme}      setDraftTheme={setDraftTheme}
        draftChimeAdhan={draftChimeAdhan}    setDraftChimeAdhan={setDraftChimeAdhan}
        draftChimeIqamah={draftChimeIqamah}  setDraftChimeIqamah={setDraftChimeIqamah}
        draftFontScale={draftFontScale}  setDraftFontScale={setDraftFontScale}
        draftProgress={draftProgress}    setDraftProgress={setDraftProgress}
        draftMasjid={draftMasjid}    setDraftMasjid={setDraftMasjid}
        draftLang={draftLang}        setDraftLang={setDraftLang}
        draftAnnouncements={draftAnnouncements}  setDraftAnnouncements={setDraftAnnouncements}
        draftBlackoutEnabled={draftBlackoutEnabled}      setDraftBlackoutEnabled={setDraftBlackoutEnabled}
        draftBlackoutDurations={draftBlackoutDurations}  setDraftBlackoutDurations={setDraftBlackoutDurations}
        draftBlackoutOpacity={draftBlackoutOpacity}      setDraftBlackoutOpacity={setDraftBlackoutOpacity}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchStatus={searchStatus}
        onSearchInput={handleSearchInput}
        onSelectCity={handleSelectCity}
        onClearCity={() => { setSelectedCity(null); setSearchQuery(''); setSearchStatus('idle'); }}
        selectedCity={selectedCity}
        onGeolocate={geolocate}
        cityNow={cityNow}
        cityTz={cityTz}
        currentLocName={locName}
        currentLat={lat}
        currentLng={lng}
        todayTimes={todayTimes}
      />

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

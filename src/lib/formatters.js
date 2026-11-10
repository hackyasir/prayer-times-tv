// ── Display formatters — pure functions, no React ────────────────────────────
//
// These are presentation helpers that take a Date/number and return display
// strings. All deliberately pure: same input → same output, no side effects,
// no state. Reusable from any component.

import { COMPASS_16, COMPASS_LONG } from './constants.js';

// Intl.DateTimeFormat objects are slow to create — notably on smart-TV
// browsers — and fmt12 runs dozens of times per screen update. Keep one
// formatter per timezone and reuse it. (An invalid zone throws on creation;
// that isn't cached, so the caller's fallback still applies.)
const hourMinuteFormatters = new Map();
function hourMinuteFormatter(tz) {
  let fmt = hourMinuteFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    hourMinuteFormatters.set(tz, fmt);
  }
  return fmt;
}

/**
 * Format an absolute Date as "h:mm AM/PM" in a specific IANA timezone.
 * If `tz` is omitted, falls back to the device's local timezone.
 *
 * This is the single source of truth for displaying prayer/iqamah/sun times.
 * Every callsite should pass the CITY's timezone so display matches wall-clock,
 * regardless of where the device is physically located.
 */
export function fmt12(date, tz) {
  if (!date) return '--:--';
  try {
    if (tz) {
      const parts = hourMinuteFormatter(tz).formatToParts(date);
      const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
      // Intl.DateTimeFormat with hour12:false can return "24" for midnight
      // on some platforms (Node 18+ / V8 newer than ~10.x) instead of "00".
      // Normalize: 24 → 0 so the AM/PM check below picks AM, not PM.
      let h = parseInt(get('hour'), 10);
      if (h === 24) h = 0;
      const m = parseInt(get('minute'), 10);
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    }
  } catch {
    /* fall through to device-local */
  }
  const h = date.getHours(),
    m = date.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/**
 * Add N minutes to a Date, returning a new Date (does not mutate original).
 * Used for iqamah offset (adhan + N minutes).
 */
export function addMins(date, mins) {
  if (!date || mins == null) return null;
  return new Date(date.getTime() + mins * 60000);
}

/**
 * Format a duration in seconds as HH:MM:SS. Returns "00:00:00" for zero/negative.
 * Used for the "Until next prayer" countdown.
 */
export function fmtCountdown(secs) {
  if (secs <= 0) return '00:00:00';
  return [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60]
    .map((x) => String(x).padStart(2, '0'))
    .join(':');
}

/**
 * Like fmtCountdown, but MM:SS when under an hour ("08:12"). Used for the
 * iqamah countdown, which is nearly always minutes away.
 */
export function fmtCountdownShort(secs) {
  if (secs >= 3600) return fmtCountdown(secs);
  const s = Math.max(0, Math.floor(secs));
  return [Math.floor(s / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
}

/**
 * Convert a compass bearing (degrees 0..360) to a 16-point cardinal name.
 *   0° → N,  22.5° → NNE,  45° → NE,  ... ,  337.5° → NNW
 */
export function bearingToCompass(deg) {
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_16[i];
}

/**
 * Long-form compass direction for display.
 *   45°  → "Northeast"
 *   180° → "South"
 *   337° → "North-Northwest"
 */
export function bearingToCompassLong(deg) {
  return COMPASS_LONG[bearingToCompass(deg)] || 'North';
}

// ── Display formatters — pure functions, no React ────────────────────────────
//
// These are presentation helpers that take a Date/number and return display
// strings. All deliberately pure: same input → same output, no side effects,
// no state. Reusable from any component.

import { COMPASS_16, COMPASS_LONG } from './constants.js';

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
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        hour: '2-digit', minute: '2-digit',
      }).formatToParts(date);
      const get = (t) => parts.find(p => p.type === t)?.value ?? '';
      const h = parseInt(get('hour'), 10);
      const m = parseInt(get('minute'), 10);
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    }
  } catch { /* fall through to device-local */ }
  const h = date.getHours(), m = date.getMinutes();
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
    .map(x => String(x).padStart(2, '0')).join(':');
}

/**
 * Convert a compass bearing (degrees 0..360) to a 16-point cardinal name.
 *   0° → N,  22.5° → NNE,  45° → NE,  ... ,  337.5° → NNW
 */
export function bearingToCompass(deg) {
  const i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
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

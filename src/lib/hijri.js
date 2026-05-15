// ── Hijri (Islamic lunar) calendar conversion ────────────────────────────────
// Pure JS. Uses the tabular Islamic calendar algorithm (Umm al-Qura
// approximation) — accurate to ±1 day depending on lunar sighting.
//
// Many masjids use slightly different conventions, so the dashboard also
// exposes a ±3 day offset adjustment so admins can match their local
// authority's published Hijri date.

import { HIJRI_MONTHS } from './constants.js';

function julianDate(y, m, d) {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/**
 * Convert a Gregorian Date to its tabular Hijri date string.
 * Reads .getFullYear/.getMonth/.getDate, so caller should pass a Date
 * whose local components match the desired calendar day.
 *
 * @param {Date} date
 * @returns {string} e.g. "26 Dhu al-Qi'dah 1447 AH"
 */
export function toHijri(date) {
  const jd  = Math.floor(julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) + 0.5);
  const l   = jd - 1948440 + 10632;
  const n   = Math.floor((l - 1) / 10631);
  const ll  = l - 10631 * n + 354;
  const j   = Math.floor((10985 - ll) / 5316) * Math.floor((50 * ll) / 17719) +
              Math.floor(ll / 5670) * Math.floor((43 * ll) / 15238);
  const ll2 = ll
    - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * ll2) / 709);
  const d = ll2 - Math.floor((709 * m) / 24);
  const y = 30 * n + j - 30;
  return `${d} ${HIJRI_MONTHS[m - 1]} ${y} AH`;
}

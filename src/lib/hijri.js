// ── Hijri (Islamic lunar) calendar conversion ────────────────────────────────
// Pure JS. Uses the tabular Islamic calendar algorithm (Umm al-Qura
// approximation) — accurate to ±1 day depending on lunar sighting.
//
// Many masjids use slightly different conventions, so the dashboard also
// exposes a ±3 day offset adjustment so admins can match their local
// authority's published Hijri date.

import { HIJRI_MONTHS } from './constants.js';

function julianDate(y, m, d) {
  if (m <= 2) {
    y--;
    m += 12;
  }
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
  const { d, m, y } = toHijriParts(date);
  return `${d} ${HIJRI_MONTHS[m - 1]} ${y} AH`;
}

/**
 * Same tabular Hijri conversion as toHijri but returns the raw {d, m, y}
 * parts instead of a formatted string. Used for date comparisons (e.g.
 * checking whether a future Gregorian date falls on Shawwal-1 / Eid ul-Fitr).
 *
 * @param {Date} date
 * @returns {{ d: number, m: number, y: number }}
 *   d = day of Hijri month (1-30)
 *   m = month number (1-12, where 10 = Shawwal, 12 = Dhu al-Hijjah)
 *   y = Hijri year
 */
export function toHijriParts(date) {
  const jd = Math.floor(julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) + 0.5);
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const ll = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - ll) / 5316) * Math.floor((50 * ll) / 17719) +
    Math.floor(ll / 5670) * Math.floor((43 * ll) / 15238);
  const ll2 =
    ll -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const m = Math.floor((24 * ll2) / 709);
  const d = ll2 - Math.floor((709 * m) / 24);
  const y = 30 * n + j - 30;
  return { d, m, y };
}

/**
 * Look ahead `maxDays` Gregorian days from `now` and check if Eid ul-Fitr
 * (1 Shawwal) or Eid ul-Adha (10 Dhu al-Hijjah) falls within that window.
 *
 * Why this matters: the dashboard's Eid banner activates X days before
 * the actual Eid date so worshippers see the upcoming prayer schedule.
 * Without this, staff would need to manually flip a toggle around every
 * Eid — twice a year, easy to forget. Auto-detection means "set it up
 * once, banner appears every Eid".
 *
 * Hijri month numbers used:
 *   10 = Shawwal       → Eid ul-Fitr begins on the 1st
 *   12 = Dhu al-Hijjah → Eid ul-Adha is on the 10th
 *
 * @param {Date}   now         Current Gregorian date (typically today's)
 * @param {number} hijriOffset ±days offset for local Hijri convention
 *                             (mirrors the user's main hijriOffset setting,
 *                             which compensates for regional moon-sighting
 *                             differences vs the tabular calculation)
 * @param {number} maxDays     How far ahead to look (typically eidDaysBefore)
 * @returns {{
 *   kind: 'fitr' | 'adha' | null,
 *   eidDate: Date | null,
 *   daysUntil: number | null,
 * }}
 *   kind     = which Eid is approaching (or null if none in window)
 *   eidDate  = the Gregorian date on which Eid falls
 *   daysUntil = number of whole days from `now` to eidDate (0 = today)
 */
export function findUpcomingEid(now, hijriOffset = 0, maxDays = 7) {
  // The user's `hijriOffset` setting says "my local mosque considers today
  // to be N days AHEAD of (or behind) the tabular Hijri calculation".
  // For example, +2 means tabular says 1 Dhu al-Hijjah but the user's
  // mosque considers it 3 Dhu al-Hijjah (offset commonly compensates for
  // moon-sighting differences between regions).
  //
  // To detect Eid, we want to find the date when the USER'S calendar reads
  // 1 Shawwal (Fitr) or 10 Dhu al-Hijjah (Adha). So we ADD the offset to
  // the tabular result before comparing.
  //
  // Care needed at month boundaries: if tabular says day 28 + offset 3 = 31,
  // that's out-of-range (Hijri months are 29 or 30 days). For Eid detection
  // we only check exact target days (1 or 10), and those are early in the
  // month so we won't wrap past month-end with reasonable offsets.
  const offsetDay = 1000 * 60 * 60 * 24;
  for (let i = 0; i <= maxDays; i++) {
    const probe = new Date(now.getTime() + i * offsetDay);
    const { d, m } = toHijriParts(probe);
    const userDay = d + hijriOffset; // what THIS date reads on the user's calendar

    // Eid ul-Fitr — 1 Shawwal (month 10)
    if (m === 10 && userDay === 1) {
      const eidDate = new Date(probe);
      eidDate.setHours(0, 0, 0, 0);
      return { kind: 'fitr', eidDate, daysUntil: i };
    }
    // Eid ul-Adha — 10 Dhu al-Hijjah (month 12)
    if (m === 12 && userDay === 10) {
      const eidDate = new Date(probe);
      eidDate.setHours(0, 0, 0, 0);
      return { kind: 'adha', eidDate, daysUntil: i };
    }
    // Handle negative-offset wrap into PREVIOUS month: if hijriOffset is
    // negative and userDay becomes ≤ 0, we may be on the LAST day of the
    // previous tabular month but the FIRST day of the user's Shawwal /
    // Dhu al-Hijjah. We accept either reading.
    // (Positive offset wrap to next month is rare for d=1 or d=10 with
    // reasonable offsets so we don't handle it here.)
    if (hijriOffset < 0) {
      // tabular says we're still in month (m-1), but user considers it month m
      const userMonth = userDay <= 0 ? (m === 1 ? 12 : m - 1) : m;
      const userDayAdj = userDay <= 0 ? userDay + 30 : userDay; // approximate
      if (userMonth === 10 && userDayAdj === 1) {
        const eidDate = new Date(probe);
        eidDate.setHours(0, 0, 0, 0);
        return { kind: 'fitr', eidDate, daysUntil: i };
      }
      if (userMonth === 12 && userDayAdj === 10) {
        const eidDate = new Date(probe);
        eidDate.setHours(0, 0, 0, 0);
        return { kind: 'adha', eidDate, daysUntil: i };
      }
    }
  }
  return { kind: null, eidDate: null, daysUntil: null };
}

// ── Today's congregations — single source of truth ──────────────────────────
//
// A "congregation" is a moment when people stand to pray together: the
// iqamah of a daily prayer, a Jumu'ah slot, or an Eid prayer slot. The
// ticker, the chime and the blackout overlay all need the same list. They
// used to build it separately, which is how Fridays ended up with a Dhuhr
// beep and a Dhuhr blackout while the prayer list said Jumu'ah.
//
// Rules:
//   - Sunrise is never a congregation.
//   - On a Friday with at least one Jumu'ah time, Jumu'ah REPLACES Dhuhr.
//     If every Jumu'ah slot is disabled, Dhuhr stays.
//   - Eid times are included only when the caller passes them. App passes
//     them on the Eid day itself, not during the lead-up days.

import { addMins } from './formatters.js';

export const DAILY_PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const isValidDate = (d) => d instanceof Date && Number.isFinite(d.getTime());

/**
 * Build today's congregations, sorted by time.
 *
 * @param {object} opts
 * @param {object} opts.todayTimes   { fajr, dhuhr, asr, maghrib, isha } adhan Dates
 * @param {object} opts.iqamah       { fajr, ... } minutes from adhan to iqamah
 * @param {boolean} [opts.isFriday]  City-local Friday (or the Test Friday override)
 * @param {Date[]} [opts.jumuahTimes] Enabled Jumu'ah slot times for today
 * @param {Date[]} [opts.eidTimes]    Enabled Eid slot times, only on the Eid day
 * @returns {Array<{ id: string, key: string, time: Date }>}
 *   key — 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'jumuah' | 'eid'.
 *         Also the lookup key for per-prayer settings (blackout durations)
 *         and labels (`prayer.<key>`).
 *   id  — unique per entry; Jumu'ah and Eid can have several slots.
 */
export function buildCongregations({
  todayTimes,
  iqamah,
  isFriday = false,
  jumuahTimes = [],
  eidTimes = [],
}) {
  const jumuah = isFriday ? jumuahTimes.filter(isValidDate) : [];
  const eid = eidTimes.filter(isValidDate);
  const out = [];

  for (const key of DAILY_PRAYER_KEYS) {
    if (key === 'dhuhr' && jumuah.length > 0) continue;
    const adhan = todayTimes?.[key];
    if (!isValidDate(adhan)) continue;
    out.push({ id: key, key, time: addMins(adhan, Number(iqamah?.[key]) || 0) });
  }
  jumuah.forEach((time, i) => out.push({ id: `jumuah_${i}`, key: 'jumuah', time }));
  eid.forEach((time, i) => out.push({ id: `eid_${i}`, key: 'eid', time }));

  return out.sort((a, b) => a.time - b.time);
}

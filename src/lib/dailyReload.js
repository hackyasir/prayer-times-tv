// ── dailyReload — when to reload a display that runs for days ────────────────
//
// TV browsers are not built to keep one page open for weeks: memory creeps
// up and Samsung's guidance calls leaks "fatal in long-running TV apps". A
// reload once a day clears that, and also picks up a new build. It must
// never interrupt anything, so it waits for a quiet moment:
//   - the screen has been up for 20 hours or more, and it's 1–5 a.m. in the
//     masjid's city (after 26 hours, any quiet moment will do — e.g. summer
//     at high latitudes, when Isha and Fajr leave little of the night);
//   - no adhan, iqamah, Jumu'ah or Eid prayer in the next 45 minutes or the
//     last 15;
//   - nobody is using the screen (Settings or the PIN prompt open) and no
//     prayer is in progress (blackout);
//   - the page can come back: the service worker serves it offline, or the
//     network is up.

const MIN = 60_000;
const HOUR = 60 * MIN;

export const RELOAD_AFTER_MS = 20 * HOUR;
export const RELOAD_OVERDUE_MS = 26 * HOUR;
const QUIET_BEFORE_MS = 45 * MIN;
const QUIET_AFTER_MS = 15 * MIN;

/**
 * @param {object} p
 * @param {number}  p.uptimeMs   time since the page loaded
 * @param {number}  p.cityHour   0–23, the masjid's local hour
 * @param {number}  p.nowMs
 * @param {Array<Date|null|undefined>} p.events  today's adhan and congregation
 *   times, and the next adhan (may be tomorrow's Fajr)
 * @param {boolean} p.busy       Settings / PIN open, or blackout active
 * @param {boolean} p.canReload  offline-capable (service worker) or online
 */
export function shouldReload({ uptimeMs, cityHour, nowMs, events, busy, canReload }) {
  if (busy || !canReload || uptimeMs < RELOAD_AFTER_MS) return false;
  for (const e of events || []) {
    const t = e instanceof Date ? e.getTime() : NaN;
    if (!Number.isFinite(t)) continue;
    if (t >= nowMs && t - nowMs < QUIET_BEFORE_MS) return false;
    if (t < nowMs && nowMs - t < QUIET_AFTER_MS) return false;
  }
  return uptimeMs >= RELOAD_OVERDUE_MS || (cityHour >= 1 && cityHour < 5);
}

// ── useBlackoutMode ──────────────────────────────────────────────────────────
//
// Derives the "should we be in blackout right now?" decision from:
//   - today's congregations (daily iqamahs, Jumu'ah slots on Fridays, Eid
//     slots on the Eid day — see lib/congregations.js)
//   - yesterday's Isha iqamah  (handles pre-Fajr morning when last night's
//                               Isha blackout might still be running)
//   - configured lead-in seconds (default 30s before the congregation)
//   - configured per-prayer durations in minutes (incl. jumuah and eid)
//   - current time
//   - a manual-dismiss flag managed by the parent
//
// The hook returns `{ active, prayerKey, endsAt }`:
//   - active     boolean — render the overlay?
//   - prayerKey  which prayer triggered it (for theming / debug)
//   - endsAt     Date — when blackout naturally ends (for the resume countdown)

import { useMemo } from 'react';
import { addMins } from '../lib/formatters.js';

export default function useBlackoutMode({
  enabled, // boolean — global blackout toggle from settings
  leadSeconds, // number — start blackout this many seconds BEFORE iqamah
  durations, // { fajr, dhuhr, asr, maghrib, isha, jumuah, eid } in minutes
  congregations, // [{ key, time }] from buildCongregations()
  yesterdayTimes, // adhan Dates for yesterday, for Isha-spanning-midnight case
  iqamah, // { fajr, dhuhr, asr, maghrib, isha } offset MINUTES
  now, // current Date
  dismissedAt, // Date|null — set by parent when user holds to dismiss
  forceUntil, // Date|null — TEST override; when set + in the future,
  // the overlay is active until that time regardless of
  // real iqamah windows. Wired to the "Test Blackout"
  // footer button (which only renders when SHOW_TEST_BTNS).
}) {
  return useMemo(() => {
    // Test-trigger short-circuit. Highest priority: if the parent set a
    // forceUntil date that's still in the future, render the overlay.
    // dismissedAt still wins (user can hold-to-dismiss a test blackout too).
    if (forceUntil && forceUntil > now) {
      if (
        dismissedAt &&
        dismissedAt > new Date(forceUntil.getTime() - 24 * 60 * 60 * 1000) &&
        dismissedAt < forceUntil
      ) {
        return { active: false, prayerKey: 'test', endsAt: forceUntil };
      }
      return { active: true, prayerKey: 'test', endsAt: forceUntil };
    }

    // Global off → never blackout
    if (!enabled) return { active: false, prayerKey: null, endsAt: null };

    // Build the list of [prayerKey, blackoutStartDate, blackoutEndDate]
    // for each of today's congregations + yesterday's Isha.
    // blackoutStart = start − leadSeconds; blackoutEnd = start + duration.
    const candidates = [];
    const minutesFor = (key) => Number(durations?.[key]) || 0;

    // Today's congregations. On Fridays this holds the Jumu'ah slots in
    // place of Dhuhr; on the Eid day it also holds the Eid slots.
    for (const c of congregations || []) {
      if (!c?.time) continue;
      const blackoutStart = new Date(c.time.getTime() - leadSeconds * 1000);
      const blackoutEnd = new Date(c.time.getTime() + minutesFor(c.key) * 60 * 1000);
      candidates.push({ prayerKey: c.key, start: blackoutStart, end: blackoutEnd });
    }

    // Yesterday's Isha — its blackout window may extend past midnight into
    // the current civil day, especially with a long duration setting.
    // Without this, a user opening the dashboard at 12:05 AM right after
    // Isha would see normal content during what should still be blackout.
    if (yesterdayTimes?.isha) {
      const iqamahTime = addMins(yesterdayTimes.isha, Number(iqamah?.isha) || 0);
      const blackoutStart = new Date(iqamahTime.getTime() - leadSeconds * 1000);
      const blackoutEnd = new Date(iqamahTime.getTime() + minutesFor('isha') * 60 * 1000);
      candidates.push({ prayerKey: 'isha', start: blackoutStart, end: blackoutEnd });
    }

    // Find the candidate window the user is currently inside. Windows can
    // overlap (e.g. Eid and Jumu'ah close together); the first match wins.
    const current = candidates.find((c) => now >= c.start && now < c.end);
    if (!current) return { active: false, prayerKey: null, endsAt: null };

    // Manual dismiss: if the user held-to-dismiss DURING this window, suppress
    // the overlay until the window ends. dismissedAt records when the dismiss
    // happened; if that timestamp falls inside the current window, honour it.
    if (dismissedAt && dismissedAt >= current.start && dismissedAt < current.end) {
      return { active: false, prayerKey: current.prayerKey, endsAt: current.end };
    }

    return { active: true, prayerKey: current.prayerKey, endsAt: current.end };
  }, [
    enabled,
    leadSeconds,
    durations,
    iqamah,
    congregations,
    yesterdayTimes,
    now,
    dismissedAt,
    forceUntil,
  ]);
}

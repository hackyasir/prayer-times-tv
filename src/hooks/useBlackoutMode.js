// ── useBlackoutMode ──────────────────────────────────────────────────────────
//
// Derives the "should we be in blackout right now?" decision from:
//   - today's iqamah times (5 daily prayers)
//   - yesterday's Isha iqamah  (handles pre-Fajr morning when last night's
//                               Isha blackout might still be running)
//   - configured lead-in seconds (default 30s before iqamah)
//   - configured per-prayer durations in minutes
//   - current time
//   - a manual-dismiss flag managed by the parent
//
// The hook returns `{ active, prayerKey, endsAt }`:
//   - active     boolean — render the overlay?
//   - prayerKey  which prayer triggered it (for theming / debug)
//   - endsAt     Date — when blackout naturally ends (for the resume countdown)
//
// Why pre-compute iqamah times here instead of taking them as a prop?
// The parent (App.jsx) computes adhan times for each prayer; iqamah is
// adhan + offset. Rather than make the parent compute iqamah for all five
// prayers AND yesterday's Isha just to feed us, we accept the building
// blocks (todayTimes, yesterdayTimes, iqamah offsets) and do the addition
// here. Keeps blackout logic self-contained.

import { useMemo } from 'react';
import { addMins } from '../lib/formatters.js';

export default function useBlackoutMode({
  enabled, // boolean — global blackout toggle from settings
  leadSeconds, // number — start blackout this many seconds BEFORE iqamah
  durations, // { fajr, dhuhr, asr, maghrib, isha } in minutes
  todayTimes, // { fajr, dhuhr, asr, maghrib, isha } adhan Dates
  yesterdayTimes, // same shape, for Isha-spanning-midnight case
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
    // for each of today's prayers + yesterday's Isha.
    // blackoutStart = iqamah − leadSeconds; blackoutEnd = iqamah + duration.
    const candidates = [];

    // Today's 5 daily prayers (sunrise excluded — not a congregational prayer)
    for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      const adhan = todayTimes?.[key];
      if (!adhan) continue;
      const iqamahTime = addMins(adhan, iqamah[key]);
      const blackoutStart = new Date(iqamahTime.getTime() - leadSeconds * 1000);
      const blackoutEnd = new Date(iqamahTime.getTime() + durations[key] * 60 * 1000);
      candidates.push({ prayerKey: key, start: blackoutStart, end: blackoutEnd });
    }

    // Yesterday's Isha — its blackout window may extend past midnight into
    // the current civil day, especially with a long duration setting.
    // Without this, a user opening the dashboard at 12:05 AM right after
    // Isha would see normal content during what should still be blackout.
    if (yesterdayTimes?.isha) {
      const iqamahTime = addMins(yesterdayTimes.isha, iqamah.isha);
      const blackoutStart = new Date(iqamahTime.getTime() - leadSeconds * 1000);
      const blackoutEnd = new Date(iqamahTime.getTime() + durations.isha * 60 * 1000);
      candidates.push({ prayerKey: 'isha', start: blackoutStart, end: blackoutEnd });
    }

    // Find the candidate window the user is currently inside.
    // (At most one — windows shouldn't overlap unless durations are absurd.)
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
    todayTimes,
    yesterdayTimes,
    now,
    dismissedAt,
    forceUntil,
  ]);
}

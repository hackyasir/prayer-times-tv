// ── usePrayerTimes — prayer time computation + active/next derivation ──────
//
// Given location + method + the city-time anchor, compute:
//   - todayTimes / tomorrowTimes / yesterdayTimes — the 6 prayers for each
//   - active prayer (the window we're currently inside, or yesterday's Isha
//                    during the pre-Fajr night window)
//   - activeStart  — the absolute UTC instant the active window began
//                    (yesterday's Isha during pre-Fajr; today's prayer otherwise)
//   - next         — the upcoming prayer (today's, or tomorrow's Fajr after Isha)
//   - secsToNext   — seconds until `next.time`
//   - ringProgress — 0..1 elapsed fraction of the active prayer window
//
// The pre-Fajr edge case: when clock is past midnight but Fajr hasn't yet
// arrived, "active" should be yesterday's Isha (it entered last night, and
// remains active until Fajr fires). Without this, the display incorrectly
// shows no active prayer in the early morning hours.

import { useMemo } from 'react';
import { calcTimes } from '../lib/prayerCalc.js';
import { PRAYERS } from '../lib/constants.js';

export default function usePrayerTimes({
  cityNow,
  now,
  lat,
  lng,
  method,
  shadow,
  cityTz,
  highLatRule,
}) {
  // Today's prayer times — recompute only when city date / location / method changes.
  // (Note: we use `cityNow.toDateString()` as a dep so the memo invalidates exactly
  // when the city's calendar day rolls over, not on every clock tick.)
  const todayTimes = useMemo(
    () => calcTimes(cityNow, lat, lng, method, shadow, cityTz, highLatRule),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityNow.toDateString(), lat, lng, method, shadow, cityTz, highLatRule]
  );

  const tomorrowTimes = useMemo(() => {
    const tom = new Date(cityNow);
    tom.setDate(tom.getDate() + 1);
    return calcTimes(tom, lat, lng, method, shadow, cityTz, highLatRule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityNow.toDateString(), lat, lng, method, shadow, cityTz, highLatRule]);

  // Yesterday's times — needed for the pre-Fajr window (active=Isha until Fajr).
  const yesterdayTimes = useMemo(() => {
    const yest = new Date(cityNow);
    yest.setDate(yest.getDate() - 1);
    return calcTimes(yest, lat, lng, method, shadow, cityTz, highLatRule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityNow.toDateString(), lat, lng, method, shadow, cityTz, highLatRule]);

  // Active + next prayer derivation
  const { active, next, activeStart } = useMemo(() => {
    let active = null;
    let activeStart = null; // absolute UTC instant when active prayer entered
    let next = null;

    // Walk today's prayers in order; we're "in" prayer i if t[i] <= now < t[i+1]
    for (let i = 0; i < PRAYERS.length; i++) {
      const t = todayTimes[PRAYERS[i].key];
      const tNext = todayTimes[PRAYERS[i + 1]?.key];
      if (t && t <= now && (!tNext || tNext > now)) {
        active = PRAYERS[i];
        activeStart = t;
      }
    }

    // The next prayer today (strictly after now)
    for (let i = 0; i < PRAYERS.length; i++) {
      const t = todayTimes[PRAYERS[i].key];
      if (t && t > now) {
        next = { ...PRAYERS[i], time: t };
        break;
      }
    }

    // Pre-Fajr window: clock past midnight, Fajr hasn't arrived.
    // Active should be YESTERDAY'S Isha (it entered last night, ends at today's Fajr).
    if (!active && next && next.key === 'fajr' && yesterdayTimes.isha) {
      active = PRAYERS[PRAYERS.length - 1]; // isha
      activeStart = yesterdayTimes.isha;
    }

    // After Isha — bridge to tomorrow's Fajr
    if (!next) {
      active = PRAYERS[PRAYERS.length - 1];
      activeStart = todayTimes.isha;
      if (tomorrowTimes.fajr) next = { ...PRAYERS[0], time: tomorrowTimes.fajr };
    }

    return { active, next, activeStart };
  }, [todayTimes, tomorrowTimes, yesterdayTimes, now]);

  const secsToNext = next ? Math.max(0, Math.floor((next.time - now) / 1000)) : 0;

  // Elapsed % of the active prayer window. activeStart correctly points to
  // yesterday's Isha during the pre-Fajr window.
  const ringProgress = useMemo(() => {
    if (!active || !next || !activeStart) return 0;
    const start = activeStart;
    const end = next.time;
    if (end <= start) return 0;
    return Math.min(1, Math.max(0, (now - start) / (end - start)));
  }, [active, next, activeStart, now]);

  return {
    todayTimes,
    tomorrowTimes,
    yesterdayTimes,
    active,
    activeStart,
    next,
    secsToNext,
    ringProgress,
  };
}

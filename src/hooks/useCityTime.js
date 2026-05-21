// ── useCityTime — city-timezone-aware "now" anchor ──────────────────────────
//
// Single source of truth for the dashboard's clock and date. Everything that
// reads "what day/time is it" should go through this hook, NOT through
// `new Date()` directly. The reason: the device's clock can be in any
// timezone, but the masjid display must always show the city's wall-clock
// (e.g. a server in London powering a dashboard for Karachi shows Karachi
// time, not UK time).
//
// `cityNowParts` is computed via Intl.DateTimeFormat with timeZone=cityTz,
// which works for any IANA zone without needing a tz database. From the
// extracted parts we build a Date anchor whose LOCAL fields (.getFullYear,
// .getMonth, .getDate, .getHours, etc) match the city's wall-clock — that
// anchor is then safe to pass to calcTimes() which reads those fields.
//
// `now` itself ticks every second via a setInterval. Caller doesn't need to
// own that timer.

import { useState, useEffect, useMemo } from 'react';
import { DAYS, MONTHS_FULL } from '../lib/constants.js';

export default function useCityTime(cityTz) {
  // Real-world "now" — same instant for everyone, regardless of timezone.
  // Ticks every second.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Extract city-local calendar fields, then build an anchor Date.
  // Falls back to device-local fields if cityTz is invalid.
  const cityNowParts = useMemo(() => {
    let h, m, s, weekday, monthName, dayNum, yearNum;
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: cityTz,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      const parts = fmt.formatToParts(now);
      const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
      h = parseInt(get('hour'), 10);
      m = parseInt(get('minute'), 10);
      s = parseInt(get('second'), 10);
      weekday = get('weekday');
      monthName = get('month');
      dayNum = parseInt(get('day'), 10);
      yearNum = parseInt(get('year'), 10);
    } catch {
      h = now.getHours();
      m = now.getMinutes();
      s = now.getSeconds();
      weekday = DAYS[now.getDay()];
      monthName = MONTHS_FULL[now.getMonth()];
      dayNum = now.getDate();
      yearNum = now.getFullYear();
    }
    const weekdayIdx = DAYS.indexOf(weekday); // 0..6 (Sun..Sat)
    const monthIdx = MONTHS_FULL.indexOf(monthName); // 0..11
    const anchor = new Date(yearNum, monthIdx, dayNum, h, m, s);
    return { h, m, s, weekday, monthName, dayNum, yearNum, weekdayIdx, monthIdx, anchor };
  }, [now, cityTz]);

  const cityNow = cityNowParts.anchor;
  const isFriday = cityNowParts.weekdayIdx === 5;

  return { now, cityNow, cityNowParts, isFriday };
}

// ── useChime — fire adhan/iqamah beep at correct times ─────────────────────
//
// Watches `now` (tick every second from useCityTime) and fires playBeep()
// whenever any configured beep time falls within a ±2 second window of now.
// Tracks already-fired keys in a ref so each beep fires exactly once per day
// per event.
//
// Beeps are split into TWO independent flags:
//   chimeAdhan  — fires at the adhan time of each daily prayer (prayer entry)
//   chimeIqamah — fires when a congregation starts (see lib/congregations.js)
//
// Congregations:
//   - Daily prayers beep at their iqamah time when chimeIqamah is on.
//   - Jumu'ah and Eid slots have no separate adhan/iqamah pair — the slot
//     time IS the congregation — so they beep when EITHER flag is on.
//   - On Fridays with Jumu'ah slots, Dhuhr is not a congregation, so there
//     is no Dhuhr iqamah beep. The Dhuhr adhan beep (prayer entry) remains.
//
// Common configurations:
//   - Iqamah only (default): most mosques play the real adhan from speakers
//     and just want a "stand up" signal on the dashboard
//   - Both: smaller jamaa'ats or home use, where the dashboard provides
//     both notifications
//   - Adhan only: rare but supported
//   - Neither: dashboard stays silent
//
// Caller passes the data the hook needs:
//   chimeAdhan / chimeIqamah — booleans from settings
//   now             — current Date (from useCityTime)
//   todayTimes      — adhan times (from usePrayerTimes)
//   congregations   — today's congregations (from buildCongregations)

import { useEffect, useRef } from 'react';
import { DAILY_PRAYER_KEYS } from '../lib/congregations.js';
import { playBeep } from '../lib/audio.js';

export default function useChime({ chimeAdhan, chimeIqamah, now, todayTimes, congregations }) {
  const firedRef = useRef(new Set());

  useEffect(() => {
    // Both flags off → nothing to schedule
    if (!chimeAdhan && !chimeIqamah) return;

    const checks = [];
    if (chimeAdhan) {
      for (const key of DAILY_PRAYER_KEYS) {
        const adhanT = todayTimes?.[key];
        if (adhanT) checks.push({ key: `${key}_adhan`, time: adhanT });
      }
    }
    for (const c of congregations || []) {
      const isSlot = c.key === 'jumuah' || c.key === 'eid';
      if (isSlot || chimeIqamah) checks.push({ key: `${c.id}_congregation`, time: c.time });
    }

    // Fire each beep once within a ±2 second window of its target time.
    const dateStr = now.toDateString();
    for (const ch of checks) {
      if (!ch.time) continue;
      const diff = Math.abs(now - ch.time) / 1000;
      const id = `${dateStr}:${ch.key}:${ch.time.getHours()}${ch.time.getMinutes()}`;
      if (diff <= 2 && !firedRef.current.has(id)) {
        firedRef.current.add(id);
        playBeep();
      }
    }
    // Memory hygiene: drop entries older than today
    if (firedRef.current.size > 60) {
      const keep = new Set();
      for (const k of firedRef.current) {
        if (k.startsWith(dateStr)) keep.add(k);
      }
      firedRef.current = keep;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, chimeAdhan, chimeIqamah]);
}

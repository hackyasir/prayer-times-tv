// ── useChime — fire adhan/iqamah beep at correct times ─────────────────────
//
// Watches `now` (tick every second from useCityTime) and fires playBeep()
// whenever any of the configured prayer/Jumu'ah/Eid times falls within a
// ±2 second window of now. Tracks already-fired keys in a ref so each beep
// fires exactly once per day per event.
//
// Beeps are split into TWO independent flags:
//   chimeAdhan  — fires at the adhan time (prayer entry)
//   chimeIqamah — fires at the iqamah time (offset minutes after adhan)
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
//   todayTimes      — prayer times (from usePrayerTimes)
//   iqamah          — { fajr: 45, dhuhr: 30, ... } minute offsets from adhan
//   isFriday        — boolean
//   activeJumuahSlots — list of { time:'HH:MM', iqamah:N } for the day
//   showEidBanner   — whether Eid is in effect
//   activeEidSlots  — list of { time:'HH:MM', iqamah:N, label } for the day
//   jumuahDate      — helper from parent: (timeStr) → Date
//   eidDate         — helper from parent: (timeStr) → Date

import { useEffect, useRef } from 'react';
import { PRAYERS } from '../lib/constants.js';
import { addMins } from '../lib/formatters.js';
import { playBeep } from '../lib/audio.js';

export default function useChime({
  chimeAdhan,
  chimeIqamah,
  now,
  todayTimes,
  iqamah,
  isFriday,
  activeJumuahSlots,
  showEidBanner,
  activeEidSlots,
  jumuahDate,
  eidDate,
}) {
  const firedRef = useRef(new Set());

  useEffect(() => {
    // Both flags off → nothing to schedule
    if (!chimeAdhan && !chimeIqamah) return;

    // Build the list of beep times. Each entry is tagged with `kind` so we
    // can skip adhan or iqamah events when the corresponding flag is off.
    const checks = [];
    for (const p of PRAYERS) {
      if (p.key === 'sunrise') continue; // no congregational sunrise prayer
      const adhanT = todayTimes[p.key];
      if (!adhanT) continue;
      const iqamahT = addMins(adhanT, iqamah[p.key] || 0);
      checks.push({ key: `${p.key}_adhan`, time: adhanT, kind: 'adhan' });
      checks.push({ key: `${p.key}_iqamah`, time: iqamahT, kind: 'iqamah' });
    }
    if (isFriday) {
      for (const j of activeJumuahSlots) {
        const jt = jumuahDate(j.time);
        const jiq = addMins(jt, j.iqamah);
        checks.push({ key: `jumuah_${j.time}_adhan`, time: jt, kind: 'adhan' });
        checks.push({ key: `jumuah_${j.time}_iqamah`, time: jiq, kind: 'iqamah' });
      }
    }
    if (showEidBanner) {
      for (const e of activeEidSlots) {
        const et = eidDate(e.time);
        const eiq = addMins(et, e.iqamah);
        checks.push({ key: `eid_${e.time}_adhan`, time: et, kind: 'adhan' });
        checks.push({ key: `eid_${e.time}_iqamah`, time: eiq, kind: 'iqamah' });
      }
    }

    // Fire each beep once within a ±2 second window of its target time.
    // Skip entries whose `kind` flag is disabled — this is the per-event
    // gate that makes "iqamah only" vs "both" actually different.
    const dateStr = now.toDateString();
    for (const ch of checks) {
      if (!ch.time) continue;
      if (ch.kind === 'adhan' && !chimeAdhan) continue;
      if (ch.kind === 'iqamah' && !chimeIqamah) continue;
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

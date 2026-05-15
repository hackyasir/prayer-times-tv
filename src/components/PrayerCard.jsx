// ── Prayer Card — single row in the prayer list ──────────────────────────────
// Used for the standard 5 daily prayers (Fajr/Dhuhr/Asr/Maghrib/Isha) plus
// Jumu'ah and Eid special variants. Shows the prayer name (English + Arabic)
// alongside two times (Adhan + Iqamah). Has three visual states:
//   - active: golden glow + pulsing dot, current prayer window
//   - passed: dimmed, prayer's time is behind us
//   - upcoming: default styling

import { fmt12 } from '../lib/formatters.js';

/** Standard prayer row. */
export default function PrayerCard({
  enName,
  arName,
  time,
  iqamahTime,
  cityTz,
  isActive,
  isPassed,
}) {
  return (
    <div className={`pcard${isActive ? ' active' : ''}${isPassed ? ' passed' : ''}`}>
      <div className="pcard-name">
        <div className="pen">{enName}</div>
        <div className="par">{arName}</div>
      </div>
      {isActive && (
        <div className="abadge">
          <span className="abadge-dot"/>
        </div>
      )}
      <div className="pcard-times">
        <div className="ptime">{fmt12(time, cityTz)}</div>
        <div className="ptime-iqamah">{fmt12(iqamahTime, cityTz)}</div>
      </div>
    </div>
  );
}

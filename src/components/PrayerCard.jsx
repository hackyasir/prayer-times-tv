// ── Prayer Card — single row in the prayer list ──────────────────────────────
// Used for the standard 5 daily prayers (Fajr/Dhuhr/Asr/Maghrib/Isha) plus
// Jumu'ah and Eid special variants. Shows the prayer name (English + Arabic)
// alongside two times (Adhan + Iqamah). Has three visual states:
//   - active: golden glow + pulsing dot, current prayer window
//   - passed: dimmed, prayer's time is behind us
//   - upcoming: default styling
//
// Optional `prayerKey` prop renders an SVG icon to the left of the name.
// Icon colour follows the parent text colour via currentColor so it auto-
// matches the active/passed/upcoming visual state.

import { fmt12 } from '../lib/formatters.js';
import PrayerIcon from './PrayerIcons.jsx';

/**
 * "5:27 AM" → digits plus a smaller AM/PM suffix, so the digits can be large
 * and still fit the time column on a TV. Placeholders ("--:--") pass through.
 */
function TimeText({ date, cityTz }) {
  const text = fmt12(date, cityTz);
  const m = /^(.*\d)\s+(AM|PM)$/.exec(text);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <span className="ptime-ampm">{m[2]}</span>
    </>
  );
}

/** Standard prayer row. */
export default function PrayerCard({
  enName,
  arName,
  time,
  iqamahTime,
  cityTz,
  isActive,
  isPassed,
  prayerKey,
}) {
  return (
    <div className={`pcard${isActive ? ' active' : ''}${isPassed ? ' passed' : ''}`} role="listitem">
      {prayerKey && (
        <div className="pcard-icon" aria-hidden="true">
          <PrayerIcon prayerKey={prayerKey} />
        </div>
      )}
      <div className="pcard-name">
        <div className="pen">{enName}</div>
        <div className="par">{arName}</div>
      </div>
      {isActive && (
        <div className="abadge" aria-hidden="true">
          <span className="abadge-dot" />
        </div>
      )}
      <div className="ptime">
        <TimeText date={time} cityTz={cityTz} />
      </div>
      <div className="ptime-iqamah">
        <TimeText date={iqamahTime} cityTz={cityTz} />
      </div>
    </div>
  );
}

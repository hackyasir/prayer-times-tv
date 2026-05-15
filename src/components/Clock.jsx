// ── Clock (centre column) ────────────────────────────────────────────────────
// The dashboard's primary information block.
// Top → bottom inside the column:
//   1. Big clock time + seconds + date
//   2. Divider
//   3. "Next Prayer" label + Arabic name + chosen ProgressVisual + countdown
//      (final-minute mode: huge pulsing seconds number)
//   4. Divider
//   5. Hadith — rotates per prayer index
//
// All time strings (clock, countdown, prayer time) are pre-formatted by the
// parent using the city's timezone — we never call Date.now() here.

import ProgressVisual from './ProgressVisual.jsx';
import { fmt12, fmtCountdown } from '../lib/formatters.js';
import { PRAYERS } from '../lib/constants.js';

export default function Clock({
  // Pre-formatted display strings
  timeStr,
  secStr,
  dateStr,
  // Next prayer info ({ en, ar, time, key } | null)
  next,
  secsToNext,
  // Progress visual config + data
  progressStyle,
  ringProgress,
  todayTimes,
  tomorrowTimes,
  now,
  cityTz,
  // Active prayer (for hadith rotation)
  activeKey,
  hadiths,
}) {
  return (
    <div className="ccol">
      {/* Clock time block */}
      <div className="clock">
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'center',
          gap: '0.35em', whiteSpace: 'nowrap',
        }}>
          <span className="clock-main" style={{ paddingRight: '0.04em' }}>{timeStr}</span>
          <span className="clock-sec">{secStr}</span>
        </div>
        <div className="clock-date">{dateStr}</div>
      </div>

      <div className="divider"/>

      {/* Next-prayer section: Arabic + Latin name, then ProgressVisual + countdown */}
      {next ? (
        <div className="next-sec">
          <div className="next-lbl">Next Prayer</div>
          <div className="next-name">{next.en}</div>
          <div className="next-ar">{next.ar}</div>

          <ProgressVisual
            style={progressStyle}
            ringProgress={ringProgress}
            prayers={PRAYERS}
            todayTimes={todayTimes}
            tomorrowTimes={tomorrowTimes}
            now={now}
            cityTz={cityTz}
          />

          {/* Final-minute mode: huge pulsing seconds digit instead of HH:MM:SS */}
          {secsToNext <= 60 && secsToNext > 0 ? (
            <>
              <div className="countdown-big">{secsToNext}</div>
              <div className="countdown-lbl">
                second{secsToNext === 1 ? '' : 's'} until {next.en}
              </div>
            </>
          ) : (
            <>
              <div className="countdown">{fmtCountdown(secsToNext)}</div>
              <div className="countdown-lbl">Until {next.en} · {fmt12(next.time, cityTz)}</div>
            </>
          )}
        </div>
      ) : (
        <div style={{
          color: '#9A8B6E',
          fontSize: 'clamp(0.812rem,1.4vw,1.375rem)',
          letterSpacing: '0.1em',
          textAlign: 'center',
        }}>
          All prayers complete today
        </div>
      )}

      <div className="divider"/>

      {/* Rotating hadith — picks one based on current active prayer index */}
      {(() => {
        const idx = PRAYERS.findIndex(p => p.key === activeKey);
        const h = hadiths[idx >= 0 ? idx % hadiths.length : 0];
        return (
          <div className="hadith">
            <div className="hadith-ar">{h.ar}</div>
            <div className="hadith-en">{h.en}</div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Clock (centre column) ────────────────────────────────────────────────────
// The dashboard's primary information block.
// Top → bottom inside the column:
//   1. Big clock time + seconds + date
//   2. Divider
//   3. "Next Prayer" label + Arabic name + chosen ProgressVisual + countdown
//      (final-minute mode: huge pulsing seconds number). Between a prayer's
//      adhan and iqamah (countdownMode 'iqamah') it reads "Iqamah" and
//      counts down to the iqamah instead.
//   4. Divider
//   5. Hadith — rotates per prayer index
//
// All time strings (clock, countdown, prayer time) are pre-formatted by the
// parent using the city's timezone — we never call Date.now() here.

import ProgressVisual from './ProgressVisual.jsx';
import StableDigits from './StableDigits.jsx';
import { fmt12, fmtCountdown, fmtCountdownShort } from '../lib/formatters.js';
import { PRAYERS } from '../lib/constants.js';
import { useT, fmtStr } from '../i18n/I18nContext.jsx';

export default function Clock({
  // Pre-formatted display strings
  timeStr,
  secStr,
  dateStr,
  // Countdown target ({ en, ar, time, key } | null). In 'iqamah' mode this is
  // the prayer whose adhan has been called, and `time` is its iqamah.
  next,
  secsToNext,
  countdownMode = 'adhan', // 'adhan' | 'iqamah'
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
  // Optional render slots for the embedded layout variant
  topSlot, // sits above the clock time block (e.g. SunArc)
  bottomSlot, // sits below the countdown label (e.g. FastBar)
}) {
  const { t, lang } = useT();

  // Localized name pair for the next prayer.
  // Same pattern as PrayerList.namesFor — keeps the visual rhythm (big + small)
  // of the Arabic+Latin pair regardless of UI language.
  // (Falls back to next's literal en/ar fields if no key — shouldn't happen.)
  function nextNames() {
    if (!next) return { primary: '', secondary: '' };
    const arabicName = next.ar || '';
    const localized = next.key ? t(`prayer.${next.key}`) : next.en;
    const englishKey = next.en || '';
    if (lang === 'ar') return { primary: arabicName, secondary: englishKey };
    if (lang === 'ur') return { primary: localized, secondary: arabicName };
    return { primary: localized, secondary: arabicName };
  }
  const names = nextNames();
  const isIqamah = countdownMode === 'iqamah';

  return (
    <div className="ccol">
      {/* Optional embedded-variant slot above the clock — Sun arc, etc. */}
      {topSlot}
      {/* Clock time block. StableDigits keeps the ticking numbers from
          shifting left and right (the font's digits differ in width). */}
      <div className="clock">
        <div className="clock-time-row">
          <span className="clock-main">
            <StableDigits text={timeStr} />
          </span>
          <span className="clock-sec">
            <StableDigits text={secStr} />
          </span>
        </div>
        <div className="clock-date">{dateStr}</div>
      </div>

      <div className="divider" />

      {/* Next-prayer section: Arabic + Latin name, then ProgressVisual + countdown */}
      {next ? (
        <div
          className={`next-sec${isIqamah ? ' next-sec--iqamah' : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="next-lbl">{isIqamah ? t('label.iqamahNext') : t('label.next')}</div>
          <div className="next-name">{names.primary}</div>
          <div className="next-ar">{names.secondary}</div>

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
              <div className="countdown-big">
                <StableDigits text={secsToNext} />
              </div>
              <div className="countdown-lbl">
                {fmtStr(t(isIqamah ? 'label.untilIqamahSeconds' : 'label.untilSeconds'), {
                  plural: secsToNext === 1 ? '' : 's',
                  prayer: names.primary,
                })}
              </div>
            </>
          ) : (
            <>
              <div className="countdown">
                <StableDigits
                  text={isIqamah ? fmtCountdownShort(secsToNext) : fmtCountdown(secsToNext)}
                />
              </div>
              <div className="countdown-lbl">
                {fmtStr(t(isIqamah ? 'label.untilIqamah' : 'label.until'), {
                  prayer: names.primary,
                  time: fmt12(next.time, cityTz),
                })}
              </div>
            </>
          )}
          {/* Optional embedded-variant slot under the countdown — Fast bar, etc. */}
          {bottomSlot}
        </div>
      ) : (
        <div className="clock-complete" role="status" aria-live="polite" aria-atomic="true">
          {t('label.allComplete')}
        </div>
      )}

      <div className="divider" />

      {/* Rotating hadith — picks one based on current active prayer index */}
      {(() => {
        const idx = PRAYERS.findIndex((p) => p.key === activeKey);
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

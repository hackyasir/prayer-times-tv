// ── FastBar — slim fasting progress under the clock countdown ─────────
//
// Always visible. Two states:
//
//   STATE A — Before today's Maghrib:
//     Shows TODAY's window (Fajr → Maghrib) with the progress bar filling
//     from sunrise to sunset. Right-side label counts down to iftar.
//
//   STATE B — After today's Maghrib:
//     Shows TOMORROW's window (Fajr → Maghrib). Progress bar is empty (the
//     fast hasn't started yet). Right-side label counts down to Suhoor
//     (= tomorrow's Fajr), since that's the next milestone for someone
//     planning to fast.
//
// This mirrors how dedicated fasting apps behave: information is always
// "what's the current fast or the next one?" — never empty/hidden.

import { fmt12 } from '../../lib/formatters.js';
import { useT, fmtStr } from '../../i18n/I18nContext.jsx';

export default function FastBar({ todayTimes, tomorrowTimes, now, cityTz }) {
  const { t } = useT();
  const todayFajr    = todayTimes?.fajr;
  const todayMaghrib = todayTimes?.maghrib;
  const tomorrowFajr    = tomorrowTimes?.fajr;
  const tomorrowMaghrib = tomorrowTimes?.maghrib;

  // Need at least today's Fajr+Maghrib to render anything. If those are
  // missing (e.g. prayer-time calc still loading), bail.
  if (!todayFajr || !todayMaghrib) return null;

  // Decide which window to show based on whether today's Maghrib has passed.
  const afterMaghrib = now >= todayMaghrib;
  const fajr    = afterMaghrib ? tomorrowFajr    : todayFajr;
  const maghrib = afterMaghrib ? tomorrowMaghrib : todayMaghrib;
  if (!fajr || !maghrib) return null;

  // Progress bar fill — only meaningful if we're inside the fast window.
  // STATE B (after Maghrib): pct = 0 because tomorrow's fast hasn't started.
  // STATE A (during fast): pct rises from 0 at Fajr to 100 at Maghrib.
  // STATE A pre-Fajr: pct = 0 because we're waiting for Fajr.
  let pct = 0;
  if (!afterMaghrib && now >= fajr) {
    const totalMs   = maghrib - fajr;
    const elapsedMs = now - fajr;
    pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  }

  // Right-label countdown — what is the user waiting for right now?
  //   STATE A during fast:   → Maghrib (iftar)
  //   STATE A pre-Fajr:      → Fajr (Suhoor)
  //   STATE B after Maghrib: → Tomorrow's Fajr (Suhoor)
  let labelTime, labelKey;
  if (afterMaghrib) {
    labelTime = fajr;          // tomorrow's Fajr
    labelKey  = 'widget.fast.toSuhoor';
  } else if (now < fajr) {
    labelTime = fajr;          // today's Fajr
    labelKey  = 'widget.fast.toSuhoor';
  } else {
    labelTime = maghrib;       // today's Maghrib
    labelKey  = 'widget.fast.toIftar';
  }
  const remainingMin = Math.max(0, Math.ceil((labelTime - now) / 60000));
  const remH = Math.floor(remainingMin / 60);
  const remM = remainingMin % 60;

  return (
    <div className="fast-bar" aria-label="Fasting window">
      {/* Left: "FAST" label — anchors the widget so users immediately know
       * what the bar represents, without having to infer from times alone. */}
      <span className="fast-bar-label">{t('widget.fast.label')}</span>
      {/* Endpoints — labeled "Suhoor X:XX" / "Iftar X:XX" so the meaning
       * is self-evident. Replaces the unlabeled "5:00 AM → 8:40 PM" which
       * was ambiguous to anyone who didn't already know the convention. */}
      <div className="fast-bar-times">
        <span className="fast-bar-endpoint">
          <span className="fast-bar-endpoint-lbl">{t('widget.fast.suhoor')}</span>
          <span className="fast-bar-time">{fmt12(fajr, cityTz)}</span>
        </span>
        <span className="fast-bar-arrow" aria-hidden="true">→</span>
        <span className="fast-bar-endpoint">
          <span className="fast-bar-endpoint-lbl">{t('widget.fast.iftar')}</span>
          <span className="fast-bar-time">{fmt12(maghrib, cityTz)}</span>
        </span>
      </div>
      <div className="fast-bar-track">
        <div
          className="fast-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Right: actionable countdown — what most users actually look at.
       * Reworded from "to Iftar 6h 20m" → "Iftar in 6h 20m" for natural
       * English phrasing. */}
      <div className="fast-bar-remaining">
        {fmtStr(t(labelKey), { hours: remH, mins: remM })}
      </div>
    </div>
  );
}

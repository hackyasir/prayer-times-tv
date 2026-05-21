// ── Progress Visuals — five interchangeable centre-column indicators ────────
//
// Switchable via Settings → "Progress Style". All accept the same prop bag
// from the parent, but each style uses only the subset it needs:
//   - ringProgress (0..1)    used by Ring, Moon, Line
//   - prayers + todayTimes + tomorrowTimes + now + cityTz used by DayBar
//   - (Hero takes nothing — it just returns null so the countdown dominates)
//
// All styles are pure presentational components — they don't read any state
// directly; the parent passes whatever they need as props.
//
// STYLING APPROACH: visuals are styled in src/styles/clock.css under the
// `.daybar-*`, `.moon-prog-*`, `.line-prog-*`, `.ring-*` class groups.
// Inline `style={...}` is reserved for values that are COMPUTED from
// runtime state — positions like `left: <fraction>%`, widths like
// `width: <fraction>%`. Conditional modifiers handled by class names.

import { useId } from 'react';

/** Original circular ring with % elapsed in the middle. */
function ProgressRing({ ringProgress }) {
  const circ = 2 * Math.PI * 42;
  const pct = Math.round(ringProgress * 100);
  const offset = circ * (1 - ringProgress);
  return (
    <div className="ring-wrap">
      <svg className="ring-svg" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="4"
        />
        <circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="var(--t-accent, #C9A84C)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          className="ring-progress-anim"
        />
      </svg>
      <div className="ring-inner">
        <div className="ring-pct">{pct}%</div>
        <div className="ring-sub">elapsed</div>
      </div>
    </div>
  );
}

/** Full-day horizontal bar with prayer-time pegs and a glowing "now" indicator.
    Spans from today's Fajr to tomorrow's Fajr (~24 hours). Past prayers are
    dim; upcoming prayers are bright; the glowing dot slides across at "now". */
function ProgressDayBar({ prayers, todayTimes, tomorrowTimes, now }) {
  const start = todayTimes.fajr;
  const end = tomorrowTimes?.fajr;
  if (!start || !end) return null;
  const total = end - start;
  const pos = Math.max(0, Math.min(1, (now - start) / total));

  // Sunrise is observational only (no congregation), so we don't peg it.
  const markers = prayers
    .filter((p) => p.key !== 'sunrise')
    .map((p) => {
      const t = todayTimes[p.key];
      if (!t) return null;
      return { key: p.key, en: p.en, frac: (t - start) / total, time: t };
    })
    .filter(Boolean);

  return (
    <div className="daybar-wrap">
      {/* The bar itself */}
      <div className="daybar-track">
        {/* Progress fill: from start to now. Width is the only inline value
         * since it's computed from runtime "pos". */}
        <div className="daybar-fill" style={{ width: `${pos * 100}%` }} />
        {/* Prayer markers — vertical bars at each prayer's fractional position.
         * Left position is dynamic; past/upcoming styling via modifier class. */}
        {markers.map((m) => (
          <div
            key={m.key}
            className={`daybar-marker${m.time <= now ? ' daybar-marker--past' : ''}`}
            style={{ left: `${m.frac * 100}%` }}
          />
        ))}
        {/* NOW dot — glowing indicator at current time. Position computed. */}
        <div className="daybar-now-dot" style={{ left: `${pos * 100}%` }} />
      </div>
      {/* Labels under bar */}
      <div className="daybar-labels">
        {markers.map((m) => (
          <div
            key={m.key}
            className={`daybar-label${m.time <= now ? ' daybar-label--past' : ''}`}
            style={{ left: `${m.frac * 100}%` }}
          >
            {m.en}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Crescent moon that fills/empties based on time to next prayer.
    Full moon = just prayed (low ringProgress); thin crescent = prayer imminent. */
function ProgressMoon({ ringProgress }) {
  // ringProgress 0 = full moon (just prayed), 1 = thin crescent (prayer imminent).
  // Visually, the moon's bright portion shrinks as ringProgress grows.
  const phase = 1 - ringProgress; // 1 = full, 0 = new
  const offsetX = 40 * (1 - phase);
  // Unique mask ID per instance — useId ensures multiple Moon components
  // on a page don't share masks and collide.
  const maskId = useId();
  return (
    <div className="moon-prog-wrap">
      <svg viewBox="0 0 100 100" className="moon-prog-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={`moon-glow-${maskId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--t-accent-hi, #F5D27A)" stopOpacity="0.4" />
            <stop offset="60%" stopColor="var(--t-accent, #C9A84C)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <mask id={`moon-mask-${maskId}`}>
            <rect width="100" height="100" fill="white" />
            <circle cx={50 + offsetX} cy="50" r="42" fill="black" />
          </mask>
        </defs>
        {/* Outer halo */}
        <circle cx="50" cy="50" r="48" fill={`url(#moon-glow-${maskId})`} />
        {/* Moon body with mask cutting out the dark portion */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="var(--t-accent-hi, #F5D27A)"
          mask={`url(#moon-mask-${maskId})`}
        />
        {/* Subtle outline of the full disc, even on a thin crescent */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(var(--t-accent-rgb),.18)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/** "Hero countdown" — no visual indicator, just emphasize the countdown text. */
function ProgressHero() {
  return null;
}

/** Thin inline progress line — minimal status indicator. */
function ProgressLine({ ringProgress }) {
  const pct = Math.round(ringProgress * 100);
  return (
    <div className="line-prog-wrap">
      <div className="line-prog-track">
        {/* Width is the only inline value — computed from ringProgress. */}
        <div className="line-prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="line-prog-text">{pct}% elapsed</div>
    </div>
  );
}

/** Dispatcher — picks the right inner component based on the style prop. */
export default function ProgressVisual({
  style,
  ringProgress,
  prayers,
  todayTimes,
  tomorrowTimes,
  now,
  cityTz,
}) {
  switch (style) {
    case 'daybar':
      return (
        <ProgressDayBar
          prayers={prayers}
          todayTimes={todayTimes}
          tomorrowTimes={tomorrowTimes}
          now={now}
          cityTz={cityTz}
        />
      );
    case 'moon':
      return <ProgressMoon ringProgress={ringProgress} />;
    case 'hero':
      return <ProgressHero />;
    case 'line':
      return <ProgressLine ringProgress={ringProgress} />;
    case 'ring':
    default:
      return <ProgressRing ringProgress={ringProgress} />;
  }
}

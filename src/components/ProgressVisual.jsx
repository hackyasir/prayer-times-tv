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

import { useId } from 'react';

/** Original circular ring with % elapsed in the middle. */
function ProgressRing({ ringProgress }) {
  const circ   = 2 * Math.PI * 42;
  const pct    = Math.round(ringProgress * 100);
  const offset = circ * (1 - ringProgress);
  return (
    <div className="ring-wrap">
      <svg className="ring-svg" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
        <circle cx="48" cy="48" r="42" fill="none" stroke="var(--t-accent, #C9A84C)" strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
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
  const end   = tomorrowTimes?.fajr;
  if (!start || !end) return null;
  const total = end - start;
  const pos   = Math.max(0, Math.min(1, (now - start) / total));

  // Sunrise is observational only (no congregation), so we don't peg it.
  const markers = prayers
    .filter(p => p.key !== 'sunrise')
    .map(p => {
      const t = todayTimes[p.key];
      if (!t) return null;
      return { key: p.key, en: p.en, frac: (t - start) / total, time: t };
    })
    .filter(Boolean);

  return (
    <div style={{ width:'min(92%, 700px)', margin:'.4vh 0' }}>
      {/* The bar itself */}
      <div style={{
        position:'relative', height:'clamp(8px, 1.3vw, 14px)',
        background:'rgba(var(--t-accent-rgb),.08)',
        borderRadius:999,
        border:'1px solid rgba(var(--t-accent-rgb),.18)',
      }}>
        {/* Progress fill: from start to now */}
        <div style={{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${pos * 100}%`,
          background:'linear-gradient(90deg, var(--t-accent-dim) 0%, var(--t-accent) 50%, var(--t-accent-hi) 100%)',
          borderRadius:999,
          transition:'width 60s linear',
        }}/>
        {/* Prayer markers — vertical bars at each prayer's fractional position */}
        {markers.map(m => (
          <div key={m.key} style={{
            position:'absolute', top:'50%', left:`${m.frac * 100}%`,
            transform:'translate(-50%, -50%)',
            width:2, height:'180%',
            background: m.time <= now ? 'var(--t-accent-dim)' : 'var(--t-accent)',
            opacity: m.time <= now ? .4 : .9,
          }}/>
        ))}
        {/* NOW dot — glowing indicator at current time */}
        <div style={{
          position:'absolute', top:'50%', left:`${pos * 100}%`,
          transform:'translate(-50%, -50%)',
          width:'clamp(14px,2vw,22px)', height:'clamp(14px,2vw,22px)',
          borderRadius:'50%',
          background:'var(--t-accent-hi)',
          boxShadow:'0 0 12px var(--t-accent-hi), 0 0 24px var(--t-accent)',
          border:'2px solid var(--t-bg)',
          transition:'left 60s linear',
        }}/>
      </div>
      {/* Labels under bar */}
      <div style={{ position:'relative', height:'clamp(14px, 1.8vw, 22px)', marginTop:'.4vh' }}>
        {markers.map(m => (
          <div key={m.key} style={{
            position:'absolute', left:`${m.frac * 100}%`,
            transform:'translateX(-50%)',
            fontSize:'clamp(0.45rem,.75vw,0.812rem)',
            color: m.time <= now ? 'var(--t-text-dim)' : 'var(--t-accent)',
            letterSpacing:'.08em', textTransform:'uppercase',
            whiteSpace:'nowrap',
          }}>
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
  const size = 'clamp(64px, 8vw, 130px)';
  const offsetX = 40 * (1 - phase);
  // Unique mask ID per instance — useId ensures multiple Moon components
  // on a page don't share masks and collide.
  const maskId = useId();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', margin:'.3vh 0' }}>
      <svg viewBox="0 0 100 100" style={{ width:size, height:size, overflow:'visible' }}>
        <defs>
          <radialGradient id={`moon-glow-${maskId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--t-accent-hi, #F5D27A)" stopOpacity="0.4"/>
            <stop offset="60%" stopColor="var(--t-accent, #C9A84C)" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <mask id={`moon-mask-${maskId}`}>
            <rect width="100" height="100" fill="white"/>
            <circle cx={50 + offsetX} cy="50" r="42" fill="black"/>
          </mask>
        </defs>
        {/* Outer halo */}
        <circle cx="50" cy="50" r="48" fill={`url(#moon-glow-${maskId})`}/>
        {/* Moon body with mask cutting out the dark portion */}
        <circle cx="50" cy="50" r="42"
          fill="var(--t-accent-hi, #F5D27A)"
          mask={`url(#moon-mask-${maskId})`}
        />
        {/* Subtle outline of the full disc, even on a thin crescent */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(var(--t-accent-rgb),.18)" strokeWidth="1"/>
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
    <div style={{ width:'min(60%, 360px)', margin:'.5vh 0' }}>
      <div style={{
        height: 3,
        background:'rgba(var(--t-accent-rgb),.1)',
        borderRadius: 2,
        overflow:'hidden',
        position:'relative',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, var(--t-accent-dim), var(--t-accent-hi))',
          transition: 'width 60s linear',
        }}/>
      </div>
      <div style={{
        fontSize: 'calc(clamp(0.4rem,.65vw,0.625rem) * var(--t-fs, 1))',
        letterSpacing: '.18em',
        textTransform: 'uppercase',
        color: 'var(--t-text-dim)',
        marginTop: 2,
        textAlign: 'center',
      }}>
        {pct}% elapsed
      </div>
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
      return <ProgressDayBar
        prayers={prayers}
        todayTimes={todayTimes}
        tomorrowTimes={tomorrowTimes}
        now={now}
        cityTz={cityTz}
      />;
    case 'moon': return <ProgressMoon ringProgress={ringProgress}/>;
    case 'hero': return <ProgressHero/>;
    case 'line': return <ProgressLine ringProgress={ringProgress}/>;
    case 'ring':
    default:     return <ProgressRing ringProgress={ringProgress}/>;
  }
}

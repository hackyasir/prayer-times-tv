// ── SunArc — daylight progress arc above the clock ────────────────
//
// Thin curved gold line going left-to-right across the centre column, with
// three small markers (sunrise · solar noon · sunset) and a bright dot
// showing the sun's current position along the arc.
//
// Renders above the clock in the centre column.
//
// STYLING APPROACH: all colors, fonts, sizes, strokes live in CSS
// (src/styles/widgets.css under the .sun-arc-* classes). The JSX here is
// pure structure + data — no inline styles, no inline attribute styling
// of stroke/fill except for the dynamic gradient ID reference. This
// matches the rest of the project (QiblaCompass, MosqueIcon) and makes
// the component easy to restyle by editing CSS alone.

import { fmt12 } from '../../lib/formatters.js';
import { useT } from '../../i18n/I18nContext.jsx';

// Compact viewBox: width 400, height tight to arc + 2 lines of labels.
const ARC_W = 400;
const ARC_H = 84; // increased from 74 to give labels (13px) + times (14px) breathing room
const PAD_X = 44; // inset for arc endpoints — wide enough that centre-anchored
//                   end labels (Sunrise/Sunset + times) stay inside the viewBox
const ARC_Y0 = 46; // arc endpoints (low)
const ARC_Y1 = 8; // arc apex (high — solar noon)

/** Quadratic Bézier point at parameter t in [0..1]. */
function bezierPoint(t) {
  const x0 = PAD_X,
    x1 = ARC_W / 2,
    x2 = ARC_W - PAD_X;
  const y0 = ARC_Y0,
    y1 = ARC_Y1,
    y2 = ARC_Y0;
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
    y: mt * mt * y0 + 2 * mt * t * y1 + t * t * y2,
  };
}

export default function SunArc({ todayTimes, now, cityTz }) {
  const { t } = useT();
  const { sunrise, dhuhr: solarNoon, maghrib: sunset } = todayTimes;
  if (!sunrise || !sunset) return null;

  const total = sunset - sunrise;
  const elapsed = now - sunrise;
  const tRaw = total > 0 ? elapsed / total : 0;
  const tClamped = Math.max(0, Math.min(1, tRaw));
  const inDaylight = tRaw >= 0 && tRaw <= 1;
  const sunPos = bezierPoint(tClamped);

  const noonPos = bezierPoint(0.5);
  const startPos = { x: PAD_X, y: ARC_Y0 };
  const endPos = { x: ARC_W - PAD_X, y: ARC_Y0 };
  const arcPath = `M${startPos.x},${startPos.y} Q${ARC_W / 2},${ARC_Y1} ${endPos.x},${endPos.y}`;

  return (
    <div className="sun-arc">
      <svg
        className="sun-arc-svg"
        viewBox={`0 0 ${ARC_W} ${ARC_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Daylight progress arc"
      >
        <defs>
          {/* Gradient referenced by .sun-arc-path-active. The stop colors
              inherit from CSS via currentColor isn't possible inside <stop>,
              so we set them explicitly here using the same accent variable. */}
          <linearGradient id="sunArcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--t-accent)" stopOpacity=".35" />
            <stop offset="50%" stopColor="var(--t-accent)" stopOpacity=".7" />
            <stop offset="100%" stopColor="var(--t-accent)" stopOpacity=".35" />
          </linearGradient>
        </defs>

        {/* Always-drawn dotted full-day arc */}
        <path d={arcPath} className="sun-arc-path" />
        {/* Bright gradient overlay — only during daylight */}
        {inDaylight && <path d={arcPath} className="sun-arc-path-active" />}

        {/* Marker dots — sunrise / noon / sunset */}
        <circle cx={startPos.x} cy={startPos.y} r="2.5" className="sun-arc-marker" />
        <circle cx={noonPos.x} cy={noonPos.y} r="2" className="sun-arc-marker" />
        <circle cx={endPos.x} cy={endPos.y} r="2.5" className="sun-arc-marker" />

        {/* Current-sun symbol — disk + 8 evenly-spaced rays + halo glow.
         * Drawn as a transform-rotated <g> so positioning is via translate
         * and the 8 rays are 8 short <line>s at 45° intervals around the
         * origin. Bumped slightly larger than before so the sun feels more
         * present. */}
        {inDaylight && (
          <g transform={`translate(${sunPos.x} ${sunPos.y})`} className="sun-arc-sun-group">
            {/* Halo glow behind everything */}
            <circle r="9" className="sun-arc-sun-halo" />
            {/* 8 rays at 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°.
             * Each ray extends from r=6.5 (just outside the disk) to r=10. */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = Math.cos(rad) * 6.5;
              const y1 = Math.sin(rad) * 6.5;
              const x2 = Math.cos(rad) * 10;
              const y2 = Math.sin(rad) * 10;
              return (
                <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} className="sun-arc-sun-ray" />
              );
            })}
            {/* The sun disk itself */}
            <circle r="5" className="sun-arc-sun" />
          </g>
        )}

        {/* Labels — sit immediately below the dotted arc dots */}
        <text x={startPos.x} y={ARC_Y0 + 12} className="sun-arc-label">
          {t('widget.sun.sunrise')}
        </text>
        <text x={noonPos.x} y={ARC_Y0 + 12} className="sun-arc-label">
          {t('widget.sun.noon')}
        </text>
        <text x={endPos.x} y={ARC_Y0 + 12} className="sun-arc-label">
          {t('widget.sun.sunset')}
        </text>

        {/* Times — tight under labels */}
        <text x={startPos.x} y={ARC_Y0 + 26} className="sun-arc-time">
          {fmt12(sunrise, cityTz)}
        </text>
        <text x={noonPos.x} y={ARC_Y0 + 26} className="sun-arc-time">
          {fmt12(solarNoon, cityTz)}
        </text>
        <text x={endPos.x} y={ARC_Y0 + 26} className="sun-arc-time">
          {fmt12(sunset, cityTz)}
        </text>
      </svg>
    </div>
  );
}

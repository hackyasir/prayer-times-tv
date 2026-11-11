// ── MoonArc — moon arc with phase indicator, swaps in at night ──────────────
//
// Mirrors SunArc structure (same viewBox, same Bézier math) but draws the
// MOON's path across the sky between moonrise and moonset. The "current
// position" dot is replaced by a styled SVG depicting the actual moon
// phase (new / waxing / waning / full / etc.).
//
// Night-mode replacement for SunArc — swaps in when the sun is below horizon.
// App.jsx picks which to render based on whether the sun is currently up
// (between sunrise and sunset → SunArc, otherwise → MoonArc).
//
// Data source: suncalc — a small (5KB) MIT-licensed library that returns
// moon rise/set times and phase fraction (0..1) from lat/lng/date. The
// alternative (manual astronomy formulas) is error-prone because the moon's
// orbit is irregular; suncalc is the standard solution.
//
// STYLING: all visual styling lives in CSS (.moon-arc-* classes in
// src/styles/widgets.css). JSX = structure + data only.

import { memo } from 'react';
import SunCalc from 'suncalc';
import { fmt12 } from '../../lib/formatters.js';
import { useT } from '../../i18n/I18nContext.jsx';
import { moonLitPath, brightLimbRotation, phaseShape } from '../../lib/moonPhase.js';

// Same viewBox as SunArc so the two components render at identical size
// when swapped. See SunArc.jsx for full geometry explanation.
const ARC_W = 400;
const ARC_H = 84; // matches SunArc — accommodates larger labels
const PAD_X = 44; // wide enough that centre-anchored end labels stay in viewBox
const ARC_Y0 = 46;
const ARC_Y1 = 8;

/** Quadratic Bézier point at parameter t ∈ [0..1]. */
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

/**
 * The moon at (cx, cy), radius r: the dark disc, the lit part on top, and a
 * faint outline. `fraction` is the illuminated fraction (0..1);
 * `rotation` (degrees) turns the bright limb toward the sun — see
 * lib/moonPhase.js for the geometry.
 */
function MoonPhase({ cx, cy, r, fraction, rotation }) {
  const lit = moonLitPath(cx, cy, r, fraction);
  // Halo glow — strongest at full moon, none at new moon.
  const haloOpacity = fraction * 0.4;
  return (
    <g className="moon-arc-phase">
      {haloOpacity > 0.02 && (
        <circle cx={cx} cy={cy} r={r * 1.8} className="moon-arc-halo" opacity={haloOpacity} />
      )}
      <circle cx={cx} cy={cy} r={r} className="moon-arc-dark" />
      {lit && (
        <path
          d={lit}
          className="moon-arc-lit"
          transform={`rotate(${rotation.toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}
        />
      )}
      {/* Subtle outline so the moon is visible even near new moon */}
      <circle cx={cx} cy={cy} r={r} className="moon-arc-ring" />
    </g>
  );
}

function MoonArc({ lat, lng, now, cityTz, phaseOverride }) {
  const { t } = useT();

  // Calculate moon rise/set for TODAY at this location
  const moonTimes = SunCalc.getMoonTimes(now, lat, lng);
  let { rise: moonrise, set: moonset } = moonTimes;

  // suncalc returns null when the moon doesn't rise/set on a given day
  // (e.g. near poles). Fall back to "yesterday's rise" or "tomorrow's set"
  // so we always have a valid window.
  if (!moonrise || !moonset) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const prevTimes = SunCalc.getMoonTimes(yesterday, lat, lng);
    const nextTimes = SunCalc.getMoonTimes(tomorrow, lat, lng);
    if (!moonrise) moonrise = prevTimes.rise;
    if (!moonset) moonset = nextTimes.set;
    if (!moonrise || !moonset) return null; // truly degenerate, bail
  }

  // If moonset is BEFORE moonrise (e.g. moon rises evening, sets next morning),
  // swap or use tomorrow's set. SunCalc returns whatever happened "today",
  // so when moonrise > moonset we know moonset is for the wrong cycle.
  if (moonset < moonrise) {
    const tomorrow = new Date(moonrise.getTime() + 24 * 60 * 60 * 1000);
    const nextTimes = SunCalc.getMoonTimes(tomorrow, lat, lng);
    if (nextTimes.set) moonset = nextTimes.set;
  }

  // Moon transit ≈ midpoint between rise and set (good enough — exact
  // transit requires more astronomy, but visually the arc apex matches).
  const moonTransit = new Date((moonrise.getTime() + moonset.getTime()) / 2);

  // The real moon: lit fraction, and the bright limb's angle from the
  // zenith (suncalc), so the crescent is lit on the correct side and tilted
  // as it looks from this location. The Test Phase footer button
  // (phaseOverride, 0..1 through the cycle) shows an untilted preview.
  let moonFraction;
  let moonRotation;
  if (phaseOverride != null) {
    ({ fraction: moonFraction, rotation: moonRotation } = phaseShape(phaseOverride));
  } else {
    const illum = SunCalc.getMoonIllumination(now);
    const pos = SunCalc.getMoonPosition(now, lat, lng);
    moonFraction = illum.fraction;
    moonRotation = brightLimbRotation(illum.angle - pos.parallacticAngle);
  }

  // Position along arc — 0 at moonrise, 1 at moonset
  const total = moonset - moonrise;
  const elapsed = now - moonrise;
  const tRaw = total > 0 ? elapsed / total : 0;
  const tClamped = Math.max(0, Math.min(1, tRaw));
  const inMoonNight = tRaw >= 0 && tRaw <= 1;
  const moonPos = bezierPoint(tClamped);

  const transitPos = bezierPoint(0.5);
  const startPos = { x: PAD_X, y: ARC_Y0 };
  const endPos = { x: ARC_W - PAD_X, y: ARC_Y0 };
  const arcPath = `M${startPos.x},${startPos.y} Q${ARC_W / 2},${ARC_Y1} ${endPos.x},${endPos.y}`;

  return (
    <div className="sun-arc moon-arc">
      <svg
        className="sun-arc-svg moon-arc-svg"
        viewBox={`0 0 ${ARC_W} ${ARC_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Moon arc"
      >
        {/* Dotted full arc (always drawn) */}
        <path d={arcPath} className="sun-arc-path moon-arc-path" />
        {/* Bright overlay — only while moon is in the sky */}
        {inMoonNight && <path d={arcPath} className="sun-arc-path-active moon-arc-path-active" />}

        {/* Marker dots — moonrise / transit / moonset */}
        <circle
          cx={startPos.x}
          cy={startPos.y}
          r="2.5"
          className="sun-arc-marker moon-arc-marker"
        />
        <circle
          cx={transitPos.x}
          cy={transitPos.y}
          r="2"
          className="sun-arc-marker moon-arc-marker"
        />
        <circle cx={endPos.x} cy={endPos.y} r="2.5" className="sun-arc-marker moon-arc-marker" />

        {/* Current moon — phase visualization */}
        {inMoonNight && (
          <MoonPhase
            cx={moonPos.x}
            cy={moonPos.y}
            r={6}
            fraction={moonFraction}
            rotation={moonRotation}
          />
        )}

        {/* Labels — moonrise / transit / moonset */}
        <text x={startPos.x} y={ARC_Y0 + 12} className="sun-arc-label">
          {t('widget.moon.moonrise')}
        </text>
        <text x={transitPos.x} y={ARC_Y0 + 12} className="sun-arc-label">
          {t('widget.moon.transit')}
        </text>
        <text x={endPos.x} y={ARC_Y0 + 12} className="sun-arc-label">
          {t('widget.moon.moonset')}
        </text>

        {/* Times — tight under labels */}
        <text x={startPos.x} y={ARC_Y0 + 26} className="sun-arc-time">
          {fmt12(moonrise, cityTz)}
        </text>
        <text x={transitPos.x} y={ARC_Y0 + 26} className="sun-arc-time">
          {fmt12(moonTransit, cityTz)}
        </text>
        <text x={endPos.x} y={ARC_Y0 + 26} className="sun-arc-time">
          {fmt12(moonset, cityTz)}
        </text>
      </svg>
    </div>
  );
}

// Re-renders only when its props change (not on every clock tick).
export default memo(MoonArc);

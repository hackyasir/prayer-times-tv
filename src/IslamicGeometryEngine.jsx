/**
 * IslamicGeometryEngine — the background art
 * ════════════════════════════════════════════
 * A star pattern built by Hankin's method on the 4.8.8 tiling, a central
 * shamsa (rosette), islimi scrolls, and top and bottom borders of cartouches
 * with boteh. The geometry lives in lib/geometryArt.js; this component picks
 * sizes, colours and per-prayer layer weights, and draws one <path> per
 * layer (a handful of elements rather than hundreds — cheap for TV
 * browsers).
 *
 * Drawn at low opacity so the content above always stays readable; lines
 * are at least 1 px wide so they render crisply instead of as blurred
 * hairlines.
 */

import { memo, useMemo, useRef, useEffect, useState } from 'react';
import {
  starPatternPath,
  starHighlightPath,
  shamsaPaths,
  islimiPaths,
  borderPaths,
} from './lib/geometryArt.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ── Per-prayer layer weights (0 = hidden) ────────────────────────────────────
const LAYERS = {
  fajr: { lattice: 0.5, shamsa: 1.0, scrolls: 0.0, boteh: 0.55, stars: 0.45, border: 0.5 },
  sunrise: { lattice: 0.35, shamsa: 0.5, scrolls: 1.0, boteh: 0.3, stars: 0.2, border: 0.4 },
  dhuhr: { lattice: 0.7, shamsa: 0.6, scrolls: 0.4, boteh: 0.3, stars: 1.0, border: 0.8 },
  asr: { lattice: 0.45, shamsa: 0.5, scrolls: 1.0, boteh: 0.4, stars: 0.5, border: 0.6 },
  maghrib: { lattice: 0.6, shamsa: 1.0, scrolls: 0.8, boteh: 0.6, stars: 0.6, border: 1.0 },
  isha: { lattice: 0.75, shamsa: 0.7, scrolls: 0.3, boteh: 0.4, stars: 1.0, border: 0.7 },
};

const PALETTES = {
  fajr: { a: '#8b78a0', b: '#c8956e', bg: '#4a3060' },
  sunrise: { a: '#d4844a', b: '#c9a02c', bg: '#6b2a10' },
  dhuhr: { a: '#4a7ca0', b: '#8bb8cc', bg: '#1a3050' },
  asr: { a: '#c09040', b: '#d4a060', bg: '#6b4810' },
  maghrib: { a: '#9a2a4a', b: '#c84020', bg: '#4a0a20' },
  isha: { a: '#2a3870', b: '#4a5090', bg: '#0a0a30' },
};

// Per-theme colour families: hi = brightest accent, mid = body colour,
// lo = shadow. Blended with the prayer palette below.
const THEME_PALETTES = {
  'Classic Gold': { hi: '#F0C96A', mid: '#C9A84C', lo: '#5a3a08', tint: 0.45 },
  'Emerald Night': { hi: '#7eeaaa', mid: '#2ecc71', lo: '#083820', tint: 0.5 },
  'Royal Blue': { hi: '#a0c8f8', mid: '#4A90E2', lo: '#081840', tint: 0.5 },
  'Midnight Teal': { hi: '#80eef8', mid: '#00BCD4', lo: '#003840', tint: 0.48 },
  'Warm Sand': { hi: '#f0c8a0', mid: '#D4956A', lo: '#4a2808', tint: 0.45 },
  'Pure White': { hi: '#ffffff', mid: '#8a7060', lo: '#2a2018', tint: 0.35 },
};

function mixHex(hex1, hex2, t) {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex1);
  const b = parse(hex2);
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round(v * (1 - t) + b[i] * t)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

// tint = 0 → pure prayer colours, tint = 1 → pure theme colours
function blendPal(prayerPal, themePal) {
  const t = themePal.tint;
  return {
    a: mixHex(prayerPal.a, themePal.mid, t),
    b: mixHex(prayerPal.b, themePal.hi, t),
    bg: mixHex(prayerPal.bg, themePal.lo, t * 0.6),
  };
}

// ── component ─────────────────────────────────────────────────────────────────
function IslamicGeometryEngine({
  activePrayer = 'dhuhr',
  sunElevation = 45,
  minutesToNext = 60,
  theme = 'Classic Gold',
  ecoMode = false,
}) {
  const svgRef = useRef(null);
  const [size, setSize] = useState({ W: 1920, H: 1080 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ W: Math.ceil(e.contentRect.width), H: Math.ceil(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H } = size;
  const prayer = LAYERS[activePrayer] ? activePrayer : 'dhuhr';
  const lw = LAYERS[prayer];
  const themePal = THEME_PALETTES[theme] || THEME_PALETTES['Classic Gold'];
  const pal = blendPal(PALETTES[prayer], themePal);
  const accent = themePal.hi;

  // Master opacity: a little stronger at night, when the screen is darker.
  const ecoScalar = ecoMode ? 0.72 : 1;
  const masterOp =
    sunElevation > 0
      ? lerp(0.18, 0.26, clamp(sunElevation / 90, 0, 1))
      : lerp(0.22, 0.3, clamp(-sunElevation / 18, 0, 1));

  // Line width (CSS px): finer in daylight, never under 1 px.
  const sw = lerp(1.6, 1.1, clamp(sunElevation / 90, 0, 1));
  // The rosette grows slightly over the last half hour before a prayer.
  const scale = minutesToNext <= 30 ? lerp(1.0, 1.18, clamp(1 - minutesToNext / 30, 0, 1)) : 1.0;

  const minSide = Math.min(W, H);
  const medR = minSide * 0.21 * scale;

  // The pattern and borders depend only on the screen size, so they are
  // built once. The rosette and scrolls are rebuilt as the rosette grows
  // (once a minute in the last half hour) — measured cheaper than scaling
  // them with an SVG transform, which makes the browser redraw the masked
  // layer.
  const field = useMemo(() => {
    if (W < 10 || H < 10) return null;
    const lattice = starPatternPath(W, H, minSide * 0.075, W / 2, H / 2);
    const count = Math.max(3, Math.round(W / (H * 0.27)));
    const border = borderPaths(W, H, count, H * 0.081, H * 0.028);
    return {
      lattice: lattice.d,
      stars: starHighlightPath(lattice.octagons, minSide * 0.075),
      frames: border.frames,
      boteh: border.boteh,
      bands: border.bands,
    };
  }, [W, H, minSide]);
  const centre = useMemo(() => {
    if (W < 10 || H < 10) return null;
    const shamsa = shamsaPaths(W / 2, H / 2, medR);
    const islimi = islimiPaths(W / 2, H / 2, medR, medR * 1.75);
    return { rim: shamsa.rim, detail: shamsa.detail, stems: islimi.stems, leaves: islimi.leaves };
  }, [W, H, medR]);
  const data = field && centre ? { ...field, ...centre } : null;

  if (!data) {
    return <svg ref={svgRef} aria-hidden="true" className="geometry-engine" />;
  }

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="geometry-engine"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* One colour field for the whole screen (userSpaceOnUse), so shapes
            share a single gradient instead of each getting its own. */}
        <radialGradient
          id="geo-radial"
          gradientUnits="userSpaceOnUse"
          cx={W / 2}
          cy={H / 2}
          r={Math.max(W, H) * 0.55}
        >
          <stop offset="0%" stopColor={pal.b} />
          <stop offset="45%" stopColor={pal.a} />
          <stop offset="100%" stopColor={mixHex(pal.a, pal.bg, 0.5)} />
        </radialGradient>
        <linearGradient id="geo-linear" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={H}>
          <stop offset="0%" stopColor={accent} />
          <stop offset="55%" stopColor={pal.a} />
          <stop offset="100%" stopColor={pal.b} />
        </linearGradient>
        {/* The rosette and the borders sit on the pattern: hide the pattern
            beneath them. */}
        <mask id="geo-under-shamsa" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <rect width={W} height={H} fill="white" />
          {lw.shamsa > 0 && <path d={data.rim} fill="black" />}
          {lw.border > 0 &&
            data.bands.map((b) => (
              <rect key={b.top} x={0} y={b.top} width={W} height={b.bottom - b.top} fill="black" />
            ))}
        </mask>
      </defs>

      <g opacity={masterOp * ecoScalar} fill="none" strokeLinejoin="round" strokeLinecap="round">
        <g mask="url(#geo-under-shamsa)">
          {lw.lattice > 0 && (
            <path
              d={data.lattice}
              stroke="url(#geo-linear)"
              strokeWidth={Math.max(1, sw * 0.7)}
              opacity={lw.lattice * 0.55}
            />
          )}
          {lw.stars > 0 && (
            <path
              d={data.stars}
              stroke="url(#geo-radial)"
              strokeWidth={Math.max(1, sw * 0.85)}
              opacity={lw.stars * 0.8}
            />
          )}
        </g>

        {lw.border > 0 && (
          <path
            d={data.frames}
            stroke="url(#geo-linear)"
            strokeWidth={Math.max(1, sw * 0.85)}
            opacity={lw.border * 0.72}
          />
        )}
        {lw.boteh > 0 && (
          <path
            d={data.boteh}
            stroke="url(#geo-linear)"
            strokeWidth={Math.max(1, sw * 0.75)}
            opacity={lw.boteh * 0.85}
          />
        )}

        {lw.scrolls > 0 && (
          <>
            <path
              d={data.stems}
              stroke="url(#geo-radial)"
              strokeWidth={Math.max(1.2, sw * 1.1)}
              opacity={lw.scrolls * 0.9}
            />
            <path
              d={data.leaves}
              stroke="url(#geo-radial)"
              strokeWidth={Math.max(1, sw * 0.85)}
              opacity={lw.scrolls * 0.8}
            />
          </>
        )}

        {lw.shamsa > 0 && (
          <g stroke="url(#geo-radial)" opacity={lw.shamsa * 0.95}>
            <path
              d={data.rim}
              fill="url(#geo-radial)"
              fillOpacity={0.14}
              strokeWidth={Math.max(1.2, sw)}
            />
            <path d={data.detail} strokeWidth={Math.max(1, sw * 0.85)} />
          </g>
        )}
      </g>
    </svg>
  );
}

// Re-renders only when its props change (not on every clock tick).
export default memo(IslamicGeometryEngine);

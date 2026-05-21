/**
 * PersianArtEngine — subtle procedural Persian art background
 * ════════════════════════════════════════════════════════════
 * Six motifs from Persian carpet / Safavid manuscript tradition:
 *   ① Toranj medallion  ② Islimi vine scrolls  ③ Shah Abbasi palmette
 *   ④ Boteh (paisley)  ⑤ Decagram (10-pt star)  ⑥ Border cartouche
 *
 * All drawn at 6–14 % opacity so UI content is always fully readable.
 */

import { useMemo, useRef, useEffect, useState } from 'react';

// ── tiny math helpers ─────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const c = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;

function ngon(n, cx, cy, r, a0 = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (TAU * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ── ⓪ Girih lattice — the geometric backbone (4.8.8 Archimedean tiling) ─────
/**
 * Returns an array of polygon outline path strings tiling the viewport.
 * This is the canonical Persian/Islamic girih grid: octagons + squares.
 * Each octagon has circumradius r; squares fill the diagonal gaps.
 */
function buildGirihLattice(W, H, r) {
  const s = 2 * r * Math.sin(Math.PI / 8); // octagon side
  const step = r * Math.sqrt(2) + s; // unit cell size
  const paths = [];
  const pad = step * 1.5;
  const cols = Math.ceil((W + pad * 2) / step) + 2;
  const rows = Math.ceil((H + pad * 2) / step) + 2;

  const poly = (pts) => 'M ' + pts.map(([x, y]) => c(x, y)).join(' L ') + ' Z';

  for (let row = -2; row < rows; row++) {
    for (let col = -2; col < cols; col++) {
      const ox = col * step + step / 2;
      const oy = row * step + step / 2;
      // Octagon
      paths.push(poly(ngon(8, ox, oy, r, Math.PI / 8)));
      // Square in the +x,+y diagonal gap
      const sq = step / 2;
      const sqR = ((s * Math.SQRT2) / 2) * 0.85;
      paths.push(poly(ngon(4, ox + sq, oy + sq, sqR, Math.PI / 4)));
    }
  }
  return paths;
}

// ── ① Toranj medallion ───────────────────────────────────────────────────────
function buildToranj(cx, cy, r) {
  const paths = [];

  // outer 12-lobe scallop ring
  const outer = ngon(12, cx, cy, r, -Math.PI / 2);
  const inner = ngon(12, cx, cy, r * 0.72, -Math.PI / 2 + Math.PI / 12);
  let s = `M ${c(outer[0][0], outer[0][1])}`;
  for (let i = 0; i < 12; i++) {
    const [ix, iy] = inner[i];
    const [ox, oy] = outer[(i + 1) % 12];
    s += ` L ${c(ix, iy)} L ${c(ox, oy)}`;
  }
  paths.push(s + ' Z');

  // 8 tapered petals in the middle ring
  for (let i = 0; i < 8; i++) {
    const a1 = (TAU * i) / 8 - Math.PI / 2;
    const a2 = a1 + TAU / 8;
    const am = (a1 + a2) / 2;
    const tr = r * 0.63;
    const br = r * 0.28;
    const tx = cx + tr * Math.cos(am),
      ty = cy + tr * Math.sin(am);
    const lx = cx + br * Math.cos(a1),
      ly = cy + br * Math.sin(a1);
    const rx = cx + br * Math.cos(a2),
      ry = cy + br * Math.sin(a2);
    const lcp = [lerp(lx, tx, 0.5) - (ly - ty) * 0.25, lerp(ly, ty, 0.5) + (lx - tx) * 0.25];
    const rcp = [lerp(rx, tx, 0.5) + (ry - ty) * 0.25, lerp(ry, ty, 0.5) - (rx - tx) * 0.25];
    paths.push(
      `M ${c(lx, ly)} C ${c(lcp[0], lcp[1])} ${c(tx, ty)} ${c(tx, ty)} ` +
        `C ${c(tx, ty)} ${c(rcp[0], rcp[1])} ${c(rx, ry)} Z`
    );
  }

  // 10-pointed star core (decagram)
  paths.push(...buildDecagram(cx, cy, r * 0.32, r * 0.15));

  // centre circle
  const cr = r * 0.08;
  paths.push(
    `M ${c(cx + cr, cy)} A ${cr.toFixed(2)} ${cr.toFixed(2)} 0 1 1 ${c(cx + cr - 0.01, cy)} Z`
  );

  return paths;
}

// ── ② Islimi vine scrolls ────────────────────────────────────────────────────
function buildIslimi(cx, cy, fieldR, arms) {
  const scrolls = [],
    palms = [];

  for (let i = 0; i < arms; i++) {
    const base = (TAU * i) / arms;

    // parametric spiral point
    const sp = (t) => {
      const a = base + t * 1.35;
      const r = fieldR * (0.18 + t * 0.78);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };

    const [p0x, p0y] = sp(0);
    const [p1x, p1y] = sp(0.35);
    const [p2x, p2y] = sp(0.65);
    const [p3x, p3y] = sp(1.0);

    // S-curve cubic bézier
    const cp1x = lerp(p0x, p1x, 0.5) - (p1y - p0y) * 0.35;
    const cp1y = lerp(p0y, p1y, 0.5) + (p1x - p0x) * 0.35;
    const cp2x = lerp(p2x, p3x, 0.5) + (p3y - p2y) * 0.35;
    const cp2y = lerp(p2y, p3y, 0.5) - (p3x - p2x) * 0.35;
    const mcp1x = lerp(p1x, p2x, 0.3) - (p2y - p1y) * 0.4;
    const mcp1y = lerp(p1y, p2y, 0.3) + (p2x - p1x) * 0.4;
    const mcp2x = lerp(p1x, p2x, 0.7) + (p2y - p1y) * 0.4;
    const mcp2y = lerp(p1y, p2y, 0.7) - (p2x - p1x) * 0.4;

    scrolls.push(
      `M ${c(p0x, p0y)} C ${c(cp1x, cp1y)} ${c(mcp1x, mcp1y)} ${c(p1x, p1y)} ` +
        `C ${c(mcp2x, mcp2y)} ${c(cp2x, cp2y)} ${c(p3x, p3y)}`
    );

    // bifurcation branch from ~65% along scroll
    const ba = base - 0.55;
    const bx = p2x + fieldR * 0.22 * Math.cos(ba);
    const by = p2y + fieldR * 0.22 * Math.sin(ba);
    const bcx = lerp(p2x, bx, 0.5) - (by - p2y) * 0.4;
    const bcy = lerp(p2y, by, 0.5) + (bx - p2x) * 0.4;
    scrolls.push(`M ${c(p2x, p2y)} Q ${c(bcx, bcy)} ${c(bx, by)}`);

    // palmette at primary tip + bifurcation tip
    palms.push(...buildPalmette(p3x, p3y, fieldR * 0.09, base + Math.PI / 2));
    palms.push(...buildPalmette(bx, by, fieldR * 0.065, ba + Math.PI / 2));
  }

  return { scrolls, palms };
}

// ── ③ Shah Abbasi palmette ───────────────────────────────────────────────────
function buildPalmette(cx, cy, r, a) {
  const paths = [];
  const n = 7,
    fan = Math.PI * 0.82;
  const bx = cx + r * 0.14 * Math.cos(a);
  const by = cy + r * 0.14 * Math.sin(a);

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pa = a - fan / 2 + t * fan;
    const tx = cx + r * Math.cos(pa);
    const ty = cy + r * Math.sin(pa);
    const cpx = cx + r * 0.62 * Math.cos(pa + (t - 0.5) * 0.28);
    const cpy = cy + r * 0.62 * Math.sin(pa + (t - 0.5) * 0.28);
    paths.push(`M ${c(bx, by)} Q ${c(cpx, cpy)} ${c(tx, ty)}`);
  }

  // stamen circle
  const sr = r * 0.11;
  const sx = cx + r * 0.18 * Math.cos(a),
    sy = cy + r * 0.18 * Math.sin(a);
  paths.push(
    `M ${c(sx + sr, sy)} A ${sr.toFixed(2)} ${sr.toFixed(2)} 0 1 1 ${c(sx + sr - 0.01, sy)} Z`
  );

  return paths;
}

// ── ④ Boteh / paisley ────────────────────────────────────────────────────────
function buildBoteh(cx, cy, r, angle) {
  const br = r * 0.44;
  const tx = cx + r * Math.cos(angle);
  const ty = cy + r * Math.sin(angle);
  const lx = cx + br * Math.cos(angle + Math.PI * 0.64);
  const ly = cy + br * Math.sin(angle + Math.PI * 0.64);
  const rx = cx + br * Math.cos(angle - Math.PI * 0.64);
  const ry = cy + br * Math.sin(angle - Math.PI * 0.64);
  const crx = tx + r * 0.17 * Math.cos(angle + Math.PI * 0.38);
  const cry = ty + r * 0.17 * Math.sin(angle + Math.PI * 0.38);
  const lcp = [lerp(lx, crx, 0.6) - (ty - ly) * 0.28, lerp(ly, cry, 0.6) + (tx - lx) * 0.28];
  const rcp = [lerp(rx, crx, 0.6) + (ty - ry) * 0.28, lerp(ry, cry, 0.6) - (tx - rx) * 0.28];

  return [
    `M ${c(lx, ly)} C ${c(lcp[0], lcp[1])} ${c(crx, cry)} ${c(crx, cry)} ` +
      `C ${c(crx, cry)} ${c(rcp[0], rcp[1])} ${c(rx, ry)} ` +
      `A ${br.toFixed(2)} ${br.toFixed(2)} 0 0 1 ${c(lx, ly)} Z`,
    `M ${c(cx, cy)} Q ${c(lerp(cx, tx, 0.38), lerp(cy, ty, 0.38))} ${c(lerp(cx, tx, 0.68), lerp(cy, ty, 0.68))}`,
  ];
}

function buildBotehField(W, H, r) {
  const all = [],
    step = r * 2.35;
  const rows = Math.ceil(H / step) + 3;
  const cols = Math.ceil(W / step) + 3;
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0) - step;
      const y = row * step - step;
      const a = -Math.PI / 2 + ((row % 4) * Math.PI) / 14;
      all.push(...buildBoteh(x, y, r, a));
    }
  }
  return all;
}

// ── ⑤ Decagram (10-pt star) ──────────────────────────────────────────────────
function buildDecagram(cx, cy, outerR, innerR) {
  const outer = ngon(10, cx, cy, outerR, -Math.PI / 2);
  const inner = ngon(10, cx, cy, innerR, -Math.PI / 2 + Math.PI / 10);
  const full = [];
  for (let i = 0; i < 10; i++) {
    full.push(outer[i]);
    full.push(inner[i]);
  }
  const poly = (pts) => 'M ' + pts.map(([x, y]) => c(x, y)).join(' L ') + ' Z';
  return [poly(full), poly(outer)];
}

// ── ⑥ Border cartouches ──────────────────────────────────────────────────────
function buildBorderCartouches(W, H, count, r) {
  const paths = [];
  const cw = W / count;
  for (let side = 0; side < 2; side++) {
    const y = side === 0 ? r * 1.4 : H - r * 1.4;
    const d = side === 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const x = cw * i + cw / 2;
      const hw = cw * 0.36,
        hh = r * 0.85;
      // ogival pointed oval
      paths.push(
        `M ${c(x, y)} C ${c(x - hw, y)} ${c(x - hw, y + d * hh)} ${c(x, y + d * hh)} ` +
          `C ${c(x + hw, y + d * hh)} ${c(x + hw, y)} ${c(x, y)} Z`
      );
      // inner smaller repeat
      const s = 0.58;
      paths.push(
        `M ${c(x, y)} C ${c(x - hw * s, y)} ${c(x - hw * s, y + d * hh * s)} ${c(x, y + d * hh * s)} ` +
          `C ${c(x + hw * s, y + d * hh * s)} ${c(x + hw * s, y)} ${c(x, y)} Z`
      );
    }
  }
  return paths;
}

// ── prayer config ─────────────────────────────────────────────────────────────
const LAYERS = {
  fajr: { lattice: 0.35, toranj: 1.0, scrolls: 0.0, boteh: 0.55, deka: 0.45, border: 0.5 },
  sunrise: { lattice: 0.2, toranj: 0.5, scrolls: 1.0, boteh: 0.3, deka: 0.2, border: 0.4 },
  dhuhr: { lattice: 0.55, toranj: 0.6, scrolls: 0.4, boteh: 0.3, deka: 1.0, border: 0.8 },
  asr: { lattice: 0.3, toranj: 0.5, scrolls: 1.0, boteh: 0.4, deka: 0.5, border: 0.6 },
  maghrib: { lattice: 0.45, toranj: 1.0, scrolls: 0.8, boteh: 0.6, deka: 0.6, border: 1.0 },
  isha: { lattice: 0.6, toranj: 0.7, scrolls: 0.3, boteh: 0.4, deka: 1.0, border: 0.7 },
};

const PALETTES = {
  fajr: { a: '#8b78a0', b: '#c8956e', bg: '#4a3060' },
  sunrise: { a: '#d4844a', b: '#c9a02c', bg: '#6b2a10' },
  dhuhr: { a: '#4a7ca0', b: '#8bb8cc', bg: '#1a3050' },
  asr: { a: '#c09040', b: '#d4a060', bg: '#6b4810' },
  maghrib: { a: '#9a2a4a', b: '#c84020', bg: '#4a0a20' },
  isha: { a: '#2a3870', b: '#4a5090', bg: '#0a0a30' },
};

// Per-theme colour families for the Persian art layer.
// Three roles: hi = brightest accent, mid = body colour, lo = shadow/depth
// These blend with the prayer palette via lerp() to produce the final gradient.
const THEME_PALETTES = {
  'Classic Gold': { hi: '#F0C96A', mid: '#C9A84C', lo: '#5a3a08', tint: 0.45 },
  'Emerald Night': { hi: '#7eeaaa', mid: '#2ecc71', lo: '#083820', tint: 0.5 },
  'Royal Blue': { hi: '#a0c8f8', mid: '#4A90E2', lo: '#081840', tint: 0.5 },
  'Midnight Teal': { hi: '#80eef8', mid: '#00BCD4', lo: '#003840', tint: 0.48 },
  'Warm Sand': { hi: '#f0c8a0', mid: '#D4956A', lo: '#4a2808', tint: 0.45 },
  'Pure White': { hi: '#ffffff', mid: '#8a7060', lo: '#2a2018', tint: 0.35 },
};

// Helper: blend prayer palette with theme palette
// tint=0 → pure prayer colours, tint=1 → pure theme colours
function blendPal(prayerPal, themePal) {
  const t = themePal.tint;
  // simple hex lerp via numeric blend
  const mix = (hex1, hex2, t) => {
    const parse = (h) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = parse(hex1),
      [r2, g2, b2] = parse(hex2);
    const r = Math.round(r1 * (1 - t) + r2 * t)
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(g1 * (1 - t) + g2 * t)
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(b1 * (1 - t) + b2 * t)
      .toString(16)
      .padStart(2, '0');
    return '#' + r + g + b;
  };
  return {
    a: mix(prayerPal.a, themePal.mid, t),
    b: mix(prayerPal.b, themePal.hi, t),
    bg: mix(prayerPal.bg, themePal.lo, t * 0.6),
  };
}

// ── component ─────────────────────────────────────────────────────────────────
export default function IslamicGeometryEngine({
  activePrayer = 'dhuhr',
  sunElevation = 45,
  minutesToNext = 60,
  lunarPhase = 0.5,
  theme = 'Classic Gold',
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
  // Blend prayer colours with theme colours for a cohesive look
  const pal = blendPal(PALETTES[prayer], themePal);
  const accent = themePal.hi; // brightest theme colour for fine stroke details

  // master opacity — visible but non-intrusive background art
  const masterOp =
    sunElevation > 0
      ? lerp(0.18, 0.26, clamp(sunElevation / 90, 0, 1))
      : lerp(0.22, 0.3, clamp(-sunElevation / 18, 0, 1));

  const sw = lerp(1.6, 0.9, clamp(sunElevation / 90, 0, 1));
  const scale = minutesToNext <= 30 ? lerp(1.0, 1.18, clamp(1 - minutesToNext / 30, 0, 1)) : 1.0;

  const medR = Math.min(W, H) * 0.21 * scale;
  const fieldR = Math.min(W, H) * 0.36;
  const botehR = Math.min(W, H) * 0.026;
  const dekaR = Math.min(W, H) * 0.048;
  const isNight = sunElevation < -3;

  const gId = `pg_${prayer}`;
  const g2Id = `pg2_${prayer}`;
  const glId = `pg_glow`;

  const data = useMemo(() => {
    if (W < 10 || H < 10) return {};
    const cx = W / 2,
      cy = H / 2;

    // Geometric backbone — the girih lattice underneath everything
    const latticeR = Math.min(W, H) * 0.075;
    const latticePaths = buildGirihLattice(W, H, latticeR).slice(0, 200);

    const toranjPaths = buildToranj(cx, cy, medR);

    const { scrolls, palms } = buildIslimi(cx, cy, fieldR, 8);

    const botehPaths = buildBotehField(W, H, botehR).slice(0, 280);

    const dekaPos = [
      [cx - fieldR * 0.62, cy - fieldR * 0.38],
      [cx + fieldR * 0.62, cy - fieldR * 0.38],
      [cx - fieldR * 0.62, cy + fieldR * 0.38],
      [cx + fieldR * 0.62, cy + fieldR * 0.38],
      [cx, cy - fieldR * 0.72],
      [cx, cy + fieldR * 0.72],
      [cx - fieldR * 0.88, cy],
      [cx + fieldR * 0.88, cy],
    ];
    const dekaPaths = dekaPos.flatMap(([dx, dy]) => buildDecagram(dx, dy, dekaR, dekaR * 0.44));

    const bc = Math.max(3, Math.round(W / (H * 0.27)));
    const borderPaths = buildBorderCartouches(W, H, bc, H * 0.058);

    return { latticePaths, toranjPaths, scrolls, palms, botehPaths, dekaPaths, borderPaths };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayer, W, H, medR, fieldR, botehR, dekaR]);

  const {
    latticePaths = [],
    toranjPaths = [],
    scrolls = [],
    palms = [],
    botehPaths = [],
    dekaPaths = [],
    borderPaths = [],
  } = data;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        transition: 'opacity 1s ease',
      }}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={gId} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={pal.b} />
          <stop offset="50%" stopColor={pal.a} />
          <stop offset="100%" stopColor={pal.bg} />
        </radialGradient>
        <linearGradient id={g2Id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} />
          <stop offset="60%" stopColor={pal.a} />
          <stop offset="100%" stopColor={pal.b} />
        </linearGradient>
        <filter id={glId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={isNight ? '1.5' : '0.5'} result="b" />
          <feBlend in="SourceGraphic" in2="b" mode="screen" />
        </filter>
      </defs>

      <g opacity={masterOp}>
        {/* ── Girih lattice — geometric backbone, drawn first (deepest) ── */}
        {lw.lattice > 0 && (
          <g
            fill="none"
            stroke={`url(#${g2Id})`}
            strokeWidth={sw * 0.45}
            opacity={lw.lattice * 0.55}
            strokeLinejoin="round"
          >
            {latticePaths.map((d, i) => (
              <path key={`lt${i}`} d={d} />
            ))}
          </g>
        )}

        {/* boteh field — lowest organic layer */}
        {lw.boteh > 0 && (
          <g fill="none" stroke={`url(#${g2Id})`} strokeWidth={sw * 0.8} opacity={lw.boteh * 0.75}>
            {botehPaths.map((d, i) => (
              <path key={`b${i}`} d={d} />
            ))}
          </g>
        )}

        {/* decagram geometric stars */}
        {lw.deka > 0 && (
          <g
            fill="none"
            stroke={`url(#${gId})`}
            strokeWidth={sw * 0.9}
            opacity={lw.deka * 0.88}
            filter={isNight ? `url(#${glId})` : undefined}
          >
            {dekaPaths.map((d, i) => (
              <path key={`d${i}`} d={d} />
            ))}
          </g>
        )}

        {/* islimi vine scrolls */}
        {lw.scrolls > 0 && (
          <g
            fill="none"
            stroke={`url(#${g2Id})`}
            strokeWidth={sw * 1.1}
            strokeLinecap="round"
            opacity={lw.scrolls * 0.9}
          >
            {scrolls.map((d, i) => (
              <path key={`s${i}`} d={d} />
            ))}
          </g>
        )}

        {/* Shah Abbasi palmettes at scroll tips */}
        {lw.scrolls > 0 && (
          <g
            fill="none"
            stroke={`url(#${g2Id})`}
            strokeWidth={sw * 0.8}
            strokeLinecap="round"
            opacity={lw.scrolls * 0.78}
          >
            {palms.map((d, i) => (
              <path key={`p${i}`} d={d} />
            ))}
          </g>
        )}

        {/* border cartouches */}
        {lw.border > 0 && (
          <g fill="none" stroke={`url(#${gId})`} strokeWidth={sw * 1.0} opacity={lw.border * 0.72}>
            {borderPaths.map((d, i) => (
              <path key={`br${i}`} d={d} />
            ))}
          </g>
        )}

        {/* central Toranj medallion — top layer */}
        {lw.toranj > 0 && (
          <g
            stroke={`url(#${gId})`}
            strokeWidth={sw}
            strokeLinejoin="round"
            fill={`url(#${gId})`}
            fillOpacity={0.16}
            opacity={lw.toranj * 0.95}
            filter={isNight ? `url(#${glId})` : undefined}
          >
            {toranjPaths.map((d, i) => (
              <path key={`t${i}`} d={d} />
            ))}
          </g>
        )}

        {/* lunar crescent */}
        {lunarPhase > 0.06 &&
          (() => {
            const cr = Math.min(W, H) * 0.052 * lunarPhase;
            const lx = W * 0.93,
              ly = H * 0.06;
            return (
              <g opacity={lunarPhase * 0.07}>
                <circle cx={lx} cy={ly} r={cr.toFixed(1)} fill={accent} />
                {lunarPhase < 0.88 && (
                  <circle
                    cx={lx - Math.min(W, H) * 0.028 * (1 - lunarPhase)}
                    cy={ly}
                    r={(cr * 0.94).toFixed(1)}
                    fill="var(--t-bg,#000)"
                  />
                )}
              </g>
            );
          })()}
      </g>
    </svg>
  );
}

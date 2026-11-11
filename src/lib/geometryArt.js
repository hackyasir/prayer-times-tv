// ── lib/geometryArt.js — geometry for the background art ─────────────────────
//
// Pure functions that build SVG path data for IslamicGeometryEngine.jsx.
// Every motif follows its traditional construction, so the shapes are exact
// rather than approximated by eye:
//
//   Star pattern   Hankin's "polygons in contact" method on the 4.8.8 tiling
//                  (regular octagons + squares). From each edge midpoint two
//                  rays leave at the contact angle (67.5°); each ray stops
//                  where it meets its neighbour. The octagons become regular
//                  {8/3} stars and the squares four-pointed stars, and every
//                  line runs straight on through the tile edges — the mark of
//                  a correctly built pattern. (E. H. Hankin, 1925; C. S.
//                  Kaplan, "Islamic star patterns from polygons in contact",
//                  2005.)
//   Shamsa         A central rosette with one symmetry throughout (8-fold, the
//                  same as the star pattern): 16-lobed scalloped rim, 8
//                  pointed petals and an {8/3} star.
//   Islimi         Spiral scrolls built from smooth, tangent-continuous curves
//                  that leave the shamsa's rim and end in curls, with leaves
//                  and buds on the stem. Mirrored in pairs, as in carpet
//                  design.
//   Boteh          The Persian teardrop: a round base, one convex and one
//                  concave side, and a tip bent over to one side.
//   Border         Ogee-ended cartouches (inner outline concentric) holding a
//                  pair of boteh, with {8/3} star rosettes between them.
//
// Each builder returns a single path string, so the component renders one
// <path> per layer instead of hundreds of elements. Coordinates are rounded
// to 0.1 px (the viewBox is in CSS pixels).

const TAU = Math.PI * 2;
const r1 = (n) => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)} ${r1(y)}`;

/** Hankin contact angle, in radians, between each ray and its edge. */
export const CONTACT_ANGLE = (67.5 * Math.PI) / 180;

/** Inner/outer radius ratio of the regular star polygon {n/m}. */
export function starRatio(n, m) {
  return Math.cos((m * Math.PI) / n) / Math.cos(((m - 1) * Math.PI) / n);
}

/** Closed polygon through points [[x, y], …]. */
function polygon(points) {
  return `M${points.map(([x, y]) => P(x, y)).join('L')}Z`;
}

/** Circle as two arcs (a single near-closed arc can vanish when rounded). */
export function circle(cx, cy, r) {
  return `M${P(cx - r, cy)}A${r1(r)} ${r1(r)} 0 1 0 ${P(cx + r, cy)}A${r1(r)} ${r1(r)} 0 1 0 ${P(cx - r, cy)}Z`;
}

/**
 * Points of the regular star {n/m}: outer points at radius R (first at angle
 * a0), inner vertices at R·starRatio(n, m), alternating.
 */
export function starPoints(n, m, cx, cy, R, a0 = 0) {
  const inner = R * starRatio(n, m);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (TAU * k) / n;
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    const b = a + Math.PI / n;
    pts.push([cx + inner * Math.cos(b), cy + inner * Math.sin(b)]);
  }
  return pts;
}

// ── Star pattern (Hankin, 4.8.8) ─────────────────────────────────────────────

/**
 * Measurements of the 4.8.8 tiling for octagons of circumradius R.
 *   apothem    octagon centre → edge midpoint
 *   cell       distance between neighbouring octagon centres (2 × apothem)
 *   squareApothem  square centre → edge midpoint ((√2 − 1) × apothem)
 */
export function latticeGeometry(R) {
  const apothem = R * Math.cos(Math.PI / 8);
  return { apothem, cell: 2 * apothem, squareApothem: (Math.SQRT2 - 1) * apothem };
}

/**
 * The Hankin star inside one regular n-gon: points at the edge midpoints
 * (angles phase + k·2π/n, distance `apothem`), inner vertices where the rays
 * from neighbouring midpoints meet. With θ = 67.5° an octagon gives exactly
 * {8/3}.
 */
export function hankinStarPoints(n, cx, cy, apothem, phase, theta = CONTACT_ANGLE) {
  // Triangle centre–midpoint–meeting point: angles π/n, π/2 − θ, π/2 + θ − π/n.
  const meet = (apothem * Math.cos(theta)) / Math.cos(theta - Math.PI / n);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = phase + (TAU * k) / n;
    pts.push([cx + apothem * Math.cos(a), cy + apothem * Math.sin(a)]);
    const b = a + Math.PI / n;
    pts.push([cx + meet * Math.cos(b), cy + meet * Math.sin(b)]);
  }
  return pts;
}

/**
 * Lattice cells covering a W × H area, centred on (cx, cy) so the pattern is
 * symmetric about the screen centre. Octagons at whole cells, squares at
 * half cells; anything wholly outside the area is skipped.
 */
export function latticeCells(W, H, R, cx = W / 2, cy = H / 2) {
  const { cell } = latticeGeometry(R);
  const nx = Math.ceil(cx / cell) + 1;
  const ny = Math.ceil(cy / cell) + 1;
  const nx2 = Math.ceil((W - cx) / cell) + 1;
  const ny2 = Math.ceil((H - cy) / cell) + 1;
  const inView = (x, y) => x > -R && x < W + R && y > -R && y < H + R;
  const octagons = [];
  const squares = [];
  for (let j = -ny; j <= ny2; j++) {
    for (let i = -nx; i <= nx2; i++) {
      const ox = cx + i * cell;
      const oy = cy + j * cell;
      if (inView(ox, oy)) octagons.push({ i, j, x: ox, y: oy });
      const sx = ox + cell / 2;
      const sy = oy + cell / 2;
      if (inView(sx, sy)) squares.push({ i, j, x: sx, y: sy });
    }
  }
  return { octagons, squares };
}

/**
 * The whole star pattern as one path, plus the octagon cells (for the
 * highlight layer).
 */
export function starPatternPath(W, H, R, cx = W / 2, cy = H / 2) {
  const { apothem, squareApothem } = latticeGeometry(R);
  const { octagons, squares } = latticeCells(W, H, R, cx, cy);
  let d = '';
  // Octagon edges face the axes (midpoints at 0°, 45°, …).
  for (const o of octagons) d += polygon(hankinStarPoints(8, o.x, o.y, apothem, 0));
  // Squares sit diamond-wise; their edges face the diagonals.
  for (const s of squares) d += polygon(hankinStarPoints(4, s.x, s.y, squareApothem, Math.PI / 4));
  return { d, octagons };
}

/**
 * Highlight rosettes: in every other octagon (checkerboard), a smaller {8/3}
 * star turned by π/8 so its points aim at the pattern star's inner corners,
 * and a circle through those corners.
 */
export function starHighlightPath(octagons, R) {
  const { apothem } = latticeGeometry(R);
  const meet = apothem * starRatio(8, 3); // the pattern star's inner corners
  let d = '';
  for (const o of octagons) {
    if ((o.i + o.j) % 2 !== 0) continue;
    d += polygon(starPoints(8, 3, o.x, o.y, meet * 0.92, Math.PI / 8));
    d += circle(o.x, o.y, meet * 0.92 * starRatio(8, 3) * 0.62);
  }
  return d;
}

// ── Shamsa (central rosette) ─────────────────────────────────────────────────

/** Pointed (lens) petal along angle `a`, from radius rIn to rOut. */
function lensPetal(cx, cy, a, rIn, rOut, halfWidth) {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const L = rOut - rIn;
  const rho = (L * L) / 4 / (2 * halfWidth) + halfWidth / 2; // arc radius for that bulge
  const bx = cx + ux * rIn;
  const by = cy + uy * rIn;
  const tx = cx + ux * rOut;
  const ty = cy + uy * rOut;
  return `M${P(bx, by)}A${r1(rho)} ${r1(rho)} 0 0 1 ${P(tx, ty)}A${r1(rho)} ${r1(rho)} 0 0 1 ${P(bx, by)}Z`;
}

/** Scalloped rim: `lobes` circular lobes on a base circle, peaking at R. */
export function scallopPath(cx, cy, R, lobes = 16, depth = 0.08) {
  const r0 = R * (1 - depth);
  const half = Math.PI / lobes;
  const chord = 2 * r0 * Math.sin(half);
  const sag = R - r0 * Math.cos(half); // lobe height above the chord
  const rho = (chord * chord) / 4 / (2 * sag) + sag / 2;
  let d = '';
  for (let k = 0; k <= lobes; k++) {
    const a = -Math.PI / 2 + 2 * half * k;
    const x = cx + r0 * Math.cos(a);
    const y = cy + r0 * Math.sin(a);
    d += k === 0 ? `M${P(x, y)}` : `A${r1(rho)} ${r1(rho)} 0 0 1 ${P(x, y)}`;
  }
  return `${d}Z`;
}

/**
 * The shamsa as two paths: `rim` (the filled outline) and `detail` (lines
 * inside). Everything shares 8-fold symmetry and lines up with the star
 * pattern (points along the axes and diagonals).
 */
export function shamsaPaths(cx, cy, R) {
  const rim = scallopPath(cx, cy, R, 16, 0.08);
  let detail = circle(cx, cy, R * 0.86);
  const starR = R * 0.4;
  for (let k = 0; k < 8; k++) {
    const a = (TAU * k) / 8;
    // Petals grow from the star's points…
    detail += lensPetal(cx, cy, a, starR, R * 0.8, R * 0.12);
    // …with a bud between each pair.
    const b = a + Math.PI / 8;
    detail += circle(cx + R * 0.68 * Math.cos(b), cy + R * 0.68 * Math.sin(b), R * 0.035);
  }
  detail += polygon(starPoints(8, 3, cx, cy, starR, 0));
  detail += circle(cx, cy, starR * starRatio(8, 3) * 0.6);
  return { rim, detail };
}

// ── Smooth curves ────────────────────────────────────────────────────────────

/**
 * Smooth path through points (uniform Catmull–Rom converted to cubic
 * Béziers): tangent-continuous everywhere, so no kinks.
 */
export function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M${P(points[0][0], points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${P(c1x, c1y)} ${P(c2x, c2y)} ${P(p2[0], p2[1])}`;
  }
  return d;
}

/**
 * Walk a curve: from (x, y) heading `h`, take `n` steps of length `step`,
 * turning by curvature(t) × step each step (t = 0 … 1, taken at the middle
 * of the step). Returns the points and the final heading.
 */
export function walk(x, y, h, n, step, curvature) {
  const pts = [[x, y]];
  let px = x;
  let py = y;
  let heading = h;
  for (let s = 1; s <= n; s++) {
    heading += curvature((s - 0.5) / n) * step; // midpoint rule
    px += Math.cos(heading) * step;
    py += Math.sin(heading) * step;
    pts.push([px, py]);
  }
  return { pts, heading };
}

/** Pointed leaf (lens) from base (x, y) along heading `h`. */
function leaf(x, y, h, length, widthRatio = 0.3) {
  const tx = x + Math.cos(h) * length;
  const ty = y + Math.sin(h) * length;
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  const nx = -Math.sin(h) * length * widthRatio;
  const ny = Math.cos(h) * length * widthRatio;
  return `M${P(x, y)}Q${P(mx + nx, my + ny)} ${P(tx, ty)}Q${P(mx - nx, my - ny)} ${P(x, y)}Z`;
}

// ── Islimi scrolls ───────────────────────────────────────────────────────────

/**
 * One scroll: a stem of `length` that bends gently (total turn `bend`
 * radians), then coils into a spiral whose curvature rises steadily — a
 * clothoid, the curve of a natural scroll — through `coil` radians.
 * `dir` = +1 turns clockwise on screen, −1 anticlockwise.
 */
export function scrollCurve(x, y, heading, length, bend, coil, dir, stemShare = 0.45) {
  const n = 90;
  const L1 = length * stemShare;
  const L2 = length - L1;
  const avg = coil / L2;
  const c0 = avg * 0.3;
  const c1 = avg * 1.7;
  return walk(x, y, heading, n, length / n, (t) => {
    const s = t * length;
    if (s <= L1) return (dir * bend) / L1;
    return dir * (c0 + ((c1 - c0) * (s - L1)) / L2);
  });
}

/** Centre of a coil: the mean of its last points. */
function coilCentre(pts, share = 0.22) {
  const tail = pts.slice(-Math.max(2, Math.round(pts.length * share)));
  return [
    tail.reduce((sum, p) => sum + p[0], 0) / tail.length,
    tail.reduce((sum, p) => sum + p[1], 0) / tail.length,
  ];
}

/** Heading of a sampled curve at index i. */
function headingAt(pts, i) {
  const [ax, ay] = pts[Math.max(0, i - 1)];
  const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
  return Math.atan2(by - ay, bx - ax);
}

/**
 * Eight scrolls around the shamsa, in four mirrored pairs (mirror axes on
 * the screen's horizontal and vertical). Each stem leaves the rim leaning
 * away from its axis, then coils back toward it, so each pair forms the
 * heart shape of carpet arabesques. A tendril branches off the stem and
 * coils the other way; leaves sit on the outer side; a bud sits in each
 * coil.
 *
 * @returns {{ stems: string, leaves: string }}
 */
export function islimiPaths(cx, cy, rimR, outerR) {
  const innerR = rimR;
  const span = outerR - innerR;
  let stems = '';
  let leaves = '';

  for (let k = 0; k < 8; k++) {
    const axis = Math.floor(k / 2) * (Math.PI / 2); // 0, 90°, 180°, 270°
    const side = k % 2 === 0 ? 1 : -1; // the two halves of a mirrored pair
    // Spring from a tip of the 16-lobed rim (lobe peaks sit at odd multiples
    // of π/16 from each axis), so every stem is attached.
    const start = axis + (side * Math.PI) / 16;
    const x0 = cx + innerR * Math.cos(start);
    const y0 = cy + innerR * Math.sin(start);

    const stem = scrollCurve(x0, y0, start + side * 0.9, span * 1.6, 0.5, 6.5, -side);
    stems += smoothPath(stem.pts);
    const [bx, by] = coilCentre(stem.pts);
    leaves += circle(bx, by, span * 0.03);

    // Tendril: leaves the stem a third of the way along, coils the other way.
    const iBranch = Math.round(stem.pts.length * 0.3);
    const [tx, ty] = stem.pts[iBranch];
    const tendril = scrollCurve(
      tx,
      ty,
      headingAt(stem.pts, iBranch) + side * 0.55,
      span * 0.65,
      0.25,
      4.5,
      side,
      0.35
    );
    stems += smoothPath(tendril.pts);
    const [ux, uy] = coilCentre(tendril.pts);
    leaves += circle(ux, uy, span * 0.02);

    // Leaves on the outer side of the stem, before the coil.
    for (const f of [0.14, 0.42]) {
      const i = Math.round(stem.pts.length * f);
      const [lx, ly] = stem.pts[i];
      leaves += leaf(lx, ly, headingAt(stem.pts, i) - side * 0.8, span * 0.13);
    }
  }
  return { stems, leaves };
}

// ── Boteh ────────────────────────────────────────────────────────────────────

// Unit boteh: base circle radius 1 at the origin, tip up (−y) and bent to
// the right. Cubic segments; the base is a true (Bézier) semicircle.
const K = 0.5523; // cubic approximation of a quarter circle
const BOTEH = [
  // [c1, c2, end] cubic segments, starting at (−1, 0)
  [
    [-1, K],
    [-K, 1],
    [0, 1],
  ], //     base, left quarter
  [
    [K, 1],
    [1, K],
    [1, 0],
  ], //       base, right quarter
  [
    [1, -0.9],
    [0.6, -1.7],
    [1.6, -2.8],
  ], // concave side up to the tip
  [
    [0.6, -3.05],
    [-1, -1.9],
    [-1, 0],
  ], //   convex side back down
];
const BOTEH_START = [-1, 0];

/**
 * Boteh outline (and a concentric inner outline and base circle) centred on
 * the base circle at (x, y), base radius `s`, tip pointing along `angle`
 * (radians; −π/2 = up), mirrored when `flip` is true.
 */
export function botehPath(x, y, s, angle = -Math.PI / 2, flip = false) {
  // Local frame has the tip at −y; rotate so −y maps to `angle`.
  const rot = angle + Math.PI / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const tf = (px, py, scale = 1, ox = 0, oy = 0) => {
    const lx = (flip ? -px : px) * scale + ox;
    const ly = py * scale + oy;
    return P(x + s * (lx * cos - ly * sin), y + s * (lx * sin + ly * cos));
  };
  const outline = (scale, ox, oy) => {
    let d = `M${tf(BOTEH_START[0], BOTEH_START[1], scale, ox, oy)}`;
    for (const [c1, c2, e] of BOTEH) {
      d += `C${tf(c1[0], c1[1], scale, ox, oy)} ${tf(c2[0], c2[1], scale, ox, oy)} ${tf(e[0], e[1], scale, ox, oy)}`;
    }
    return `${d}Z`;
  };
  // Inner outline: 58 % about a point inside the body.
  const ix = flip ? -0.15 : 0.15;
  const inner = outline(0.58, ix * 0.42, -0.35 * 0.42);
  const [bx, by] = [(flip ? -1 : 1) * 0.063, -0.147];
  const base = circle(x + s * (bx * cos - by * sin), y + s * (bx * sin + by * cos), s * 0.22);
  return outline(1, 0, 0) + inner + base;
}

/** Unit-boteh control points, for tests. */
export const BOTEH_SEGMENTS = { start: BOTEH_START, segments: BOTEH };

// ── Border band ──────────────────────────────────────────────────────────────

/** Ogee-ended cartouche centred on (x, y): half-length L, half-height h. */
export function cartouchePath(x, y, L, h) {
  const a = Math.min(L * 0.45, h * 1.1); // length of each ogee end
  const s = (px, py) => P(x + px, y + py);
  return (
    `M${s(-L, 0)}` +
    `C${s(-L + a * 0.5, 0)} ${s(-L + a * 0.5, -h)} ${s(-L + a, -h)}` +
    `L${s(L - a, -h)}` +
    `C${s(L - a * 0.5, -h)} ${s(L - a * 0.5, 0)} ${s(L, 0)}` +
    `C${s(L - a * 0.5, 0)} ${s(L - a * 0.5, h)} ${s(L - a, h)}` +
    `L${s(-L + a, h)}` +
    `C${s(-L + a * 0.5, h)} ${s(-L + a * 0.5, 0)} ${s(-L, 0)}Z`
  );
}

/** Small four-petal blossom (khatai) centred on (x, y). */
function blossom(x, y, r) {
  let d = circle(x, y, r * 0.28);
  for (let k = 0; k < 4; k++) {
    const a = (TAU * k) / 4 + Math.PI / 4;
    d += lensPetal(x, y, a, r * 0.32, r, r * 0.26);
  }
  return d;
}

/**
 * Top and bottom border bands — a frieze, as on a tiled wall or a carpet
 * border: two guard lines, `count` cartouches per band (each with a
 * concentric inner outline) holding a pair of boteh around a blossom, and an
 * {8/3} star rosette at each join.
 *
 * @returns {{ frames: string, boteh: string, bands: {top: number, bottom: number}[] }}
 *   `bands` — where the star pattern is hidden (guard line to screen edge)
 */
export function borderPaths(W, H, count, y0, h) {
  const cw = W / count;
  const L = cw * 0.36;
  const guard = h * 1.25;
  let frames = '';
  let boteh = '';
  const bands = [];
  for (const y of [y0, H - y0]) {
    // The pattern is hidden from the guard lines out to the screen edge.
    bands.push(y < H / 2 ? { top: 0, bottom: y + guard } : { top: y - guard, bottom: H });
    frames += `M${P(0, y - guard)}L${P(W, y - guard)}M${P(0, y + guard)}L${P(W, y + guard)}`;
    for (let i = 0; i < count; i++) {
      const x = cw * i + cw / 2;
      frames += cartouchePath(x, y, L, h);
      frames += cartouchePath(x, y, L * 0.9, h * 0.72);
      // A pair of boteh, bases toward the ends, tips toward the blossom in
      // the middle and bending opposite ways (half-turn symmetry).
      const s = h * 0.34;
      boteh += botehPath(x - L * 0.5, y, s, 0, false);
      boteh += botehPath(x + L * 0.5, y, s, Math.PI, false);
      boteh += blossom(x, y, h * 0.36);
      // Rosette at the join to the next cartouche.
      const jx = cw * i;
      frames += polygon(starPoints(8, 3, jx, y, h * 0.62, 0));
      frames += circle(jx, y, h * 0.8);
    }
    frames += polygon(starPoints(8, 3, W, y, h * 0.62, 0)) + circle(W, y, h * 0.8);
  }
  return { frames, boteh, bands };
}

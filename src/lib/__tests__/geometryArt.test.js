// ── geometryArt.test.js ──────────────────────────────────────────────────
// The background art's constructions: regular stars, a gap-free 4.8.8
// tiling whose lines run straight through tile edges, full-screen coverage,
// scrolls attached to the rosette, and correctly shaped boteh and
// cartouches.

import { describe, it, expect } from 'vitest';
import {
  starRatio,
  starPoints,
  hankinStarPoints,
  latticeGeometry,
  latticeCells,
  starPatternPath,
  shamsaPaths,
  islimiPaths,
  scrollCurve,
  botehPath,
  BOTEH_SEGMENTS,
  cartouchePath,
  borderPaths,
  CONTACT_ANGLE,
} from '../geometryArt.js';

const dist = ([x1, y1], [x2, y2]) => Math.hypot(x1 - x2, y1 - y2);
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** All [x, y] pairs in a path that uses only M, L, C and Q. */
function pathPoints(d) {
  const nums = d
    .replace(/[MLCQZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

describe('star polygons', () => {
  it('uses the exact inner/outer ratio for {n/m}', () => {
    expect(starRatio(8, 3)).toBeCloseTo(0.5412, 4);
    expect(starRatio(10, 3)).toBeCloseTo(0.7265, 4);
    // A regular star's edges are straight across two points: in {8/3} the
    // outer points k and k+3 lie on one line with the inner corners between.
    const pts = starPoints(8, 3, 0, 0, 100);
    const outer = (k) => pts[(2 * k) % 16];
    const innerBetween = pts[1]; // between outer 0 and outer 1
    expect(Math.abs(cross(outer(0), outer(3), innerBetween))).toBeLessThan(1e-6);
  });

  it('Hankin at 67.5° turns an octagon into a regular {8/3} star', () => {
    expect(CONTACT_ANGLE).toBeCloseTo((67.5 * Math.PI) / 180, 12);
    const pts = hankinStarPoints(8, 0, 0, 100, 0);
    expect(dist(pts[0], [0, 0])).toBeCloseTo(100, 9);
    expect(dist(pts[1], [0, 0]) / 100).toBeCloseTo(starRatio(8, 3), 9);
  });

  it('turns a square into a four-pointed star (inner corners at tan 22.5°)', () => {
    const pts = hankinStarPoints(4, 0, 0, 100, Math.PI / 4);
    expect(dist(pts[1], [0, 0]) / 100).toBeCloseTo(Math.SQRT2 - 1, 9);
  });
});

describe('4.8.8 star pattern', () => {
  const R = 80;
  const { apothem, cell, squareApothem } = latticeGeometry(R);

  it('octagons and squares share edges exactly (no gaps)', () => {
    // Octagon at the origin: its diagonal edge midpoint…
    const octMid = [apothem * Math.cos(Math.PI / 4), apothem * Math.sin(Math.PI / 4)];
    // …is the square's edge midpoint facing it.
    const sq = [cell / 2, cell / 2];
    const sqMid = [
      sq[0] + squareApothem * Math.cos((5 * Math.PI) / 4),
      sq[1] + squareApothem * Math.sin((5 * Math.PI) / 4),
    ];
    expect(dist(octMid, sqMid)).toBeLessThan(1e-9);
    // Square side equals octagon side.
    expect(2 * squareApothem).toBeCloseTo(2 * R * Math.sin(Math.PI / 8), 9);
  });

  it('lines run straight on through the shared edge', () => {
    const oct = hankinStarPoints(8, 0, 0, apothem, 0);
    const sq = hankinStarPoints(4, cell / 2, cell / 2, squareApothem, Math.PI / 4);
    const M = oct[2]; // midpoint at 45°
    const octInner = [oct[1], oct[3]]; // inner corners either side of it
    const sqInner = [sq[3], sq[5]]; // the square's corners either side of M
    expect(dist(M, sq[4])).toBeLessThan(1e-9);
    for (const a of octInner) {
      const straight = sqInner.some((b) => Math.abs(cross(a, M, b)) < 1e-6 && dist(a, b) > 0);
      expect(straight).toBe(true);
    }
  });

  it.each([
    [1920, 1080],
    [1080, 1920],
    [3840, 2160],
    [800, 480],
  ])('covers the whole %i × %i screen', (W, H) => {
    const r = Math.min(W, H) * 0.075;
    const { octagons, squares } = latticeCells(W, H, r);
    const centres = [...octagons, ...squares].map((c) => [c.x, c.y]);
    const reach = latticeGeometry(r).cell / 2 + 1e-6; // farthest any point can be
    for (let x = 0; x <= W; x += W / 24) {
      for (let y = 0; y <= H; y += H / 24) {
        const nearest = Math.min(...centres.map((c) => dist(c, [x, y])));
        expect(nearest).toBeLessThanOrEqual(reach);
      }
    }
  });

  it('is centred on the screen, under the rosette', () => {
    const { octagons } = latticeCells(1920, 1080, 80);
    expect(octagons.some((o) => o.x === 960 && o.y === 540)).toBe(true);
    const { d } = starPatternPath(1920, 1080, 80);
    expect(d.startsWith('M')).toBe(true);
  });
});

describe('shamsa and islimi', () => {
  it('builds the rosette rim and details', () => {
    const { rim, detail } = shamsaPaths(500, 500, 200);
    expect(rim).toMatch(/^M.*Z$/);
    expect((rim.match(/A/g) || []).length).toBe(16); // 16 lobes
    expect(detail.length).toBeGreaterThan(100);
  });

  it('attaches every stem to a lobe tip of the rim and keeps it outside', () => {
    const cx = 500;
    const cy = 500;
    const rimR = 200;
    const { stems } = islimiPaths(cx, cy, rimR, rimR * 1.75);
    const subpaths = stems.split('M').filter(Boolean);
    expect(subpaths.length).toBe(16); // 8 stems + 8 tendrils
    for (let i = 0; i < subpaths.length; i += 2) {
      const pts = pathPoints(`M${subpaths[i]}`);
      const [x0, y0] = pts[0];
      expect(Math.hypot(x0 - cx, y0 - cy)).toBeCloseTo(rimR, 0);
      const sixteenths = (Math.atan2(y0 - cy, x0 - cx) / Math.PI) * 16;
      expect(Math.abs(Math.round(sixteenths)) % 2).toBe(1); // odd multiple of π/16
      // On-curve points (every third pair after the start) stay outside the rim.
      for (let k = 3; k < pts.length; k += 3) {
        expect(Math.hypot(pts[k][0] - cx, pts[k][1] - cy)).toBeGreaterThan(rimR - 0.5);
      }
    }
  });

  it('coils: total turn is the bend plus the coil, curvature rising', () => {
    const { pts, heading } = scrollCurve(0, 0, 0, 300, 0.5, 6.5, 1);
    expect(heading).toBeCloseTo(7, 1);
    // Later steps turn more sharply than earlier ones (the spiral tightens).
    const turn = (i) =>
      Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) -
      Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    expect(norm(turn(85))).toBeGreaterThan(norm(turn(60)));
  });
});

describe('boteh', () => {
  const { start, segments } = BOTEH_SEGMENTS;

  it('has a round base that bulges away from the tip', () => {
    const tip = segments[2][2];
    expect(tip[1]).toBeLessThan(-2); // tip up (−y)
    expect(segments[0][2]).toEqual([0, 1]); // lowest point of the base, opposite the tip
    expect(start).toEqual([-1, 0]);
  });

  it('is smooth where the base meets the sides', () => {
    // Right: base arrives going up, concave side leaves going up.
    expect(segments[1][1][0]).toBe(1);
    expect(segments[2][0][0]).toBe(1);
    // Left: convex side arrives going down into the base.
    expect(segments[3][1][0]).toBe(-1);
    expect(segments[0][0][0]).toBe(-1);
  });

  it('points the tip where asked', () => {
    const d = botehPath(0, 0, 10, 0); // tip to the right
    const pts = pathPoints(d.split('A')[0].replace(/Z.*$/, ''));
    const maxX = Math.max(...pts.map((p) => p[0]));
    const minX = Math.min(...pts.map((p) => p[0]));
    expect(maxX).toBeGreaterThan(25);
    expect(minX).toBeGreaterThan(-12);
  });
});

describe('border', () => {
  it('draws cartouches centred on their position, inner outline concentric', () => {
    for (const [L, h] of [
      [100, 30],
      [90, 21.6],
    ]) {
      const pts = pathPoints(cartouchePath(300, 80, L, h));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(300, 6);
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(80, 6);
    }
  });

  it('hides the star pattern from each guard line to the screen edge', () => {
    const { bands } = borderPaths(1920, 1080, 7, 87, 30);
    expect(bands).toEqual([
      { top: 0, bottom: 87 + 37.5 },
      { top: 1080 - 87 - 37.5, bottom: 1080 },
    ]);
  });
});

// ── moonPhase.test.js ────────────────────────────────────────────────────
// The moon's lit shape: crescent, quarter, gibbous and full are bounded by
// the right terminator, and the bright limb points toward the sun.

import { describe, it, expect } from 'vitest';
import SunCalc from 'suncalc';
import { moonLitPath, brightLimbRotation, phaseShape } from '../moonPhase.js';

describe('moonLitPath', () => {
  it('draws nothing at new moon and the whole disc at full moon', () => {
    expect(moonLitPath(0, 0, 10, 0)).toBe('');
    expect(moonLitPath(0, 0, 10, 1)).toBe('M0 -10A10 10 0 1 1 0 10A10 10 0 1 1 0 -10Z');
  });

  it('lights exactly half at a quarter (straight terminator)', () => {
    expect(moonLitPath(0, 0, 10, 0.5)).toBe('M0 -10A10 10 0 0 1 0 10Z');
  });

  it('bulges the terminator toward the bright limb for a crescent', () => {
    // k = 0.1: terminator crosses the equator 8 units toward the limb.
    expect(moonLitPath(0, 0, 10, 0.1)).toBe('M0 -10A10 10 0 0 1 0 10A8 10 0 0 0 0 -10Z');
  });

  it('bulges it the other way for a gibbous moon', () => {
    expect(moonLitPath(0, 0, 10, 0.9)).toBe('M0 -10A10 10 0 0 1 0 10A8 10 0 0 1 0 -10Z');
  });
});

describe('bright limb direction', () => {
  it('maps the angle from the zenith to a screen rotation', () => {
    expect(brightLimbRotation(-Math.PI / 2)).toBeCloseTo(0, 9); // west → right
    expect(Math.abs(brightLimbRotation(Math.PI / 2))).toBeCloseTo(180, 9); // east → left
    expect(brightLimbRotation(0)).toBeCloseTo(-90, 9); // straight up
  });

  it('previews waxing lit on the right and waning on the left', () => {
    expect(phaseShape(0.25).fraction).toBeCloseTo(0.5, 9);
    expect(phaseShape(0.25).rotation).toBe(0);
    expect(phaseShape(0.75).rotation).toBe(180);
    expect(phaseShape(0.75).fraction).toBeCloseTo(0.5, 9);
    expect(phaseShape(0.5).fraction).toBeCloseTo(1, 9);
  });

  // An evening crescent low in the west is lit from below, where the sun has
  // just set — in both hemispheres.
  it.each([
    ['Toronto', 43.65, -79.38],
    ['Sydney', -33.87, 151.21],
  ])('lights an evening crescent from below in %s', (_name, lat, lng) => {
    let found = null;
    const start = Date.UTC(2026, 0, 1);
    for (let m = 0; m < 60 * 24 * 90 && !found; m += 10) {
      const t = new Date(start + m * 60000);
      const sun = SunCalc.getPosition(t, lat, lng);
      if (sun.azimuth < 0 || sun.altitude > -0.03 || sun.altitude < -0.12) continue; // dusk
      const illum = SunCalc.getMoonIllumination(t);
      if (illum.phase < 0.06 || illum.phase > 0.15) continue; // young crescent
      const pos = SunCalc.getMoonPosition(t, lat, lng);
      if (pos.altitude < 0.08) continue;
      found = brightLimbRotation(illum.angle - pos.parallacticAngle);
    }
    expect(found).not.toBeNull();
    expect(Math.sin((found * Math.PI) / 180)).toBeGreaterThan(0.3); // pointing down
  });
});

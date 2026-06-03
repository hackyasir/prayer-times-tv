// ── viewingScale.test.js ─────────────────────────────────────────────────
// Tests the distance→multiplier resolution and the combined type scale.

import { describe, it, expect } from 'vitest';
import {
  resolveViewingScale,
  resolveTypeScale,
  clampCalibration,
  DISTANCE_PRESETS,
} from '../viewingScale.js';

describe('clampCalibration', () => {
  it('clamps to the 0.8–3.0 range', () => {
    expect(clampCalibration(0.5)).toBe(0.8);
    expect(clampCalibration(5)).toBe(3.0);
    expect(clampCalibration(1.5)).toBe(1.5);
  });
  it('falls back to 1.0 for bad input', () => {
    expect(clampCalibration('x')).toBe(1.0);
    expect(clampCalibration(undefined)).toBe(1.0);
    expect(clampCalibration(NaN)).toBe(1.0);
  });
});

describe('resolveViewingScale', () => {
  it('manual mode never scales', () => {
    expect(resolveViewingScale({ mode: 'manual' })).toBe(1.0);
    expect(resolveViewingScale({})).toBe(1.0);
  });
  it('distance mode uses the preset for the bucket', () => {
    expect(resolveViewingScale({ mode: 'distance', distance: 'close' })).toBe(DISTANCE_PRESETS.close.scale);
    expect(resolveViewingScale({ mode: 'distance', distance: 'large' })).toBe(DISTANCE_PRESETS.large.scale);
  });
  it('distance mode falls back to medium for unknown bucket', () => {
    expect(resolveViewingScale({ mode: 'distance', distance: 'nope' })).toBe(DISTANCE_PRESETS.medium.scale);
  });
  it('calibrate mode uses the clamped custom value', () => {
    expect(resolveViewingScale({ mode: 'calibrate', calibrated: 2.2 })).toBe(2.2);
    expect(resolveViewingScale({ mode: 'calibrate', calibrated: 9 })).toBe(3.0);
  });
  it('presets increase monotonically with distance', () => {
    const order = ['close', 'medium', 'large', 'grand'];
    for (let i = 1; i < order.length; i++) {
      expect(DISTANCE_PRESETS[order[i]].scale).toBeGreaterThan(DISTANCE_PRESETS[order[i - 1]].scale);
    }
  });
});

describe('resolveTypeScale', () => {
  it('combines fontScale percent with viewing scale', () => {
    // manual, 100% → 1.0
    expect(resolveTypeScale({ fontScale: 100, mode: 'manual' })).toBeCloseTo(1.0);
    // 120% manual → 1.2
    expect(resolveTypeScale({ fontScale: 120, mode: 'manual' })).toBeCloseTo(1.2);
    // 100% + large distance (1.9) → 1.9
    expect(resolveTypeScale({ fontScale: 100, mode: 'distance', distance: 'large' })).toBeCloseTo(1.9);
    // 110% + medium (1.4) → 1.54
    expect(resolveTypeScale({ fontScale: 110, mode: 'distance', distance: 'medium' })).toBeCloseTo(1.54);
    // calibrate 2.0 at 100% → 2.0
    expect(resolveTypeScale({ fontScale: 100, mode: 'calibrate', calibrated: 2.0 })).toBeCloseTo(2.0);
  });
  it('defaults fontScale to 100 when missing', () => {
    expect(resolveTypeScale({ mode: 'manual' })).toBeCloseTo(1.0);
  });
});

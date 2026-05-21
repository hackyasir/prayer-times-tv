// ── iqamah.test.js ───────────────────────────────────────────────────────
//
// Tests for the shared computeIqamah() helper. This function is the
// single source of truth for iqamah-time calculation across both the live
// dashboard and the printed monthly schedule, so its math has to be right.
//
// Focus areas:
//   - Manual mode: simple adhan + offset addition
//   - Auto mode with buf > 0: rounds to nearest quarter-hour
//   - Auto mode with buf = 0: iqamah = adhan (Maghrib convention)
//   - Safety floor: iqamah never lands BEFORE adhan even at rounding edges
//   - Edge inputs: null adhan, missing options, hour wrap at :45 → :00

import { describe, it, expect } from 'vitest';
import { computeIqamah } from '../iqamah.js';

// Small helper — build a Date at a given HH:MM today. Iqamah math operates
// purely on the time-of-day; the calendar date is irrelevant as long as
// adhan and iqamah share the same one.
const at = (hh, mm) => {
  const d = new Date(2026, 4, 18, 0, 0, 0, 0); // 2026-05-18, fixed
  d.setHours(hh, mm, 0, 0);
  return d;
};

// Convenience — read HH:MM back out for asserting.
const hm = (d) => (d ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : null);

describe('computeIqamah — manual mode', () => {
  it('adds offsetMinutes to adhan time', () => {
    const result = computeIqamah(at(5, 0), { autoCalc: false, offsetMinutes: 20 });
    expect(hm(result)).toBe('5:20');
  });

  it('handles a zero offset (iqamah = adhan)', () => {
    const result = computeIqamah(at(5, 0), { autoCalc: false, offsetMinutes: 0 });
    expect(hm(result)).toBe('5:00');
  });

  it('wraps minutes across the hour boundary', () => {
    const result = computeIqamah(at(5, 50), { autoCalc: false, offsetMinutes: 25 });
    expect(hm(result)).toBe('6:15');
  });

  it('handles negative offsets (defensively, though uncommon)', () => {
    // Negative offsets aren't typical for iqamah, but the function shouldn't
    // crash if one slips through — it just subtracts.
    const result = computeIqamah(at(5, 30), { autoCalc: false, offsetMinutes: -10 });
    expect(hm(result)).toBe('5:20');
  });

  it('defaults offsetMinutes to 0 when omitted', () => {
    const result = computeIqamah(at(5, 0), { autoCalc: false });
    expect(hm(result)).toBe('5:00');
  });
});

describe('computeIqamah — auto mode (round to nearest quarter-hour)', () => {
  it('rounds DOWN when target is closer to previous quarter', () => {
    // 5:00 adhan + 15m buffer = 5:15 target. Exactly on a quarter → 5:15.
    const result = computeIqamah(at(5, 0), { autoCalc: true, bufferMinutes: 15 });
    expect(hm(result)).toBe('5:15');
  });

  it('rounds DOWN when target is 3 min past a quarter (closer to past)', () => {
    // 10:15 adhan + 18m buffer = 10:33 target. Nearest quarter = 10:30
    // (3 min back vs 12 min forward).
    const result = computeIqamah(at(10, 15), { autoCalc: true, bufferMinutes: 18 });
    expect(hm(result)).toBe('10:30');
  });

  it('rounds UP when target is closer to next quarter', () => {
    // 13:08 adhan + 4m buffer = 13:12 target. Nearest quarter = 13:15.
    const result = computeIqamah(at(13, 8), { autoCalc: true, bufferMinutes: 4 });
    expect(hm(result)).toBe('13:15');
  });

  it('rounds correctly when target lands exactly between quarters', () => {
    // 13:00 adhan + 7m = 13:07 → equidistant from 13:00 and 13:15 would
    // be 13:07.5. JS Math.round on .5 rounds toward +Inf (banker's rule
    // does not apply here), so 13:07 → 7/15 = 0.46 → rounds to 0 → 13:00.
    // But 13:07 is 7 min from :00 and 8 min from :15 → :00 is closer → 13:00.
    const result = computeIqamah(at(13, 0), { autoCalc: true, bufferMinutes: 7 });
    expect(hm(result)).toBe('13:00');
  });

  it('wraps to next hour when rounding crosses :45 → :00', () => {
    // 11:45 adhan + 12m buffer = 11:57 target → nearest quarter = 12:00.
    const result = computeIqamah(at(11, 45), { autoCalc: true, bufferMinutes: 12 });
    expect(hm(result)).toBe('12:00');
  });
});

describe('computeIqamah — auto mode with buf=0 (Maghrib convention)', () => {
  it('returns adhan-exact when bufferMinutes is 0', () => {
    // Common for Maghrib — iqamah immediately at sunset, no rounding.
    const result = computeIqamah(at(8, 37), { autoCalc: true, bufferMinutes: 0 });
    expect(hm(result)).toBe('8:37');
  });

  it('returns adhan-exact even at odd-minute times', () => {
    const result = computeIqamah(at(20, 53), { autoCalc: true, bufferMinutes: 0 });
    expect(hm(result)).toBe('20:53');
  });

  it('coerces buf=null to 0 (no NaN, no rounding)', () => {
    const result = computeIqamah(at(8, 37), { autoCalc: true, bufferMinutes: null });
    expect(hm(result)).toBe('8:37');
  });
});

describe('computeIqamah — safety floor (iqamah never before adhan)', () => {
  it('bumps forward when nearest-rounding would land BEFORE adhan', () => {
    // The motivating bug: 4:17 adhan + 1m buffer = 4:18 target → nearest
    // quarter = 4:15, which is BEFORE adhan. Safety floor must bump to
    // 4:30 (next quarter ≥ adhan).
    const result = computeIqamah(at(4, 17), { autoCalc: true, bufferMinutes: 1 });
    expect(hm(result)).toBe('4:30');
  });

  it('does NOT bump when nearest-rounding lands AFTER adhan', () => {
    // 4:17 adhan + 5m buffer = 4:22 → nearest = 4:15 (before) → bump 4:30
    const result1 = computeIqamah(at(4, 17), { autoCalc: true, bufferMinutes: 5 });
    expect(hm(result1)).toBe('4:30');

    // 4:17 adhan + 18m buffer = 4:35 → nearest = 4:30 (after, OK)
    const result2 = computeIqamah(at(4, 17), { autoCalc: true, bufferMinutes: 18 });
    expect(hm(result2)).toBe('4:30');
  });

  it('keeps iqamah ≥ adhan at the rounding boundary', () => {
    // 4:07 adhan + 1m = 4:08 → nearest = 4:15 (after, OK). Should NOT bump.
    const result = computeIqamah(at(4, 7), { autoCalc: true, bufferMinutes: 1 });
    expect(hm(result)).toBe('4:15');
  });
});

describe('computeIqamah — edge / negative cases', () => {
  it('returns null when adhan is null', () => {
    expect(computeIqamah(null, { autoCalc: false, offsetMinutes: 20 })).toBeNull();
  });

  it('returns null when adhan is undefined', () => {
    expect(computeIqamah(undefined, { autoCalc: true, bufferMinutes: 15 })).toBeNull();
  });

  it('defaults to manual mode (autoCalc=false) when opts omitted', () => {
    // No opts means autoCalc=false, offsetMinutes=0 → iqamah = adhan exactly.
    const result = computeIqamah(at(5, 0));
    expect(hm(result)).toBe('5:00');
  });

  it('does not mutate the input adhan Date', () => {
    const adhan = at(5, 0);
    const before = adhan.getTime();
    computeIqamah(adhan, { autoCalc: true, bufferMinutes: 15 });
    expect(adhan.getTime()).toBe(before);
  });
});

describe('computeIqamah — known mosque scenarios', () => {
  it('typical Fajr: 5:00 + 30m buf rounds to 5:30', () => {
    const result = computeIqamah(at(5, 0), { autoCalc: true, bufferMinutes: 30 });
    expect(hm(result)).toBe('5:30');
  });

  it('typical Dhuhr: 1:18 + 15m buf rounds to 1:30', () => {
    const result = computeIqamah(at(13, 18), { autoCalc: true, bufferMinutes: 15 });
    expect(hm(result)).toBe('13:30');
  });

  it('typical Maghrib: 8:37 + 0 buf stays at 8:37', () => {
    const result = computeIqamah(at(20, 37), { autoCalc: true, bufferMinutes: 0 });
    expect(hm(result)).toBe('20:37');
  });

  it('manual fallback: same prayer with 5m manual offset gives 8:42', () => {
    const result = computeIqamah(at(20, 37), { autoCalc: false, offsetMinutes: 5 });
    expect(hm(result)).toBe('20:42');
  });
});

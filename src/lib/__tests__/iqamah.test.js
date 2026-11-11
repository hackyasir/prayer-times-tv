// ── iqamah.test.js ───────────────────────────────────────────────────────
//
// Tests for the shared computeIqamah() helper. This function is the
// single source of truth for iqamah-time calculation across both the live
// dashboard and the printed monthly schedule, so its math has to be right.
//
// Focus areas:
//   - Manual mode: simple adhan + offset addition
//   - Auto mode: at least the buffer after adhan, rounded UP to a quarter-hour
//   - Auto mode, Maghrib or buf = 0: exact, no rounding
//   - Edge inputs: null adhan, missing options, hour wrap at :45 → :00

import { describe, it, expect } from 'vitest';
import { computeIqamah, iqamahFromSettings } from '../iqamah.js';

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

describe('computeIqamah — auto mode (minimum wait, rounded up to a quarter-hour)', () => {
  it('keeps a target that is already on a quarter-hour', () => {
    // 5:00 adhan + 15 = 5:15 → already a quarter → 5:15.
    expect(hm(computeIqamah(at(5, 0), { autoCalc: true, bufferMinutes: 15 }))).toBe('5:15');
  });

  it('rounds UP, never down — the buffer is a guaranteed minimum', () => {
    // 10:15 + 18 = 10:33 → next quarter 10:45 (the old "nearest" rule gave
    // 10:30, only 15 minutes after the adhan).
    expect(hm(computeIqamah(at(10, 15), { autoCalc: true, bufferMinutes: 18 }))).toBe('10:45');
    // 13:08 + 4 = 13:12 → 13:15.
    expect(hm(computeIqamah(at(13, 8), { autoCalc: true, bufferMinutes: 4 }))).toBe('13:15');
  });

  it('never gives a wait shorter than the buffer, nor 15+ minutes longer', () => {
    for (let m = 0; m < 60; m++) {
      for (const buf of [1, 5, 10, 20, 30]) {
        const adhan = at(12, m);
        const wait = (computeIqamah(adhan, { autoCalc: true, bufferMinutes: buf }) - adhan) / 60000;
        expect(wait).toBeGreaterThanOrEqual(buf);
        expect(wait).toBeLessThan(buf + 15);
      }
    }
  });

  it('wraps to the next hour', () => {
    // 11:45 + 12 = 11:57 → 12:00.
    expect(hm(computeIqamah(at(11, 45), { autoCalc: true, bufferMinutes: 12 }))).toBe('12:00');
  });

  it('keeps the same iqamah for days while the adhan drifts a minute a day', () => {
    // Dhuhr drifting 12:01 → 12:05 with a 10-minute minimum → 12:15 every day.
    const times = [1, 2, 3, 4, 5].map((m) =>
      hm(computeIqamah(at(12, m), { autoCalc: true, bufferMinutes: 10 }))
    );
    expect(new Set(times)).toEqual(new Set(['12:15']));
  });
});

describe('computeIqamah — auto mode, no rounding (Maghrib, or 0 minutes)', () => {
  it('Maghrib is exactly adhan + its minutes', () => {
    expect(
      hm(computeIqamah(at(16, 57), { autoCalc: true, bufferMinutes: 5, prayerKey: 'maghrib' }))
    ).toBe('17:02');
    expect(
      hm(computeIqamah(at(20, 53), { autoCalc: true, bufferMinutes: 10, prayerKey: 'maghrib' }))
    ).toBe('21:03');
  });

  it('other prayers with the same minutes are still rounded', () => {
    expect(
      hm(computeIqamah(at(16, 57), { autoCalc: true, bufferMinutes: 5, prayerKey: 'asr' }))
    ).toBe('17:15');
  });

  it('returns adhan-exact when bufferMinutes is 0', () => {
    expect(hm(computeIqamah(at(8, 37), { autoCalc: true, bufferMinutes: 0 }))).toBe('8:37');
    expect(hm(computeIqamah(at(20, 53), { autoCalc: true, bufferMinutes: 0 }))).toBe('20:53');
  });

  it('coerces buf=null or a negative buffer to 0 (no NaN, no rounding)', () => {
    expect(hm(computeIqamah(at(8, 37), { autoCalc: true, bufferMinutes: null }))).toBe('8:37');
    expect(hm(computeIqamah(at(8, 37), { autoCalc: true, bufferMinutes: -5 }))).toBe('8:37');
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
    expect(hm(computeIqamah(at(5, 0)))).toBe('5:00');
  });

  it('does not mutate the input adhan Date', () => {
    const adhan = at(5, 0);
    const before = adhan.getTime();
    computeIqamah(adhan, { autoCalc: true, bufferMinutes: 15 });
    expect(adhan.getTime()).toBe(before);
  });
});

describe('computeIqamah — default minimum waits', () => {
  // Defaults: Fajr 20, Dhuhr 10, Asr 10, Maghrib 5, Isha 10.
  it('typical Fajr: 5:44 + at least 20 → 6:15', () => {
    expect(hm(computeIqamah(at(5, 44), { autoCalc: true, bufferMinutes: 20 }))).toBe('6:15');
  });

  it('typical Dhuhr: 12:04 + at least 10 → 12:15', () => {
    expect(hm(computeIqamah(at(12, 4), { autoCalc: true, bufferMinutes: 10 }))).toBe('12:15');
  });

  it('typical Isha: 18:38 + at least 10 → 19:00 (old defaults gave 18:45, 7 minutes)', () => {
    expect(hm(computeIqamah(at(18, 38), { autoCalc: true, bufferMinutes: 10 }))).toBe('19:00');
  });

  it('typical Maghrib: 16:59 + 5 → 17:04', () => {
    expect(
      hm(computeIqamah(at(16, 59), { autoCalc: true, bufferMinutes: 5, prayerKey: 'maghrib' }))
    ).toBe('17:04');
  });

  it('manual fallback: 5-minute manual offset gives 8:42', () => {
    expect(hm(computeIqamah(at(20, 37), { autoCalc: false, offsetMinutes: 5 }))).toBe('20:42');
  });
});

describe('computeIqamah — rounding step', () => {
  it('rounds up to 5 minutes', () => {
    expect(hm(computeIqamah(at(12, 4), { autoCalc: true, bufferMinutes: 10, roundTo: 5 }))).toBe(
      '12:15'
    );
    expect(hm(computeIqamah(at(12, 6), { autoCalc: true, bufferMinutes: 10, roundTo: 5 }))).toBe(
      '12:20'
    );
  });

  it('exact minutes (Gulf / Maldives style) — adhan + wait, no rounding', () => {
    expect(hm(computeIqamah(at(12, 4), { autoCalc: true, bufferMinutes: 20, roundTo: 1 }))).toBe(
      '12:24'
    );
  });

  it('falls back to a quarter-hour for an unknown step', () => {
    expect(hm(computeIqamah(at(12, 4), { autoCalc: true, bufferMinutes: 10, roundTo: 7 }))).toBe(
      '12:15'
    );
  });
});

describe('computeIqamah — Fajr and sunrise', () => {
  const fajr = (adhan, sunrise, extra) =>
    hm(
      computeIqamah(adhan, {
        autoCalc: true,
        prayerKey: 'fajr',
        sunrise,
        bufferMinutes: 20,
        ...extra,
      })
    );

  it('holds Fajr until N minutes before sunrise (rounded down)', () => {
    // Adhan 5:44, sunrise 7:05, 35 min before sunrise → 6:30 (rounded down
    // from 6:30). The minimum wait alone would give 6:15.
    expect(fajr(at(5, 44), at(7, 5), { fajrBeforeSunrise: 35 })).toBe('6:30');
    // Sunrise 7:12 → 6:37 → rounded DOWN to 6:30, keeping at least 35 min.
    expect(fajr(at(5, 44), at(7, 12), { fajrBeforeSunrise: 35 })).toBe('6:30');
  });

  it('never goes earlier than the minimum wait', () => {
    // Short twilight: adhan 6:00, sunrise 6:50, 35 before → 6:15, but the
    // 20-minute minimum (rounded up) is 6:30... capped below by safety.
    expect(fajr(at(6, 0), at(6, 50), { fajrBeforeSunrise: 35 })).toBe('6:30');
  });

  it('is never later than 15 minutes before sunrise', () => {
    // Adhan 6:00, sunrise 6:40, minimum 20 → 6:30 would leave 10 minutes;
    // pulled back to 6:25 rounded down to the quarter → 6:15.
    expect(fajr(at(6, 0), at(6, 40), {})).toBe('6:15');
    // …but never before the adhan itself.
    expect(fajr(at(6, 0), at(6, 10), {})).toBe('6:00');
  });

  it('ignores the sunrise rule for other prayers', () => {
    expect(
      hm(
        computeIqamah(at(12, 4), {
          autoCalc: true,
          prayerKey: 'dhuhr',
          bufferMinutes: 10,
          sunrise: at(7, 5),
          fajrBeforeSunrise: 35,
        })
      )
    ).toBe('12:15');
  });
});

describe('iqamahFromSettings', () => {
  const times = { fajr: at(5, 44), sunrise: at(7, 5), dhuhr: at(12, 4), maghrib: at(16, 59) };

  it('uses the automatic formula with all its settings', () => {
    const settings = {
      iqamahAutoCalc: true,
      iqamahAutoBuffers: { fajr: 20, dhuhr: 15, maghrib: 5 },
      iqamahRoundTo: 15,
      iqamahFajrBeforeSunrise: 35,
    };
    expect(hm(iqamahFromSettings(times, 'fajr', settings))).toBe('6:30');
    expect(hm(iqamahFromSettings(times, 'dhuhr', settings))).toBe('12:30');
    expect(hm(iqamahFromSettings(times, 'maghrib', settings))).toBe('17:04');
  });

  it('uses manual offsets when automatic is off', () => {
    const settings = { iqamahAutoCalc: false, iqamah: { dhuhr: 26 } };
    expect(hm(iqamahFromSettings(times, 'dhuhr', settings))).toBe('12:30');
  });
});

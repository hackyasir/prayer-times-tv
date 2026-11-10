// ── congregations.test.js ────────────────────────────────────────────────
//
// buildCongregations() feeds the ticker, the chime and the blackout overlay.
// The Friday rule (Jumu'ah replaces Dhuhr) and the Eid rule (Eid slots only
// when passed in) are the regressions these tests guard.

import { describe, it, expect } from 'vitest';
import { buildCongregations } from '../congregations.js';

const at = (hh, mm) => new Date(Date.UTC(2026, 10, 13, hh, mm));

const todayTimes = {
  fajr: at(10, 0),
  sunrise: at(11, 30),
  dhuhr: at(17, 0),
  asr: at(19, 30),
  maghrib: at(21, 45),
  isha: at(23, 0),
};
const iqamah = { fajr: 20, dhuhr: 15, asr: 10, maghrib: 5, isha: 10 };

describe('buildCongregations', () => {
  it('returns the five daily iqamahs, sorted, with no sunrise', () => {
    const list = buildCongregations({ todayTimes, iqamah });
    expect(list.map((c) => c.key)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
    expect(list[0].time).toEqual(at(10, 20));
    expect(list[1].time).toEqual(at(17, 15));
  });

  it("replaces Dhuhr with the Jumu'ah slots on a Friday", () => {
    const list = buildCongregations({
      todayTimes,
      iqamah,
      isFriday: true,
      jumuahTimes: [at(18, 0), at(18, 45)],
    });
    const keys = list.map((c) => c.key);
    expect(keys).not.toContain('dhuhr');
    expect(keys.filter((k) => k === 'jumuah')).toHaveLength(2);
    expect(list.map((c) => c.id)).toEqual([
      'fajr',
      'jumuah_0',
      'jumuah_1',
      'asr',
      'maghrib',
      'isha',
    ]);
  });

  it("keeps Dhuhr on a Friday when every Jumu'ah slot is disabled", () => {
    const list = buildCongregations({ todayTimes, iqamah, isFriday: true, jumuahTimes: [] });
    expect(list.map((c) => c.key)).toContain('dhuhr');
  });

  it("ignores Jumu'ah times on other days", () => {
    const list = buildCongregations({
      todayTimes,
      iqamah,
      isFriday: false,
      jumuahTimes: [at(18, 0)],
    });
    expect(list.map((c) => c.key)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
  });

  it('adds Eid slots when they are passed in', () => {
    const list = buildCongregations({ todayTimes, iqamah, eidTimes: [at(13, 0), at(14, 0)] });
    const eid = list.filter((c) => c.key === 'eid');
    expect(eid.map((c) => c.id)).toEqual(['eid_0', 'eid_1']);
    // Sorted between Fajr and Dhuhr
    expect(list.map((c) => c.key)).toEqual([
      'fajr',
      'eid',
      'eid',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ]);
  });

  it('drops invalid slot times (e.g. a cleared time field)', () => {
    const list = buildCongregations({
      todayTimes,
      iqamah,
      isFriday: true,
      jumuahTimes: [new Date(NaN)],
      eidTimes: [new Date(NaN)],
    });
    // No valid Jumu'ah time → Dhuhr stays
    expect(list.map((c) => c.key)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
  });

  it('treats a missing iqamah offset as zero and skips missing adhan times', () => {
    const list = buildCongregations({
      todayTimes: { ...todayTimes, asr: null },
      iqamah: { fajr: 20 },
    });
    expect(list.map((c) => c.key)).toEqual(['fajr', 'dhuhr', 'maghrib', 'isha']);
    expect(list[1].time).toEqual(todayTimes.dhuhr);
  });
});

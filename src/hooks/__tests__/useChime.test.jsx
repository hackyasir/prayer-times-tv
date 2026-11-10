/* @vitest-environment jsdom */
// ── useChime.test.jsx ────────────────────────────────────────────────────
//
// Which events beep under which settings. Regressions guarded here:
//   - Jumu'ah/Eid slots must beep with the DEFAULT settings (iqamah beep on,
//     adhan beep off) — they used to be adhan-only and stayed silent.
//   - On Fridays with Jumu'ah slots there is no Dhuhr iqamah beep.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../lib/audio.js', () => ({ playBeep: vi.fn() }));

import { playBeep } from '../../lib/audio.js';
import useChime from '../useChime.js';
import { buildCongregations } from '../../lib/congregations.js';

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

function beepsAt(now, { chimeAdhan = false, chimeIqamah = true, ...congregationOpts } = {}) {
  playBeep.mockClear();
  const congregations = buildCongregations({ todayTimes, iqamah, ...congregationOpts });
  renderHook(() => useChime({ chimeAdhan, chimeIqamah, now, todayTimes, congregations }));
  return playBeep.mock.calls.length;
}

describe('useChime', () => {
  beforeEach(() => playBeep.mockClear());

  it('beeps at a daily iqamah with the default settings', () => {
    expect(beepsAt(at(17, 15))).toBe(1);
  });

  it('does not beep at adhan unless the adhan beep is on', () => {
    expect(beepsAt(at(17, 0))).toBe(0);
    expect(beepsAt(at(17, 0), { chimeAdhan: true })).toBe(1);
  });

  it("beeps at each Jumu'ah slot with the default settings", () => {
    const friday = { isFriday: true, jumuahTimes: [at(18, 0)] };
    expect(beepsAt(at(18, 0), friday)).toBe(1);
  });

  it("beeps at Jumu'ah slots when only the adhan beep is on", () => {
    const friday = { isFriday: true, jumuahTimes: [at(18, 0)] };
    expect(beepsAt(at(18, 0), { ...friday, chimeAdhan: true, chimeIqamah: false })).toBe(1);
  });

  it("skips the Dhuhr iqamah beep on a Friday with Jumu'ah slots", () => {
    const friday = { isFriday: true, jumuahTimes: [at(18, 0)] };
    expect(beepsAt(at(17, 15), friday)).toBe(0);
  });

  it('beeps at Eid slots on the Eid day', () => {
    expect(beepsAt(at(13, 0), { eidTimes: [at(13, 0)] })).toBe(1);
  });

  it('stays silent when both beeps are off', () => {
    const friday = { isFriday: true, jumuahTimes: [at(18, 0)] };
    expect(beepsAt(at(18, 0), { ...friday, chimeAdhan: false, chimeIqamah: false })).toBe(0);
  });
});

/* @vitest-environment jsdom */
// ── useBlackoutMode.test.jsx ─────────────────────────────────────────────
//
// Blackout windows come from today's congregations. The Friday case is the
// regression: blackout must follow the Jumu'ah slots, not Dhuhr's iqamah.

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import useBlackoutMode from '../useBlackoutMode.js';
import { buildCongregations } from '../../lib/congregations.js';

const at = (hh, mm, ss = 0) => new Date(Date.UTC(2026, 10, 13, hh, mm, ss));

const todayTimes = {
  fajr: at(10, 0),
  sunrise: at(11, 30),
  dhuhr: at(17, 0),
  asr: at(19, 30),
  maghrib: at(21, 45),
  isha: at(23, 0),
};
const yesterdayTimes = { ...todayTimes, isha: new Date(at(23, 0).getTime() - 86_400_000) };
const iqamah = { fajr: 20, dhuhr: 15, asr: 10, maghrib: 5, isha: 10 };
const durations = { fajr: 10, dhuhr: 10, asr: 10, maghrib: 7, isha: 12, jumuah: 40, eid: 30 };

function run(now, { isFriday = false, jumuahTimes = [], eidTimes = [], enabled = true } = {}) {
  const congregations = buildCongregations({ todayTimes, iqamah, isFriday, jumuahTimes, eidTimes });
  const { result } = renderHook(() =>
    useBlackoutMode({
      enabled,
      leadSeconds: 30,
      durations,
      congregations,
      yesterdayTimes,
      iqamah,
      now,
      dismissedAt: null,
      forceUntil: null,
    })
  );
  return result.current;
}

describe('useBlackoutMode', () => {
  it('is active from lead-in before a daily iqamah until its duration ends', () => {
    expect(run(at(17, 14, 29)).active).toBe(false);
    expect(run(at(17, 14, 31))).toMatchObject({ active: true, prayerKey: 'dhuhr' });
    expect(run(at(17, 24, 59)).active).toBe(true);
    expect(run(at(17, 25, 0)).active).toBe(false);
  });

  it("on Friday, follows the Jumu'ah slot and not Dhuhr's iqamah", () => {
    const friday = { isFriday: true, jumuahTimes: [at(18, 0)] };
    // Dhuhr iqamah time (17:15) — no blackout on a Friday
    expect(run(at(17, 16), friday).active).toBe(false);
    // Jumu'ah slot at 18:00 with a 40-minute duration
    const during = run(at(18, 20), friday);
    expect(during).toMatchObject({ active: true, prayerKey: 'jumuah' });
    expect(during.endsAt).toEqual(at(18, 40));
    expect(run(at(18, 40), friday).active).toBe(false);
  });

  it('covers Eid prayer slots when they are in the list', () => {
    const state = run(at(13, 10), { eidTimes: [at(13, 0)] });
    expect(state).toMatchObject({ active: true, prayerKey: 'eid' });
    expect(state.endsAt).toEqual(at(13, 30));
  });

  it("still covers yesterday's Isha window after midnight", () => {
    // Yesterday's Isha iqamah = 23:10 the previous day; window ends 23:22.
    const now = new Date(at(23, 15).getTime() - 86_400_000);
    expect(run(now)).toMatchObject({ active: true, prayerKey: 'isha' });
  });

  it('never activates when disabled', () => {
    expect(run(at(17, 20), { enabled: false }).active).toBe(false);
  });
});

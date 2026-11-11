// ── dailyReload.test.js ──────────────────────────────────────────────────
// The nightly reload happens only at a quiet moment.

import { describe, it, expect } from 'vitest';
import { shouldReload, RELOAD_AFTER_MS, RELOAD_OVERDUE_MS } from '../dailyReload.js';

const H = 3_600_000;
const now = Date.UTC(2026, 10, 12, 8, 0); // 3 a.m. in Toronto
const at = (minutesFromNow) => new Date(now + minutesFromNow * 60_000);
const base = {
  uptimeMs: 21 * H,
  cityHour: 3,
  nowMs: now,
  events: [at(-300), at(150)], // Isha 5 h ago, Fajr in 2.5 h
  busy: false,
  canReload: true,
};

describe('shouldReload', () => {
  it('reloads after 20 hours, in the early morning, when nothing is near', () => {
    expect(shouldReload(base)).toBe(true);
  });

  it('waits until the screen has been up for 20 hours', () => {
    expect(shouldReload({ ...base, uptimeMs: RELOAD_AFTER_MS - 1 })).toBe(false);
  });

  it('waits for 1–5 a.m., unless it is overdue', () => {
    expect(shouldReload({ ...base, cityHour: 14 })).toBe(false);
    expect(shouldReload({ ...base, cityHour: 14, uptimeMs: RELOAD_OVERDUE_MS })).toBe(true);
  });

  it('never reloads close to a prayer', () => {
    expect(shouldReload({ ...base, events: [at(40)] })).toBe(false); // adhan in 40 min
    expect(shouldReload({ ...base, events: [at(-10)] })).toBe(false); // iqamah 10 min ago
    expect(shouldReload({ ...base, events: [at(46), at(-16)] })).toBe(true);
    expect(shouldReload({ ...base, uptimeMs: 30 * H, events: [at(20)] })).toBe(false);
  });

  it('never reloads while the screen is in use or can’t come back offline', () => {
    expect(shouldReload({ ...base, busy: true })).toBe(false);
    expect(shouldReload({ ...base, canReload: false })).toBe(false);
  });

  it('ignores missing times', () => {
    expect(shouldReload({ ...base, events: [null, undefined, new Date(NaN)] })).toBe(true);
  });
});

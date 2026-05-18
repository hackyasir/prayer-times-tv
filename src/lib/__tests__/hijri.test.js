// ── hijri.js tests ───────────────────────────────────────────────────────
//
// Covers the three exports of lib/hijri.js:
//   - toHijri(date) → formatted string
//   - toHijriParts(date) → {d, m, y}
//   - findUpcomingEid(now, hijriOffset, maxDays) → {kind, eidDate, daysUntil}
//
// Anchor dates were verified by running the tabular algorithm standalone
// (matches Umm al-Qura ±1 day in normal cases). These dates are stable
// for the tabular Islamic calendar — they won't drift over time.
//
// REGRESSION COVERAGE: the `findUpcomingEid` "+2 offset" scenario in this
// file is the literal bug reproduction from the May 2026 conversation —
// "today is 1 Dhu al-Hijjah 1447, +2 offset, 9 days lookahead should find
// Eid Adha". The earlier subtract-offset-from-probe version returned null.

import { describe, it, expect } from 'vitest';
import { toHijri, toHijriParts, findUpcomingEid } from '../hijri.js';

// Helper — constructs a Date at LOCAL noon so date-rounding never trips
// over midnight UTC weirdness. The hijri functions read .getFullYear()
// etc., so the date's local components are what matter.
const localNoon = (yyyy_mm_dd) => new Date(yyyy_mm_dd + 'T12:00:00');

describe('toHijriParts', () => {
  describe('positive — known Gregorian → Hijri anchors', () => {
    it('converts 2026-03-20 to 1 Shawwal 1447 (Eid ul-Fitr 2026)', () => {
      const parts = toHijriParts(localNoon('2026-03-20'));
      expect(parts).toEqual({ d: 1, m: 10, y: 1447 });
    });

    it('converts 2026-05-18 to 1 Dhu al-Hijjah 1447', () => {
      const parts = toHijriParts(localNoon('2026-05-18'));
      expect(parts).toEqual({ d: 1, m: 12, y: 1447 });
    });

    it('converts 2026-05-27 to 10 Dhu al-Hijjah 1447 (Eid ul-Adha 2026)', () => {
      const parts = toHijriParts(localNoon('2026-05-27'));
      expect(parts).toEqual({ d: 10, m: 12, y: 1447 });
    });

    it('converts 2026-01-01 (Gregorian new year) to 12 Rajab 1447', () => {
      const parts = toHijriParts(localNoon('2026-01-01'));
      expect(parts).toEqual({ d: 12, m: 7, y: 1447 });
    });

    it('converts 2024-06-16 to 9 Dhu al-Hijjah 1445 (Day of Arafah 2024)', () => {
      const parts = toHijriParts(localNoon('2024-06-16'));
      expect(parts).toEqual({ d: 9, m: 12, y: 1445 });
    });
  });

  describe('boundary — month transitions', () => {
    it('returns valid day (1-30) for any input', () => {
      // Sample 50 dates across a year; every day should fall in 1..30.
      const start = new Date('2026-01-01T12:00:00');
      for (let i = 0; i < 50; i++) {
        const d = new Date(start.getTime() + i * 7 * 86400 * 1000);
        const parts = toHijriParts(d);
        expect(parts.d).toBeGreaterThanOrEqual(1);
        expect(parts.d).toBeLessThanOrEqual(30);
      }
    });

    it('returns valid month (1-12) for any input', () => {
      // Same idea — every result should be a valid Hijri month index.
      const start = new Date('2026-01-01T12:00:00');
      for (let i = 0; i < 50; i++) {
        const d = new Date(start.getTime() + i * 7 * 86400 * 1000);
        const parts = toHijriParts(d);
        expect(parts.m).toBeGreaterThanOrEqual(1);
        expect(parts.m).toBeLessThanOrEqual(12);
      }
    });

    it('day after 29 Shawwal advances to next month', () => {
      // 2026-04-17 was 29 Shawwal in our anchor set; +1 day should
      // either be 30 Shawwal or 1 Dhu al-Qi'dah (depends on month
      // length in tabular calendar).
      const today = toHijriParts(localNoon('2026-04-17'));
      const tomorrow = toHijriParts(localNoon('2026-04-18'));
      expect(today).toEqual({ d: 29, m: 10, y: 1447 });
      // Tabular: 30 days for Shawwal in this year, so +1 = 30 Shawwal.
      expect(tomorrow.m === 10 || tomorrow.m === 11).toBe(true);
    });
  });
});

describe('toHijri (formatted string)', () => {
  it('produces the canonical "D Month Y AH" format', () => {
    const s = toHijri(localNoon('2026-05-18'));
    expect(s).toBe('1 Dhu al-Hijjah 1447 AH');
  });

  it('matches the parts version for the same date', () => {
    const date = localNoon('2026-05-27');
    const s = toHijri(date);
    const p = toHijriParts(date);
    expect(s).toContain(String(p.d));
    expect(s).toContain(String(p.y));
    expect(s).toContain('AH');
  });
});

describe('findUpcomingEid', () => {
  // ── Positive cases ─────────────────────────────────────────────────
  describe('detection within window', () => {
    it('detects Eid ul-Adha when today is 10 Dhu al-Hijjah (today, no offset)', () => {
      const result = findUpcomingEid(localNoon('2026-05-27'), 0, 7);
      expect(result.kind).toBe('adha');
      expect(result.daysUntil).toBe(0);
    });

    it('detects Eid ul-Adha 9 days ahead from 1 Dhu al-Hijjah', () => {
      const result = findUpcomingEid(localNoon('2026-05-18'), 0, 30);
      expect(result.kind).toBe('adha');
      expect(result.daysUntil).toBe(9);
    });

    it('detects Eid ul-Fitr when today is 1 Shawwal (today, no offset)', () => {
      const result = findUpcomingEid(localNoon('2026-03-20'), 0, 7);
      expect(result.kind).toBe('fitr');
      expect(result.daysUntil).toBe(0);
    });
  });

  // ── REGRESSION: the May 2026 Hijri-offset bug ─────────────────────
  // This is the literal scenario from the bug report:
  //   "today is 1 Dhu al-Hijjah 1447 AH, +2 hijri offset, 9 days lookahead.
  //    Should the Eid card be visible?"
  //
  // User's mental model: with +2 offset they consider today to be
  // "3 Dhu al-Hijjah", so Eid Adha (10th) is 7 days away → must fire.
  //
  // Old buggy code subtracted offset from the probe date, which gave
  // the wrong direction and returned `kind: null`. Fixed by adding
  // offset to the tabular Hijri day before comparing.
  describe('hijri offset direction (regression for May 2026 bug)', () => {
    it('with +2 offset, finds Eid Adha 7 days out from 1 Dhu al-Hijjah', () => {
      // Tabular today = 1 Dhu al-Hijjah. With +2 offset, user's calendar
      // reads day 3 → Eid Adha (day 10) is 7 days away.
      const result = findUpcomingEid(localNoon('2026-05-18'), 2, 9);
      expect(result.kind).toBe('adha');
      expect(result.daysUntil).toBe(7);
    });

    it('with +2 offset and a small window, still finds Eid if in range', () => {
      // 7 days out, window of 9 → in range, fires.
      const result = findUpcomingEid(localNoon('2026-05-18'), 2, 9);
      expect(result.kind).not.toBeNull();
    });

    it('with +2 offset and a window too narrow, returns null', () => {
      // 7 days out, window of 5 → out of range.
      const result = findUpcomingEid(localNoon('2026-05-18'), 2, 5);
      expect(result.kind).toBeNull();
    });

    it('with -1 offset, shifts detection 1 day later', () => {
      // Tabular today = 1 Dhu al-Hijjah. With -1 offset, user's calendar
      // reads ONE day BEHIND tabular. So when user's calendar reads day 10
      // (Eid Adha), the tabular reading is day 11 — which falls on
      // Gregorian today + 10 days.
      const result = findUpcomingEid(localNoon('2026-05-18'), -1, 15);
      expect(result.kind).toBe('adha');
      expect(result.daysUntil).toBe(10);
    });
  });

  // ── Negative / null cases ────────────────────────────────────────
  describe('no upcoming Eid', () => {
    it('returns null kind when no Eid falls in lookahead window', () => {
      // 2026-01-01 = 12 Rajab. Next Eid (Fitr, 1 Shawwal) is ~78
      // days away. A 7-day window should miss it.
      const result = findUpcomingEid(localNoon('2026-01-01'), 0, 7);
      expect(result.kind).toBeNull();
      expect(result.eidDate).toBeNull();
      expect(result.daysUntil).toBeNull();
    });

    it('returns null when window is zero days and today is not Eid', () => {
      const result = findUpcomingEid(localNoon('2026-05-18'), 0, 0);
      expect(result.kind).toBeNull();
    });
  });

  // ── Result-shape contract ─────────────────────────────────────────
  describe('return shape', () => {
    it('always returns object with kind, eidDate, daysUntil keys', () => {
      const r = findUpcomingEid(localNoon('2026-01-01'), 0, 7);
      expect(r).toHaveProperty('kind');
      expect(r).toHaveProperty('eidDate');
      expect(r).toHaveProperty('daysUntil');
    });

    it('eidDate is a Date instance when an Eid is found', () => {
      const r = findUpcomingEid(localNoon('2026-05-27'), 0, 7);
      expect(r.eidDate).toBeInstanceOf(Date);
    });

    it('eidDate is normalized to midnight (hours=0)', () => {
      // Function calls setHours(0,0,0,0); verify.
      const r = findUpcomingEid(localNoon('2026-05-27'), 0, 7);
      expect(r.eidDate.getHours()).toBe(0);
      expect(r.eidDate.getMinutes()).toBe(0);
    });
  });

  // ── Default-parameter contract ────────────────────────────────────
  describe('default parameters', () => {
    it('defaults hijriOffset to 0 when omitted', () => {
      const explicit = findUpcomingEid(localNoon('2026-05-27'), 0, 7);
      const implicit = findUpcomingEid(localNoon('2026-05-27'), undefined, 7);
      expect(implicit).toEqual(explicit);
    });

    it('defaults maxDays to 7 when omitted', () => {
      // 1 Dhu al-Hijjah + default 7-day window: Eid Adha is 9 days
      // out, so should NOT fire with the default window.
      const result = findUpcomingEid(localNoon('2026-05-18'));
      expect(result.kind).toBeNull();
    });
  });
});

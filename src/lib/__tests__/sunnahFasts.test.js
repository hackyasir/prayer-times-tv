// ── sunnahFasts.test.js ──────────────────────────────────────────────────
// Tests the shared recommended-fast rules used by BOTH the on-screen
// announcements and the printable calendar.

import { describe, it, expect } from 'vitest';
import {
  isForbiddenFastDay,
  fastReasonsFor,
  buildFastLine,
  FAST_RANK,
} from '../sunnahFasts.js';

const keys = (reasons) => reasons.map((r) => r.key);

describe('isForbiddenFastDay', () => {
  it('flags Eid al-Fitr (1 Shawwal)', () => {
    expect(isForbiddenFastDay({ m: 10, d: 1 })).toBe(true);
  });
  it('flags Eid al-Adha + Tashreeq (10–13 Dhul-Hijjah)', () => {
    expect(isForbiddenFastDay({ m: 12, d: 10 })).toBe(true);
    expect(isForbiddenFastDay({ m: 12, d: 11 })).toBe(true);
    expect(isForbiddenFastDay({ m: 12, d: 13 })).toBe(true);
  });
  it('does not flag ordinary days', () => {
    expect(isForbiddenFastDay({ m: 12, d: 9 })).toBe(false); // Arafah
    expect(isForbiddenFastDay({ m: 10, d: 2 })).toBe(false); // Shawwal day 2
    expect(isForbiddenFastDay({ m: 6, d: 14 })).toBe(false);
  });
  it('is safe on missing input', () => {
    expect(isForbiddenFastDay(null)).toBe(false);
  });
});

describe('fastReasonsFor — single reasons', () => {
  it('Arafah (9 Dhul-Hijjah) is urgent', () => {
    const r = fastReasonsFor({ m: 12, d: 9 }, 2);
    expect(keys(r)).toContain('arafah');
    expect(r[0].urgent).toBe(true);
  });
  it('Ashura (10 Muharram) is urgent', () => {
    const r = fastReasonsFor({ m: 1, d: 10 }, 2);
    expect(keys(r)).toEqual(['ashura']);
    expect(r[0].urgent).toBe(true);
  });
  it("Tasu'a (9 Muharram) is not urgent", () => {
    const r = fastReasonsFor({ m: 1, d: 9 }, 2);
    expect(keys(r)).toEqual(['tasua']);
    expect(r[0].urgent).toBe(false);
  });
  it('plain Monday / Thursday', () => {
    expect(keys(fastReasonsFor({ m: 6, d: 5 }, 1))).toEqual(['monday']);
    expect(keys(fastReasonsFor({ m: 6, d: 5 }, 4))).toEqual(['thursday']);
  });
  it('plain White Day', () => {
    expect(keys(fastReasonsFor({ m: 6, d: 14 }, 2))).toEqual(['white']);
  });
  it('Shawwal day carries the shawwal reason', () => {
    expect(keys(fastReasonsFor({ m: 10, d: 5 }, 2))).toEqual(['shawwal']);
  });
  it('returns [] when nothing applies', () => {
    expect(fastReasonsFor({ m: 6, d: 7 }, 2)).toEqual([]);
  });
});

describe('fastReasonsFor — overlaps (ranked, tashreek)', () => {
  it('Thursday + White Day → white leads, thursday follows', () => {
    expect(keys(fastReasonsFor({ m: 5, d: 14 }, 4))).toEqual(['white', 'thursday']);
  });
  it('Arafah on a Monday → arafah leads', () => {
    expect(keys(fastReasonsFor({ m: 12, d: 9 }, 1))).toEqual(['arafah', 'monday']);
  });
  it('Shawwal + White Day + Monday → ranked shawwal > white > monday', () => {
    expect(keys(fastReasonsFor({ m: 10, d: 14 }, 1))).toEqual(['shawwal', 'white', 'monday']);
  });
  it('reasons follow the FAST_RANK order', () => {
    const r = fastReasonsFor({ m: 10, d: 14 }, 4); // shawwal + white + thursday
    const idx = r.map((x) => FAST_RANK.indexOf(x.key));
    const sorted = [...idx].sort((a, b) => a - b);
    expect(idx).toEqual(sorted);
  });
});

describe('fastReasonsFor — forbidden gate beats every overlap', () => {
  it('13 Dhul-Hijjah (Tashreeq) that is also a White Day → no fast', () => {
    expect(fastReasonsFor({ m: 12, d: 13 }, 2)).toEqual([]);
  });
  it('Eid al-Fitr on a Monday → no fast', () => {
    expect(fastReasonsFor({ m: 10, d: 1 }, 1)).toEqual([]);
  });
  it('Eid al-Adha (10 Dhul-Hijjah) on a Thursday → no fast', () => {
    expect(fastReasonsFor({ m: 12, d: 10 }, 4)).toEqual([]);
  });
});

describe('buildFastLine — presentation', () => {
  const tag = (r) =>
    r.key === 'white' ? `White Day ${r.day}` :
    ({ arafah: 'Day of Arafah', ashura: 'Ashura', tasua: "Tasu'a",
       shawwal: 'Six of Shawwal', monday: 'Monday', thursday: 'Thursday' })[r.key];
  const phrases = {
    lead: (when, fast) => `Sunnah fast ${when} (${fast})`,
    also: (list) => `— also ${list}`,
    sep: ' & ',
  };

  it('returns null for no reasons', () => {
    expect(buildFastLine([], 'today', tag, phrases)).toBeNull();
  });
  it('single reason, no "also"', () => {
    const line = buildFastLine(fastReasonsFor({ m: 6, d: 5 }, 1), 'today', tag, phrases);
    expect(line).toBe('Sunnah fast today (Monday)');
  });
  it('overlap → lead + also', () => {
    const line = buildFastLine(fastReasonsFor({ m: 5, d: 14 }, 4), 'today', tag, phrases);
    expect(line).toBe('Sunnah fast today (White Day 14) — also Thursday');
  });
  it('urgent lead gets the ! prefix', () => {
    const line = buildFastLine(fastReasonsFor({ m: 12, d: 9 }, 1), 'tomorrow', tag, phrases);
    expect(line).toBe('! Sunnah fast tomorrow (Day of Arafah) — also Monday');
  });
});

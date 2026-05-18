// ── prayerCalc.js tests ──────────────────────────────────────────────────
//
// Covers calcTimes, calcQibla, tzOffsetHours. These are thin wrappers over
// the `adhan` library — most tests verify behavior contracts (shape, units,
// expected ordering) rather than asserting exact-minute prayer times,
// which would couple tests to library implementation details and astronomy
// constants that could change.
//
// Reference location: Mecca (Kaaba) — known coordinates.
// Reference location: Toronto — typical North America city, mid-latitude.
// Reference location: Reykjavik — extreme high-latitude for stress-testing
// the high-latitude rules.

import { describe, it, expect } from 'vitest';
import { calcTimes, calcQibla, tzOffsetHours } from '../prayerCalc.js';

// Anchor locations
const MAKKAH    = { lat: 21.4225, lng: 39.8262 };
const TORONTO   = { lat: 43.6532, lng: -79.3832 };
const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };

const SAMPLE_DATE = new Date('2026-05-18T12:00:00Z');

describe('calcTimes', () => {
  describe('shape contract', () => {
    it('returns all 6 prayer keys', () => {
      const times = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'ISNA', 1);
      expect(times).toHaveProperty('fajr');
      expect(times).toHaveProperty('sunrise');
      expect(times).toHaveProperty('dhuhr');
      expect(times).toHaveProperty('asr');
      expect(times).toHaveProperty('maghrib');
      expect(times).toHaveProperty('isha');
    });

    it('each prayer time is a Date instance', () => {
      const times = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'ISNA', 1);
      for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        expect(times[key]).toBeInstanceOf(Date);
      }
    });
  });

  describe('ordering invariant (the prayers happen in this order daily)', () => {
    it('Toronto: Fajr < Sunrise < Dhuhr < Asr < Maghrib < Isha', () => {
      const t = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'ISNA', 1);
      expect(t.fajr.getTime()).toBeLessThan(t.sunrise.getTime());
      expect(t.sunrise.getTime()).toBeLessThan(t.dhuhr.getTime());
      expect(t.dhuhr.getTime()).toBeLessThan(t.asr.getTime());
      expect(t.asr.getTime()).toBeLessThan(t.maghrib.getTime());
      expect(t.maghrib.getTime()).toBeLessThan(t.isha.getTime());
    });

    it('Makkah: prayers ordered same way', () => {
      const t = calcTimes(SAMPLE_DATE, MAKKAH.lat, MAKKAH.lng, 'Makkah', 1);
      expect(t.fajr.getTime()).toBeLessThan(t.sunrise.getTime());
      expect(t.maghrib.getTime()).toBeLessThan(t.isha.getTime());
    });
  });

  describe('method handling', () => {
    it('accepts all 12 registered method keys without error', () => {
      const methods = [
        'MWL', 'ISNA', 'Moonsighting', 'Egypt', 'Makkah',
        'Dubai', 'Qatar', 'Kuwait', 'Karachi', 'Singapore',
        'Turkey', 'Tehran',
      ];
      for (const m of methods) {
        const t = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, m, 1);
        expect(t.fajr).toBeInstanceOf(Date);
      }
    });

    it('falls back to MWL when method key is unknown', () => {
      const withMWL = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'MWL', 1);
      const withJunk = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'NotARealMethod', 1);
      expect(withJunk.fajr.getTime()).toBe(withMWL.fajr.getTime());
    });

    it('different methods produce different Fajr times', () => {
      // ISNA (15°) and Egypt (19.5°) should differ for Fajr.
      const isna  = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'ISNA',  1);
      const egypt = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'Egypt', 1);
      expect(isna.fajr.getTime()).not.toBe(egypt.fajr.getTime());
    });
  });

  describe('madhab (shadow) handling', () => {
    it('Hanafi (shadow=2) Asr is later than Shafi (shadow=1)', () => {
      // Hanafi uses 2× shadow length → Asr falls later in the day.
      const shafi  = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'ISNA', 1);
      const hanafi = calcTimes(SAMPLE_DATE, TORONTO.lat, TORONTO.lng, 'ISNA', 2);
      expect(hanafi.asr.getTime()).toBeGreaterThan(shafi.asr.getTime());
    });
  });

  describe('high-latitude handling', () => {
    it('Reykjavik in May still returns valid Fajr/Isha (high-lat rule applied)', () => {
      // Without high-latitude rules, Iceland in summer would return null.
      // adhan-js's middleOfNight default should always give a result.
      const t = calcTimes(SAMPLE_DATE, REYKJAVIK.lat, REYKJAVIK.lng, 'MWL', 1);
      expect(t.fajr).toBeInstanceOf(Date);
      expect(t.isha).toBeInstanceOf(Date);
    });

    it('accepts all 3 high-latitude rule strings', () => {
      const rules = ['middleOfNight', 'seventhOfNight', 'twilightAngle'];
      for (const r of rules) {
        const t = calcTimes(SAMPLE_DATE, REYKJAVIK.lat, REYKJAVIK.lng, 'MWL', 1, undefined, r);
        expect(t.fajr).toBeInstanceOf(Date);
      }
    });

    it('falls back to middleOfNight for unknown rule strings', () => {
      const def    = calcTimes(SAMPLE_DATE, REYKJAVIK.lat, REYKJAVIK.lng, 'MWL', 1, undefined, 'middleOfNight');
      const fallback = calcTimes(SAMPLE_DATE, REYKJAVIK.lat, REYKJAVIK.lng, 'MWL', 1, undefined, 'NotARule');
      expect(fallback.fajr.getTime()).toBe(def.fajr.getTime());
    });
  });

  describe('date input', () => {
    it('uses calendar date only, ignoring time of day in input', () => {
      const morning = new Date('2026-05-18T05:00:00Z');
      const evening = new Date('2026-05-18T22:00:00Z');
      const t1 = calcTimes(morning, TORONTO.lat, TORONTO.lng, 'ISNA', 1);
      const t2 = calcTimes(evening, TORONTO.lat, TORONTO.lng, 'ISNA', 1);
      // Same calendar day → same prayer times.
      expect(t1.fajr.getTime()).toBe(t2.fajr.getTime());
    });
  });
});

describe('calcQibla', () => {
  it('returns a number in [0, 360)', () => {
    const q = calcQibla(TORONTO.lat, TORONTO.lng);
    expect(typeof q).toBe('number');
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThan(360);
  });

  it('from Toronto, points roughly east-northeast (~58°)', () => {
    // Known: Toronto's qibla is around 58° from true north.
    const q = calcQibla(TORONTO.lat, TORONTO.lng);
    expect(q).toBeGreaterThan(40);
    expect(q).toBeLessThan(80);
  });

  it('from far east of Makkah (e.g. Karachi), points roughly west (~270°)', () => {
    const q = calcQibla(24.8607, 67.0011);  // Karachi
    expect(q).toBeGreaterThan(250);
    expect(q).toBeLessThan(290);
  });
});

describe('tzOffsetHours', () => {
  describe('positive', () => {
    it('returns +5 for Asia/Karachi (no DST)', () => {
      const offset = tzOffsetHours('Asia/Karachi', new Date('2026-05-18T12:00:00Z'));
      expect(offset).toBe(5);
    });

    it('returns 0 for UTC', () => {
      const offset = tzOffsetHours('UTC', new Date('2026-05-18T12:00:00Z'));
      expect(offset).toBe(0);
    });

    it('returns -4 for America/Toronto in May (EDT, DST active)', () => {
      const offset = tzOffsetHours('America/Toronto', new Date('2026-05-18T12:00:00Z'));
      expect(offset).toBe(-4);
    });

    it('returns -5 for America/Toronto in January (EST, no DST)', () => {
      const offset = tzOffsetHours('America/Toronto', new Date('2026-01-15T12:00:00Z'));
      expect(offset).toBe(-5);
    });
  });

  describe('negative / fallback', () => {
    it('falls back to device offset when timezone string is empty', () => {
      const date = new Date('2026-05-18T12:00:00Z');
      const expected = -date.getTimezoneOffset() / 60;
      expect(tzOffsetHours('', date)).toBe(expected);
    });

    it('falls back to device offset for null timezone', () => {
      const date = new Date('2026-05-18T12:00:00Z');
      const expected = -date.getTimezoneOffset() / 60;
      expect(tzOffsetHours(null, date)).toBe(expected);
    });

    it('falls back to device offset when timezone is invalid', () => {
      // Invalid timezones throw inside Intl; the function should catch.
      const date = new Date('2026-05-18T12:00:00Z');
      const result = tzOffsetHours('Not/A/Real/Zone', date);
      expect(typeof result).toBe('number');
    });
  });
});

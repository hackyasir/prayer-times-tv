// ── formatters.js tests ──────────────────────────────────────────────────
//
// Covers the 5 exported helpers in lib/formatters.js. These are pure
// functions — same input always gives same output — so tests are
// straightforward assertions on string/date returns.
//
// Time-formatting tests use specific timezones (UTC, America/Toronto,
// Asia/Karachi) to verify Intl-based formatting works across DST and
// non-DST zones.

import { describe, it, expect } from 'vitest';
import {
  fmt12,
  addMins,
  fmtCountdown,
  bearingToCompass,
  bearingToCompassLong,
} from '../formatters.js';

describe('fmt12', () => {
  describe('positive', () => {
    it('formats noon UTC as 12:00 PM in UTC zone', () => {
      const d = new Date('2026-05-18T12:00:00Z');
      expect(fmt12(d, 'UTC')).toBe('12:00 PM');
    });

    it('formats midnight UTC as 12:00 AM in UTC zone', () => {
      const d = new Date('2026-05-18T00:00:00Z');
      expect(fmt12(d, 'UTC')).toBe('12:00 AM');
    });

    it('formats 13:42 UTC as 1:42 PM in UTC zone', () => {
      const d = new Date('2026-05-18T13:42:00Z');
      expect(fmt12(d, 'UTC')).toBe('1:42 PM');
    });

    it('formats 01:05 UTC as 1:05 AM in UTC zone', () => {
      const d = new Date('2026-05-18T01:05:00Z');
      expect(fmt12(d, 'UTC')).toBe('1:05 AM');
    });

    it('respects the IANA timezone — Asia/Karachi (UTC+5)', () => {
      // 07:00 UTC → 12:00 PM in Karachi
      const d = new Date('2026-05-18T07:00:00Z');
      expect(fmt12(d, 'Asia/Karachi')).toBe('12:00 PM');
    });

    it('respects the IANA timezone — America/Toronto (UTC-4 in May)', () => {
      // 16:00 UTC → 12:00 PM in Toronto (EDT)
      const d = new Date('2026-05-18T16:00:00Z');
      expect(fmt12(d, 'America/Toronto')).toBe('12:00 PM');
    });

    it('pads single-digit minutes to two digits', () => {
      const d = new Date('2026-05-18T12:03:00Z');
      expect(fmt12(d, 'UTC')).toBe('12:03 PM');
    });
  });

  describe('negative / edge cases', () => {
    it('returns "--:--" for null input', () => {
      expect(fmt12(null, 'UTC')).toBe('--:--');
    });

    it('returns "--:--" for undefined input', () => {
      expect(fmt12(undefined, 'UTC')).toBe('--:--');
    });

    it('falls back to device-local when tz throws', () => {
      // Invalid timezone string makes Intl throw → fallback path.
      // We can't predict device-local time here, but we can verify
      // the result is non-empty and follows the format.
      const d = new Date('2026-05-18T12:00:00Z');
      const result = fmt12(d, 'Not/A/Real/Zone');
      expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('handles no timezone (uses device local)', () => {
      const d = new Date('2026-05-18T12:00:00Z');
      const result = fmt12(d);
      expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });
  });
});

describe('addMins', () => {
  it('adds positive minutes correctly', () => {
    const d = new Date('2026-05-18T12:00:00Z');
    const result = addMins(d, 15);
    expect(result.toISOString()).toBe('2026-05-18T12:15:00.000Z');
  });

  it('handles zero minutes (returns equivalent time)', () => {
    const d = new Date('2026-05-18T12:00:00Z');
    const result = addMins(d, 0);
    expect(result.getTime()).toBe(d.getTime());
  });

  it('handles negative minutes (subtracts)', () => {
    const d = new Date('2026-05-18T12:00:00Z');
    const result = addMins(d, -30);
    expect(result.toISOString()).toBe('2026-05-18T11:30:00.000Z');
  });

  it('wraps across midnight when crossing day boundary', () => {
    const d = new Date('2026-05-18T23:45:00Z');
    const result = addMins(d, 30);
    expect(result.toISOString()).toBe('2026-05-19T00:15:00.000Z');
  });

  it('returns null for null date', () => {
    expect(addMins(null, 15)).toBeNull();
  });

  it('returns null for null mins', () => {
    const d = new Date('2026-05-18T12:00:00Z');
    expect(addMins(d, null)).toBeNull();
  });

  it('does not mutate the original date', () => {
    const d = new Date('2026-05-18T12:00:00Z');
    const original = d.getTime();
    addMins(d, 30);
    expect(d.getTime()).toBe(original);
  });
});

describe('fmtCountdown', () => {
  it('formats hours, minutes, seconds with zero-padding', () => {
    expect(fmtCountdown(3661)).toBe('01:01:01'); // 1h 1m 1s
  });

  it('returns "00:00:00" for zero seconds', () => {
    expect(fmtCountdown(0)).toBe('00:00:00');
  });

  it('returns "00:00:00" for negative seconds', () => {
    expect(fmtCountdown(-100)).toBe('00:00:00');
  });

  it('handles long durations (24+ hours, no overflow)', () => {
    // 90061s = 25h 1m 1s → "25:01:01" (hours can exceed 99)
    expect(fmtCountdown(90061)).toBe('25:01:01');
  });

  it('formats exactly 1 hour', () => {
    expect(fmtCountdown(3600)).toBe('01:00:00');
  });

  it('formats exactly 1 minute', () => {
    expect(fmtCountdown(60)).toBe('00:01:00');
  });
});

describe('bearingToCompass', () => {
  it('returns N for 0°', () => {
    expect(bearingToCompass(0)).toBe('N');
  });

  it('returns E for 90°', () => {
    expect(bearingToCompass(90)).toBe('E');
  });

  it('returns S for 180°', () => {
    expect(bearingToCompass(180)).toBe('S');
  });

  it('returns W for 270°', () => {
    expect(bearingToCompass(270)).toBe('W');
  });

  it('returns NE for 45°', () => {
    expect(bearingToCompass(45)).toBe('NE');
  });

  it('returns NNE for 22.5°', () => {
    expect(bearingToCompass(22.5)).toBe('NNE');
  });

  it('handles negative bearings by wrapping (modulo 360)', () => {
    // -45° = 315° = NW
    expect(bearingToCompass(-45)).toBe('NW');
  });

  it('handles bearings > 360 by wrapping', () => {
    // 450° = 90° = E
    expect(bearingToCompass(450)).toBe('E');
  });
});

describe('bearingToCompassLong', () => {
  it('returns "North" for 0°', () => {
    expect(bearingToCompassLong(0)).toBe('North');
  });

  it('returns long form for cardinal directions', () => {
    expect(bearingToCompassLong(90)).toBe('East');
    expect(bearingToCompassLong(180)).toBe('South');
    expect(bearingToCompassLong(270)).toBe('West');
  });

  it('returns long form for intercardinal directions', () => {
    expect(bearingToCompassLong(45)).toBe('Northeast');
  });

  it('falls back to "North" for completely invalid input', () => {
    // Pure-NaN input → bearingToCompass returns undefined → fallback.
    expect(bearingToCompassLong(NaN)).toBe('North');
  });
});

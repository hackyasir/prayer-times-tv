// ── Ticker.test.jsx ──────────────────────────────────────────────────────
//
// Unit tests for the pure announcement-parsing and expiry logic in Ticker.jsx.
// These cover the markup syntax (! urgent, @YYYY-MM-DD expiry) and — the focus
// of this suite — the TIMEZONE-CORRECT expiry behaviour.
//
// The regression this guards against: expiry used to be computed against the
// DEVICE's local midnight via `new Date(y, m-1, d, 23,59,59)`. On a box whose
// physical timezone differs from the masjid's city (e.g. a London-hosted
// dashboard for a Karachi masjid), an announcement would expire on the wrong
// calendar boundary — vanishing hours early or lingering hours late.
//
// The fix compares CALENDAR DAYS as YYYYMMDD integers, where "today" is the
// city's wall-clock day (derived from useCityTime's cityNow anchor), not the
// device's. These tests assert that day-level comparison directly, so they're
// independent of the machine's actual timezone.

import { describe, it, expect } from 'vitest';
import { parseLine, ymdKey, isActive } from '../Ticker.jsx';

describe('parseLine — markup parsing', () => {
  it('returns null for empty / whitespace-only lines', () => {
    expect(parseLine('')).toBeNull();
    expect(parseLine('   ')).toBeNull();
    expect(parseLine(null)).toBeNull();
    expect(parseLine(undefined)).toBeNull();
  });

  it('parses a plain line with no markup', () => {
    expect(parseLine('Fundraiser this weekend')).toEqual({
      text: 'Fundraiser this weekend',
      urgent: false,
      expiresOn: null,
    });
  });

  it('parses the urgent marker', () => {
    expect(parseLine('! Roof repair appeal')).toEqual({
      text: 'Roof repair appeal',
      urgent: true,
      expiresOn: null,
    });
  });

  it('parses an expiry token', () => {
    expect(parseLine('@2026-06-15 Eid dinner tickets')).toEqual({
      text: 'Eid dinner tickets',
      urgent: false,
      expiresOn: '2026-06-15',
    });
  });

  it('parses urgent + expiry together, in either order', () => {
    expect(parseLine('! @2026-06-15 Last call')).toEqual({
      text: 'Last call',
      urgent: true,
      expiresOn: '2026-06-15',
    });
    expect(parseLine('@2026-06-15 ! Last call')).toEqual({
      text: 'Last call',
      urgent: true,
      expiresOn: '2026-06-15',
    });
  });

  it('only treats a leading @date as a token, not one mid-text', () => {
    // An @date after real text is part of the text, not an expiry token.
    const parsed = parseLine('Meet us @2026-06-15 at the hall');
    expect(parsed.expiresOn).toBeNull();
    expect(parsed.text).toBe('Meet us @2026-06-15 at the hall');
  });

  it('returns null when markup leaves no text behind', () => {
    expect(parseLine('!')).toBeNull();
    expect(parseLine('@2026-06-15')).toBeNull();
    expect(parseLine('! @2026-06-15')).toBeNull();
  });

  it('trims surrounding whitespace from the text', () => {
    expect(parseLine('   Spaced out   ').text).toBe('Spaced out');
  });
});

describe('ymdKey — calendar-day integer', () => {
  it('encodes y/m/d as a comparable YYYYMMDD integer', () => {
    expect(ymdKey(2026, 6, 15)).toBe(20260615);
    expect(ymdKey(2026, 12, 31)).toBe(20261231);
    expect(ymdKey(2026, 1, 1)).toBe(20260101);
  });

  it('orders correctly across month and year boundaries', () => {
    expect(ymdKey(2026, 6, 15)).toBeLessThan(ymdKey(2026, 6, 16));
    expect(ymdKey(2026, 6, 30)).toBeLessThan(ymdKey(2026, 7, 1));
    expect(ymdKey(2026, 12, 31)).toBeLessThan(ymdKey(2027, 1, 1));
  });
});

describe('isActive — expiry by city calendar day', () => {
  const item = (expiresOn) => ({ text: 'x', urgent: false, expiresOn });

  it('keeps items with no expiry date', () => {
    expect(isActive(item(null), 20260615)).toBe(true);
    expect(isActive({ text: 'x' }, 20260615)).toBe(true);
  });

  it('keeps the item through the entire expiry day', () => {
    // City is ON 2026-06-15, item expires 2026-06-15 → still visible.
    expect(isActive(item('2026-06-15'), ymdKey(2026, 6, 15))).toBe(true);
  });

  it('keeps the item before the expiry day', () => {
    expect(isActive(item('2026-06-15'), ymdKey(2026, 6, 14))).toBe(true);
  });

  it('hides the item once the city rolls past the expiry day', () => {
    expect(isActive(item('2026-06-15'), ymdKey(2026, 6, 16))).toBe(false);
  });

  it('treats a malformed expiry token as non-expiring (fail-safe)', () => {
    // Non-numeric, and out-of-range values, all keep the item visible rather
    // than silently hiding it on a volunteer's typo.
    expect(isActive(item('not-a-date'), 20260615)).toBe(true);
    expect(isActive(item('2026-13-40'), ymdKey(2027, 1, 1))).toBe(true);
    expect(isActive(item('2026-00-00'), ymdKey(2027, 1, 1))).toBe(true);
  });

  it('handles valid calendar edges correctly', () => {
    expect(isActive(item('2026-12-31'), ymdKey(2026, 12, 31))).toBe(true);
    expect(isActive(item('2026-12-31'), ymdKey(2027, 1, 1))).toBe(false);
  });

  // ── The timezone-boundary regression ─────────────────────────────────────
  // These encode the exact scenario the fix exists for. We pass the CITY's
  // calendar day explicitly; the device's real timezone is irrelevant because
  // the comparison is day-vs-day, never instant-vs-instant.
  describe('timezone-boundary correctness', () => {
    it('expires on the city day even when device day would differ', () => {
      // Scenario: announcement @2026-06-15.
      // Karachi has already rolled to 2026-06-16 while a London-hosted device
      // is still on 2026-06-15. Expiry must follow the CITY (Karachi).
      const cityKarachiToday = ymdKey(2026, 6, 16); // city has moved on
      expect(isActive(item('2026-06-15'), cityKarachiToday)).toBe(false);
    });

    it('stays visible on the city day even if device has rolled over early', () => {
      // Reverse: device (further east) is already on 2026-06-16, but the
      // masjid's city is still on 2026-06-15. Item must remain visible.
      const cityStillTodayd = ymdKey(2026, 6, 15);
      expect(isActive(item('2026-06-15'), cityStillTodayd)).toBe(true);
    });

    it('is purely day-based — time of day within the city day never matters', () => {
      // Whether it is 00:01 or 23:59 in the city, the same calendar-day key
      // is produced upstream, so isActive gives a stable answer all day.
      const cityDay = ymdKey(2026, 6, 15);
      expect(isActive(item('2026-06-15'), cityDay)).toBe(true); // start of day
      expect(isActive(item('2026-06-15'), cityDay)).toBe(true); // end of day
    });
  });
});

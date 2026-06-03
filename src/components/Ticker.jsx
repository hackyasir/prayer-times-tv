// ── Announcement Ticker ──────────────────────────────────────────────────────
//
// Thin horizontal scrolling strip for announcements. Behaviour:
//
//   - Empty announcements → renders nothing (layout unchanged).
//   - Each newline-separated line = one item.
//   - Items joined with a wide-spaced bullet so lines are clearly separated.
//   - SEAMLESS continuous loop: two copies of the content sit side-by-side
//     in the track; CSS animates translateX(0) → -50%. When copy 1 scrolls
//     fully off-screen-left, copy 2 is at position 0 — pixel-identical to
//     where we started. No pause, no visible seam.
//   - A separator also sits between the two copies so cycle-end → cycle-start
//     stays evenly spaced (otherwise the last item butts against the first).
//   - Direction: LTR scrolls right→left, RTL scrolls left→right.
//   - prefers-reduced-motion: static centred text (CSS fallback).

import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/I18nContext.jsx';

// Bullet separator used between items AND between the two track copies.
// Em-spaces give a wide gap so each announcement reads as standalone.
const SEP = '\u2003\u2003·\u2003\u2003'; // em-space × 2 + bullet + em-space × 2

const EXP_TOKEN = /^@(\d{4}-\d{2}-\d{2})$/;

export function parseLine(raw) {
  const line = (raw || '').trim();
  if (!line) return null;

  const tokens = line.split(/\s+/);
  let urgent = false;
  let expiresOn = null;
  let cursor = 0;

  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (token === '!') {
      urgent = true;
      cursor += 1;
      continue;
    }
    const exp = token.match(EXP_TOKEN);
    if (exp) {
      expiresOn = exp[1];
      cursor += 1;
      continue;
    }
    break;
  }

  const text = tokens.slice(cursor).join(' ').trim();
  if (!text) return null;

  return { text, urgent, expiresOn };
}

// Turn a y/m/d triple into a comparable integer (YYYYMMDD). Comparing these
// is a pure calendar-day comparison — no timezone math, no DST edge cases.
export function ymdKey(y, m, d) {
  return y * 10000 + m * 100 + d;
}

// An announcement with `@YYYY-MM-DD` stays visible THROUGH that whole day in
// the MASJID's timezone, then disappears when the city rolls to the next day.
// `cityToday` is the {y,m,d} of "now" in the city's wall-clock (see useCityTime)
// — NOT the device's local day. A London-hosted box driving a Karachi masjid
// must expire announcements on Karachi's calendar, not London's.
export function isActive(item, cityToday) {
  if (!item?.expiresOn) return true;
  const [y, m, d] = item.expiresOn.split('-').map(Number);
  // Fail-safe: any malformed or out-of-range date keeps the announcement
  // visible rather than silently hiding it. A volunteer's typo should never
  // make a notice vanish without explanation.
  if (![y, m, d].every(Number.isFinite)) return true;
  if (m < 1 || m > 12 || d < 1 || d > 31) return true;
  return cityToday <= ymdKey(y, m, d);
}

export default function Ticker({
  announcements,
  mode = 'scroll',
  staticSeconds = 8,
  cityNow,
}) {
  const { isRTL, t } = useT();
  const [index, setIndex] = useState(0);

  // City-local calendar day as a YYYYMMDD integer. cityNow is the timezone-
  // aware anchor whose LOCAL fields match the city's wall-clock, so reading
  // getFullYear/getMonth/getDate off it gives the city's today. Fall back to
  // device time only if no anchor was passed.
  const anchor = cityNow instanceof Date && !Number.isNaN(cityNow.getTime())
    ? cityNow
    : new Date();
  const cityToday = ymdKey(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    anchor.getDate()
  );

  const items = useMemo(() => {
    return (announcements || '')
      .split('\n')
      .map(parseLine)
      .filter(Boolean)
      .filter((item) => isActive(item, cityToday));
  }, [announcements, cityToday]);

  const safeSeconds = Number.isFinite(Number(staticSeconds))
    ? Math.min(30, Math.max(3, Number(staticSeconds)))
    : 8;

  useEffect(() => {
    setIndex(0);
  }, [announcements, mode, safeSeconds]);

  useEffect(() => {
    if (mode !== 'static' || items.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, safeSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [mode, items.length, safeSeconds]);

  if (items.length === 0) return null;

  if (mode === 'static') {
    const current = items[index % items.length];
    return (
      <div className="ticker ticker--static" data-dir={isRTL ? 'rtl' : 'ltr'}>
        <div className={`ticker-static-item${current.urgent ? ' is-urgent' : ''}`}>
          {current.urgent && <span className="ticker-flag">{t('ticker.urgent')}</span>}
          <span>{current.text}</span>
        </div>
      </div>
    );
  }

  const renderSegment = (segmentKey) => (
    <span className="ticker-segment" key={segmentKey}>
      {items.map((item, itemIdx) => (
        <span key={`${segmentKey}-item-${itemIdx}`}>
          <span className={`ticker-item${item.urgent ? ' is-urgent' : ''}`}>
            {item.urgent && <span className="ticker-flag">{t('ticker.urgent')}</span>}
            <span>{item.text}</span>
          </span>
          <span className="ticker-sep" aria-hidden="true">
            {SEP}
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="ticker" data-dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="ticker-track">
        {renderSegment('a')}
        <span aria-hidden="true">{renderSegment('b')}</span>
      </div>
    </div>
  );
}

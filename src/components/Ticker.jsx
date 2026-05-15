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

import { useT } from '../i18n/I18nContext.jsx';

// Bullet separator used between items AND between the two track copies.
// Em-spaces give a wide gap so each announcement reads as standalone.
const SEP = '\u2003\u2003·\u2003\u2003';   // em-space × 2 + bullet + em-space × 2

export default function Ticker({ announcements }) {
  const { isRTL } = useT();

  const items = (announcements || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  // Each segment ends with the separator so when it scrolls into the next
  // segment, there's spacing — no items collide at the boundary.
  const segment = items.join(SEP) + SEP;

  return (
    <div className="ticker" data-dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="ticker-track">
        <span className="ticker-segment">{segment}</span>
        <span className="ticker-segment" aria-hidden="true">{segment}</span>
      </div>
    </div>
  );
}

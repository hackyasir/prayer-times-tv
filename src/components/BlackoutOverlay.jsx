// ── BlackoutOverlay ──────────────────────────────────────────────────────────
//
// Full-viewport overlay rendered ONLY while useBlackoutMode reports active.
// Reverent design: black background, dim gold accent, centred Arabic
// invocation. A small countdown sits at the bottom showing when the overlay
// will lift naturally.
//
// Dismiss-on-hold: press anywhere for 3 seconds to dismiss the overlay for
// the rest of the current iqamah window. Calls back to the parent via
// onDismiss(); the parent stores a timestamp that useBlackoutMode reads to
// suppress activation for the remainder of THIS window. Next prayer's
// blackout fires normally.
//
// Why a hold instead of an instant tap?
// A mosque display sits in a public area. Curious children or onlookers
// might tap the screen out of curiosity; a 3-second hold prevents accidental
// dismissal while still being trivially discoverable for staff.

import { useEffect, useRef, useState } from 'react';
import { useT, fmtStr } from '../i18n/I18nContext.jsx';
import { fmtCountdown } from '../lib/formatters.js';

const HOLD_DURATION_MS = 3000;

export default function BlackoutOverlay({ active, endsAt, now, opacity = 100, onDismiss }) {
  const { t } = useT();

  // Hold-to-dismiss state. `holdProgress` is 0..1 fraction of the 3-second
  // hold the user has accumulated; rendered as a thin progress bar at the
  // bottom so the user sees feedback while holding.
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStartRef = useRef(null);
  const rafRef = useRef(null);

  // Tick the hold progress while the user is holding. Driven by
  // requestAnimationFrame for smooth visual feedback.
  function startHold() {
    if (holdStartRef.current !== null) return; // already holding
    holdStartRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const fraction = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldProgress(fraction);
      if (fraction >= 1) {
        // Hold completed → fire dismiss callback. Parent records timestamp.
        cancelHold();
        onDismiss?.();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function cancelHold() {
    holdStartRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setHoldProgress(0);
  }

  // Clean up RAF on unmount or when overlay becomes inactive
  useEffect(() => {
    if (!active && rafRef.current) cancelHold();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  if (!active) return null;

  // Seconds remaining until the overlay lifts naturally.
  // The parent ticks `now` every second, so this re-renders smoothly.
  const secsRemaining = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;

  return (
    <div
      className="blackout"
      // Opacity comes from settings (0..100 percent). Convert to rgba alpha
      // so the underlying dashboard shows through proportionally. The CSS
      // file's `background: #000` is overridden here. We keep the value
      // clamped 0..1 defensively in case settings ever has a stale value.
      style={{ background: `rgba(0, 0, 0, ${Math.max(0, Math.min(100, opacity)) / 100})` }}
      // Pointer events — desktop and touch unified via pointer events.
      // pointerleave catches finger-drag-off; pointercancel catches OS
      // interruptions (e.g. notification panel pulled down).
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
    >
      {/* Arabic invocation — Bismillah, traditional reverent opening.
          Stays in Arabic regardless of UI language since it's not a
          translation but the canonical invocation worldwide. */}
      <div className="blackout-text">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>

      {/* Resume countdown — small, at the bottom edge, dim */}
      <div className="blackout-resume">
        {fmtStr(t('blackout.resumingIn'), { time: fmtCountdown(secsRemaining) })}
      </div>

      {/* Hold-to-dismiss hint + progress bar — only visible WHILE holding,
          so we don't advertise the dismiss option to casual viewers. The bar
          fills from 0 → 100% over 3 seconds; releasing resets it. */}
      {holdProgress > 0 && (
        <>
          <div className="blackout-hold-hint">{t('blackout.holdToDismiss')}</div>
          <div className="blackout-hold-bar">
            <div className="blackout-hold-bar-fill" style={{ width: `${holdProgress * 100}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

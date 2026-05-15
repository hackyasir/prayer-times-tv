// ── useLunarPhase — approximate moon phase from Hijri day ──────────────────
//
// The Islamic (Hijri) calendar is lunar, so the day of the Hijri month tells
// us where we are in the lunar cycle:
//   1st  → new moon (phase ≈ 0)
//   7th  → waxing quarter
//   15th → full moon (phase ≈ 1)
//   22nd → waning quarter
//   29th → near-new again
//
// We use |sin(π · (hDay - 1) / 29.5)| so the value smoothly cycles 0→1→0.
// This is approximate but accurate enough for the visual indicator (crescent
// brightness in MosqueIcon, Moon progress style, etc).

import { useMemo } from 'react';

export default function useLunarPhase(hijri) {
  return useMemo(() => {
    // Hijri string starts with "D Month YYYY AH" — extract D
    const dayMatch = hijri.match(/^(\d+)/);
    const hDay = dayMatch ? parseInt(dayMatch[1], 10) : 1;
    return Math.abs(Math.sin(Math.PI * (hDay - 1) / 29.5));
  }, [hijri]);
}

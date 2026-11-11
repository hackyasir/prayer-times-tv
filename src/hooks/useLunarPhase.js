// ── useLunarPhase — the moon's illuminated fraction ─────────────────────────
//
// 0 = new moon (dark), 1 = full moon, from the moon's real position
// (suncalc). Used for the brightness of the crescent in the header's mosque
// icon.
//
// Earlier versions estimated this from the Hijri day, which runs a day or
// two behind the astronomical new moon (the month starts with the first
// sighting) and moves with the Hijri adjustment setting.
//
// `hourKey` (hours since the epoch) keeps the value steady between hours, so
// components that use it re-render at most once an hour.

import { useMemo } from 'react';
import SunCalc from 'suncalc';

export default function useLunarPhase(hourKey) {
  return useMemo(
    () => SunCalc.getMoonIllumination(new Date(hourKey * 3600000)).fraction,
    [hourKey]
  );
}

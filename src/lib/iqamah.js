// ── lib/iqamah.js ────────────────────────────────────────────────────────
//
// Single source of truth for computing the iqamah time of a given prayer.
//
// Why this lives in lib/ rather than inside a component:
//   - Used in two places: live dashboard (App.jsx) and printed monthly
//     schedule (PrintableSchedule.jsx). Without a shared helper, the two
//     can drift — a tweak to one location won't propagate to the other,
//     and the printed schedule could silently show different times than
//     the dashboard for the same day.
//   - Pure date math: no React, no hooks, no DOM. Easy to unit-test.
//
// Two modes:
//   - Manual: iqamah = adhan + offsetMinutes.
//   - Auto:   iqamah = adhan + bufferMinutes, then rounded to the nearest
//             quarter-hour, with a safety floor so iqamah never lands
//             BEFORE adhan.
//
// The "buf = 0" case is intentionally special-cased: many mosques use
// "iqamah immediately after adhan" for Maghrib (sunset is its own
// signal). Rounding 8:37 to 8:45 would push iqamah 8 minutes later than
// the imam expects, so we return adhan-exact when buf is zero.

/**
 * Compute the iqamah Date for a single prayer.
 *
 * @param {Date}   adhan         Adhan time for this prayer.
 * @param {object} opts
 * @param {boolean} opts.autoCalc      True = round-to-quarter mode. False = manual offset.
 * @param {number}  opts.bufferMinutes Used when autoCalc is true (min after adhan to target).
 * @param {number}  opts.offsetMinutes Used when autoCalc is false (manual minutes after adhan).
 * @returns {Date|null} The iqamah time, or null if adhan is missing.
 */
export function computeIqamah(adhan, opts = {}) {
  if (!adhan) return null;
  const { autoCalc = false, bufferMinutes = 0, offsetMinutes = 0 } = opts;

  // Manual mode — straight addition.
  if (!autoCalc) {
    return new Date(adhan.getTime() + (offsetMinutes || 0) * 60_000);
  }

  // Auto mode — buf=0 means iqamah-immediately, no rounding.
  // This matches the convention many mosques use for Maghrib.
  const buf = Number(bufferMinutes) || 0;
  if (buf === 0) return new Date(adhan.getTime());

  // Step 1+2: target = adhan + buffer
  const target = new Date(adhan.getTime() + buf * 60_000);

  // Step 3: round to NEAREST quarter-hour. We rebuild the Date from scratch
  // (year/month/day from target, time-of-day from the rounded minutes)
  // because setMinutes() with a value > 59 carries into hours automatically.
  const targetMin = target.getHours() * 60 + target.getMinutes();
  let roundedMin = Math.round(targetMin / 15) * 15;

  const rounded = new Date(target);
  rounded.setHours(0, 0, 0, 0);
  rounded.setMinutes(roundedMin);

  // Step 4: safety floor. Rounding "nearest" can pull iqamah BEFORE adhan
  // (e.g. adhan 4:17 + 1m buf = 4:18 → rounds to 4:15). Bump forward to
  // the next quarter ≥ adhan so iqamah is never before the call to prayer.
  while (rounded < adhan) {
    roundedMin += 15;
    rounded.setHours(0, 0, 0, 0);
    rounded.setMinutes(roundedMin);
  }

  return rounded;
}

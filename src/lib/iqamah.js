// ── lib/iqamah.js ────────────────────────────────────────────────────────
//
// Single source of truth for computing the iqamah time of a given prayer.
// Used by the live dashboard (App.jsx), the Settings preview
// (SettingsPanel.jsx) and the printed monthly schedule
// (PrintableSchedule.jsx), so all three always agree.
//
// Manual mode:  iqamah = adhan + offsetMinutes.
//
// Automatic mode — the formula, per prayer:
//
//   1. earliest = adhan + minimum wait                (the wait is guaranteed)
//   2. round earliest UP to the rounding step         (quarter-hour, 5 min,
//                                                      or exact)
//   3. Fajr, if "N minutes before sunrise" is set:    iqamah = the later of
//        step 2 and (sunrise − N, rounded DOWN)       (Hanafi practice of
//                                                      praying Fajr late)
//   4. Fajr is never later than 15 minutes before sunrise, so there is time
//      to pray (pulled back, rounded down, never before the adhan).
//
// Exceptions: Maghrib is always exactly adhan + its minutes (short window,
// prayed soon after the adhan), and a wait of 0 means iqamah at the adhan
// unless the Fajr sunrise rule applies.
//
// Rounding up to a quarter-hour keeps the time the same for days at a time
// (adhan times drift about a minute a day), like a posted schedule. Every
// UTC offset in use is a multiple of 15 minutes, so rounding on the epoch
// gives the same quarter-hours as the city's local clock — no timezone or
// daylight-saving handling needed.
//
// (Before November 2026 auto mode rounded to the NEAREST quarter-hour, so
// the real wait could be ~7 minutes shorter than the minimum. Settings saved
// under that rule are migrated on load — see lib/settingsImport.js.)

const MINUTE = 60_000;
export const ROUNDING_STEPS = [15, 5, 1];
/** Fajr iqamah is never later than this many minutes before sunrise. */
export const FAJR_LATEST_BEFORE_SUNRISE = 15;

const ceilTo = (ms, stepMin) => Math.ceil(ms / (stepMin * MINUTE)) * stepMin * MINUTE;
const floorTo = (ms, stepMin) => Math.floor(ms / (stepMin * MINUTE)) * stepMin * MINUTE;

/**
 * Compute the iqamah Date for a single prayer.
 *
 * @param {Date}   adhan          Adhan time for this prayer.
 * @param {object} opts
 * @param {boolean} opts.autoCalc             True = automatic mode. False = manual offset.
 * @param {number}  opts.bufferMinutes        Auto: minimum minutes after the adhan.
 * @param {number}  opts.offsetMinutes        Manual: minutes after the adhan.
 * @param {string}  [opts.prayerKey]          'maghrib' is never rounded; 'fajr' gets the
 *                                            sunrise rules.
 * @param {number}  [opts.roundTo=15]         Auto: rounding step in minutes (15, 5 or 1).
 * @param {Date}    [opts.sunrise]            Auto, Fajr: today's sunrise.
 * @param {number}  [opts.fajrBeforeSunrise]  Auto, Fajr: hold iqamah until this many
 *                                            minutes before sunrise (0 = off).
 * @returns {Date|null} The iqamah time, or null if adhan is missing.
 */
export function computeIqamah(adhan, opts = {}) {
  if (!adhan) return null;
  const {
    autoCalc = false,
    bufferMinutes = 0,
    offsetMinutes = 0,
    prayerKey,
    roundTo = 15,
    sunrise = null,
    fajrBeforeSunrise = 0,
  } = opts;

  // Manual mode — straight addition.
  if (!autoCalc) {
    return new Date(adhan.getTime() + (offsetMinutes || 0) * MINUTE);
  }

  const adhanMs = adhan.getTime();
  const buf = Math.max(0, Number(bufferMinutes) || 0);
  const step = ROUNDING_STEPS.includes(Number(roundTo)) ? Number(roundTo) : 15;
  const isFajr = prayerKey === 'fajr';
  const sunriseMs = sunrise instanceof Date ? sunrise.getTime() : null;
  const beforeSunrise = Math.max(0, Number(fajrBeforeSunrise) || 0);
  const anchorMs =
    isFajr && sunriseMs !== null && beforeSunrise > 0 ? sunriseMs - beforeSunrise * MINUTE : null;

  // Maghrib, or "iqamah at the adhan" (no sunrise rule): exact.
  if (prayerKey === 'maghrib' || (buf === 0 && anchorMs === null)) {
    return new Date(adhanMs + buf * MINUTE);
  }

  // 1–2. Minimum wait, rounded up.
  let iqamahMs = ceilTo(adhanMs + buf * MINUTE, step);

  // 3. Fajr follows sunrise (never earlier than step 2).
  if (anchorMs !== null) iqamahMs = Math.max(iqamahMs, floorTo(anchorMs, step));

  // 4. Fajr: leave time to pray before sunrise.
  if (isFajr && sunriseMs !== null) {
    const latestMs = sunriseMs - FAJR_LATEST_BEFORE_SUNRISE * MINUTE;
    if (iqamahMs > latestMs) iqamahMs = Math.max(adhanMs, floorTo(latestMs, step));
  }

  return new Date(iqamahMs);
}

/**
 * The iqamah for one prayer from the app's settings — the one call the
 * dashboard, Settings preview and printed schedule all use.
 *
 * @param {object} times     { fajr, sunrise, dhuhr, … } adhan Dates for the day
 * @param {string} key       'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
 * @param {object} settings  applied or draft settings
 */
export function iqamahFromSettings(times, key, settings) {
  return computeIqamah(
    times?.[key],
    settings.iqamahAutoCalc
      ? {
          autoCalc: true,
          bufferMinutes: settings.iqamahAutoBuffers?.[key] ?? 0,
          prayerKey: key,
          roundTo: settings.iqamahRoundTo,
          sunrise: times?.sunrise,
          fajrBeforeSunrise: settings.iqamahFajrBeforeSunrise,
        }
      : { autoCalc: false, offsetMinutes: settings.iqamah?.[key] ?? 0 }
  );
}

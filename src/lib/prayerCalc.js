// ── Prayer time calculation — adhan-js wrapper ──────────────────────────────
//
// This module is the single source of truth for converting (location, date,
// method) into the six prayer time instants. It wraps the `adhan` npm
// package and preserves the same export signature the rest of the app uses,
// so swapping the underlying engine is invisible to App.jsx, hooks, and
// components.
//
// Why adhan-js?
//   - Battle-tested across thousands of mosque apps; matches IslamicFinder,
//     MuslimPro, and other reference implementations
//   - Built-in high-latitude rules (Middle of Night / Seventh of Night /
//     Angle-Based) — essential for cities above ~48° where the sun doesn't
//     dip 18° below the horizon in summer, otherwise Fajr/Isha return null
//   - More precise solar position algorithm than hand-rolled spherical
//     astronomy — same ±1-min accuracy at any latitude / time of year
//   - Maintained free; tracks updates from Islamic authorities
//
// The exports here match what the rest of the codebase consumed before this
// rewrite — calcTimes, calcQibla, tzOffsetHours — so no downstream changes
// are needed.

import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
  HighLatitudeRule,
  Qibla,
} from 'adhan';

// ── Method mapping ──────────────────────────────────────────────────────────
//
// Our settings store the method as a short string ('MWL', 'ISNA', ...).
// adhan-js exposes each as a factory function on CalculationMethod that
// returns a fresh CalculationParameters object. The factory makes a new
// object each call, so it's safe to call per-render without sharing state.

const METHOD_FACTORIES = {
  MWL:       CalculationMethod.MuslimWorldLeague,
  ISNA:      CalculationMethod.NorthAmerica,
  Egypt:     CalculationMethod.Egyptian,
  Makkah:    CalculationMethod.UmmAlQura,
  Karachi:   CalculationMethod.Karachi,
  Singapore: CalculationMethod.Singapore,
};

// ── High-latitude rule mapping ──────────────────────────────────────────────
//
// At latitudes above ~48° during summer, the sun doesn't dip far enough
// below the horizon for the standard angle-based Fajr/Isha to be defined.
// Three corrective rules exist; our settings store the choice as a short
// string and we map it to the adhan-js constant here.
//
//   'middleOfNight'    Fajr/Isha bracket the midpoint between Maghrib and
//                      Sunrise. Simplest; widely used by IslamicFinder.
//   'seventhOfNight'   Fajr = sunrise − (1/7 of night), Isha = sunset + (1/7).
//                      Used by some North American authorities.
//   'twilightAngle'    Hybrid: angle when it works, otherwise interpolate
//                      based on the angle's distance from the horizon.
//                      The most "principled" approach for very high latitudes.
//
// Below ~48° latitude the rule has no observable effect — the standard
// angle-based calculation works year-round.

const HIGH_LAT_RULES = {
  middleOfNight:  HighLatitudeRule.MiddleOfTheNight,
  seventhOfNight: HighLatitudeRule.SeventhOfTheNight,
  twilightAngle:  HighLatitudeRule.TwilightAngle,
};

/**
 * Compute prayer times for a given date + location + method.
 *
 * @param {Date}    date         Anchor date — only Y/M/D are read (time ignored).
 *                               Pass cityNow from useCityTime so the date matches
 *                               the city's calendar day.
 * @param {number}  lat          Latitude in degrees (positive north).
 * @param {number}  lng          Longitude in degrees (positive east).
 * @param {string}  method       Method key — one of: MWL, ISNA, Egypt, Makkah,
 *                               Karachi, Singapore. Falls back to MWL if unknown.
 * @param {number}  shadow       Asr juristic method: 1 = Standard (Shafi/Maliki/
 *                               Hanbali), 2 = Hanafi (longer shadow).
 * @param {string=} ianaTimezone Reserved — adhan-js works with UTC instants and
 *                               doesn't need the timezone. Kept in the signature
 *                               for compatibility with the old custom calculator;
 *                               currently ignored. fmt12() handles tz-aware display.
 * @param {string=} highLatRule  'middleOfNight' (default) | 'seventhOfNight' |
 *                               'twilightAngle'. Only observable above ~48° lat.
 * @returns {{fajr: Date|null, sunrise: Date|null, dhuhr: Date|null,
 *            asr: Date|null,  maghrib: Date|null, isha: Date|null}}
 *           Each value is an absolute UTC instant (Date). All six keys are
 *           always present; values are rarely null with adhan-js (it always
 *           produces a result via the chosen high-latitude rule).
 */
export function calcTimes(
  date, lat, lng, method, shadow,
  ianaTimezone /* unused */,
  highLatRule = 'middleOfNight'
) {
  // adhan-js wants the calendar day; building a fresh Date with just Y/M/D
  // avoids any timezone-shift surprises from passing in a time component.
  const dayOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const coords  = new Coordinates(lat, lng);

  // Build CalculationParameters: factory → mutate madhab + highLatitudeRule
  const factory = METHOD_FACTORIES[method] || METHOD_FACTORIES.MWL;
  const params  = factory();
  params.madhab           = shadow === 2 ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HIGH_LAT_RULES[highLatRule] || HighLatitudeRule.MiddleOfTheNight;

  const pt = new PrayerTimes(coords, dayOnly, params);

  return {
    fajr:    pt.fajr    || null,
    sunrise: pt.sunrise || null,
    dhuhr:   pt.dhuhr   || null,
    asr:     pt.asr     || null,
    maghrib: pt.maghrib || null,
    isha:    pt.isha    || null,
  };
}

/**
 * Compute the qibla bearing (direction to the Kaaba) from a given location.
 *
 * @param {number} lat Latitude in degrees (positive north).
 * @param {number} lng Longitude in degrees (positive east).
 * @returns {number}   Bearing in degrees from true north, 0..360.
 *                     0 = North, 90 = East, 180 = South, 270 = West.
 */
export function calcQibla(lat, lng) {
  return Qibla(new Coordinates(lat, lng));
}

// ── tzOffsetHours ───────────────────────────────────────────────────────────
//
// Used by makeCityDateAt in App.jsx for Jumu'ah/Eid date construction.
// adhan-js doesn't need this internally — it produces absolute UTC instants
// directly — but the helper is still needed for building Jumu'ah/Eid Date
// objects from HH:MM strings entered in Settings.
//
// Returns the UTC offset in hours for the given IANA timezone on the given
// date. Falls back to the device's offset if the timezone string is invalid.

export function tzOffsetHours(ianaTimezone, date) {
  if (!ianaTimezone) return -date.getTimezoneOffset() / 60;
  try {
    // Intl trick: format the same instant in UTC and in the target tz,
    // then diff them to get the UTC offset without a timezone database.
    const fmt = (tz) => new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(date);
    const local = fmt(ianaTimezone);
    const utc   = fmt('UTC');
    const parse = s => {
      const [, mo, dd, yyyy, hh, min, sec] = s.match(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/) || [];
      return Date.UTC(+yyyy, +mo - 1, +dd, +hh % 24, +min, +sec);
    };
    return (parse(local) - parse(utc)) / 3600000;
  } catch {
    return -date.getTimezoneOffset() / 60;
  }
}

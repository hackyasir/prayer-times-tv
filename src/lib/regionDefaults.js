// ── regionDefaults — first-run settings for a location ──────────────────────
//
// The calculation method and Asr convention belong to each mosque, but most
// mosques follow their country's usual convention. During first-time setup
// — before any settings have been saved — the app pre-selects that
// convention, so the admin usually only has to confirm it. Once settings are
// saved, a deliberate choice is never changed.
//
// Countries not listed keep the app default (Muslim World League, Standard
// Asr), which is the common international choice.

const BY_COUNTRY = {
  // North America — ISNA (15°)
  CA: { method: 'ISNA', shadow: 1 },
  US: { method: 'ISNA', shadow: 1 },
  // South Asia — University of Karachi, Hanafi Asr
  PK: { method: 'Karachi', shadow: 2 },
  IN: { method: 'Karachi', shadow: 2 },
  BD: { method: 'Karachi', shadow: 2 },
  AF: { method: 'Karachi', shadow: 2 },
  // Gulf and Middle East
  SA: { method: 'Makkah', shadow: 1 },
  AE: { method: 'Dubai', shadow: 1 },
  QA: { method: 'Qatar', shadow: 1 },
  KW: { method: 'Kuwait', shadow: 1 },
  EG: { method: 'Egypt', shadow: 1 },
  IR: { method: 'Tehran', shadow: 1 },
  // Türkiye — Diyanet, Hanafi Asr
  TR: { method: 'Turkey', shadow: 2 },
  // Southeast Asia — MUIS / JAKIM / Kemenag share 20° Fajr, 18° Isha
  SG: { method: 'Singapore', shadow: 1 },
  MY: { method: 'Singapore', shadow: 1 },
  ID: { method: 'Singapore', shadow: 1 },
  BN: { method: 'Singapore', shadow: 1 },
};

// Device timezone → country, for the first-run location lookup, which gives
// coordinates and the device's timezone but no country.
const TZ_COUNTRY = {
  'Asia/Karachi': 'PK',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD',
  'Asia/Kabul': 'AF',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Africa/Cairo': 'EG',
  'Asia/Tehran': 'IR',
  'Europe/Istanbul': 'TR',
  'Asia/Istanbul': 'TR',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Brunei': 'BN',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Indian/Maldives': 'MV',
};

// Canadian and US zones (America/* also covers Latin America, so list them).
const NORTH_AMERICA_ZONES = new Set([
  'America/St_Johns',
  'America/Halifax',
  'America/Glace_Bay',
  'America/Moncton',
  'America/Goose_Bay',
  'America/Toronto',
  'America/Montreal',
  'America/Nipigon',
  'America/Thunder_Bay',
  'America/Iqaluit',
  'America/Winnipeg',
  'America/Regina',
  'America/Swift_Current',
  'America/Edmonton',
  'America/Calgary',
  'America/Yellowknife',
  'America/Whitehorse',
  'America/Vancouver',
  'America/New_York',
  'America/Detroit',
  'America/Chicago',
  'America/Menominee',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Nome',
  'Pacific/Honolulu',
]);
const NORTH_AMERICA_PREFIXES = ['America/Indiana/', 'America/Kentucky/', 'America/North_Dakota/'];

function countryForTimeZone(timeZone) {
  if (!timeZone) return '';
  if (TZ_COUNTRY[timeZone]) return TZ_COUNTRY[timeZone];
  if (
    NORTH_AMERICA_ZONES.has(timeZone) ||
    NORTH_AMERICA_PREFIXES.some((p) => timeZone.startsWith(p))
  ) {
    // CA and US share the same convention, so either code works here.
    return 'US';
  }
  return '';
}

/**
 * The usual calculation method and Asr convention for a location.
 *
 * @param {{ countryCode?: string, timeZone?: string }} where
 *   countryCode — ISO 3166 alpha-2 (e.g. from city search); preferred
 *   timeZone    — IANA zone (e.g. the device's), used when no country is known
 * @returns {{ method: string, shadow: 1 | 2 } | null}  null = keep the default
 */
export function suggestCalcSettings({ countryCode, timeZone } = {}) {
  const code = String(countryCode || '').toUpperCase() || countryForTimeZone(timeZone);
  return BY_COUNTRY[code] ? { ...BY_COUNTRY[code] } : null;
}

/**
 * How the chosen method and Asr compare with a location's usual convention,
 * for the "Usual in …" note in Settings. Unlike first-time setup, the note
 * never changes anything by itself.
 *
 * @param {{ countryCode?: string, timeZone?: string }} where
 * @param {{ method?: string, shadow?: number }} settings  draft or applied
 * @returns {{ status: 'matches' | 'differs', method: string, shadow: 1 | 2 }
 *          | { status: 'none' }}  'none' = no usual convention known
 */
export function regionCalcStatus(where, settings) {
  const usual = suggestCalcSettings(where);
  if (!usual) return { status: 'none' };
  const shadow = Number(settings?.shadow) === 2 ? 2 : 1;
  const matches = settings?.method === usual.method && shadow === usual.shadow;
  return { status: matches ? 'matches' : 'differs', ...usual };
}

// ── Automatic iqamah presets ───────────────────────────────────────────────
// Starting points for the automatic-iqamah formula (lib/iqamah.js): minimum
// wait per prayer, rounding step, and an optional "Fajr N minutes before
// sunrise". Each mosque still adjusts them; these match common practice:
//
//   rounded   Posted, rounded times — usual in North America and Europe.
//             Minimum waits rounded up to the quarter-hour; Maghrib exact.
//   gulf      Fixed minutes after the adhan, not rounded — Gulf mosques follow
//             ministry intervals (commonly ~25 min Fajr, 15–20 min Dhuhr / Asr
//             / Isha; ministries shorten them in Ramadan and Hajj, so check
//             the current directive).
//   southAsia Hanafi practice of praying Fajr late: about 35 minutes before
//             sunrise (sources cite 30–40), and not before 20 minutes after
//             the adhan; other prayers rounded to the quarter-hour.
//   maldives  The Islamic Ministry's 2025 national intervals: 15 / 12 / 12 /
//             8 / 10 minutes, exact.
export const IQAMAH_PRESETS = {
  rounded: {
    buffers: { fajr: 20, dhuhr: 10, asr: 10, maghrib: 5, isha: 10 },
    roundTo: 15,
    fajrBeforeSunrise: 0,
  },
  gulf: {
    buffers: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 },
    roundTo: 1,
    fajrBeforeSunrise: 0,
  },
  southAsia: {
    buffers: { fajr: 20, dhuhr: 15, asr: 10, maghrib: 5, isha: 15 },
    roundTo: 15,
    fajrBeforeSunrise: 35,
  },
  maldives: {
    buffers: { fajr: 15, dhuhr: 12, asr: 12, maghrib: 8, isha: 10 },
    roundTo: 1,
    fajrBeforeSunrise: 0,
  },
};
export const IQAMAH_PRESET_ORDER = ['rounded', 'gulf', 'southAsia', 'maldives'];

const IQAMAH_PRESET_BY_COUNTRY = {
  SA: 'gulf',
  AE: 'gulf',
  QA: 'gulf',
  KW: 'gulf',
  BH: 'gulf',
  OM: 'gulf',
  PK: 'southAsia',
  IN: 'southAsia',
  BD: 'southAsia',
  AF: 'southAsia',
  MV: 'maldives',
};

/**
 * The automatic-iqamah preset usually followed in a location.
 * @returns {keyof IQAMAH_PRESETS} 'rounded' when nothing more specific applies
 */
export function suggestIqamahPreset({ countryCode, timeZone } = {}) {
  const code = String(countryCode || '').toUpperCase() || countryForTimeZone(timeZone);
  return IQAMAH_PRESET_BY_COUNTRY[code] || 'rounded';
}

/** A preset as settings fields (fresh copies, safe to store). */
export function iqamahPresetSettings(key) {
  const preset = IQAMAH_PRESETS[key] || IQAMAH_PRESETS.rounded;
  return {
    iqamahAutoBuffers: { ...preset.buffers },
    iqamahRoundTo: preset.roundTo,
    iqamahFajrBeforeSunrise: preset.fajrBeforeSunrise,
  };
}

/** Which preset the given settings match exactly, or null for custom values. */
export function matchingIqamahPreset(settings) {
  for (const key of IQAMAH_PRESET_ORDER) {
    const p = IQAMAH_PRESETS[key];
    const same =
      Number(settings.iqamahRoundTo) === p.roundTo &&
      Number(settings.iqamahFajrBeforeSunrise || 0) === p.fajrBeforeSunrise &&
      Object.entries(p.buffers).every(
        ([prayer, minutes]) => Number(settings.iqamahAutoBuffers?.[prayer]) === minutes
      );
    if (same) return key;
  }
  return null;
}

/**
 * Everything to pre-select for a location during first-time setup:
 * calculation method / Asr (when known) plus the iqamah preset.
 */
export function suggestRegionSettings(where = {}) {
  return {
    ...(suggestCalcSettings(where) || {}),
    ...iqamahPresetSettings(suggestIqamahPreset(where)),
  };
}

/**
 * The interface language to start with: Arabic or Urdu when the device is
 * set to it, otherwise English.
 *
 * @param {readonly string[]} [languages] — defaults to navigator.languages
 * @returns {'en' | 'ar' | 'ur'}
 */
export function deviceLanguage(languages) {
  const list =
    languages ||
    (typeof navigator !== 'undefined'
      ? navigator.languages?.length
        ? navigator.languages
        : [navigator.language]
      : []);
  for (const tag of list) {
    const primary = String(tag || '')
      .toLowerCase()
      .split('-')[0];
    if (primary === 'ar' || primary === 'ur' || primary === 'en') return primary;
  }
  return 'en';
}

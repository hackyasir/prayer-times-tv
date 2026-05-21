// ── Constants — enum-like values used across the app ─────────────────────────

export const STORAGE_KEY = 'masjid_dashboard_v1';

// Days of week (Sun = 0)
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Full month names (Jan = 0)
export const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Hijri (lunar) month names
export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

// The five daily prayers + sunrise (Sunrise is observed but no congregation).
// Keys are lowercase identifiers; en/ar are user-facing display labels.
export const PRAYERS = [
  { key: 'fajr', en: 'Fajr', ar: 'الفجر' },
  { key: 'sunrise', en: 'Sunrise', ar: 'الشروق' },
  { key: 'dhuhr', en: 'Dhuhr', ar: 'الظهر' },
  { key: 'asr', en: 'Asr', ar: 'العصر' },
  { key: 'maghrib', en: 'Maghrib', ar: 'المغرب' },
  { key: 'isha', en: 'Isha', ar: 'العشاء' },
];

// Prayer calculation methods (Fajr/Isha angle conventions).
// Each value is { fajr: <angle>, isha: <angle | minutesAfterMaghrib> }.
// If isha is > 30, it's interpreted as fixed minutes after Maghrib (used by
// Umm al-Qura/Makkah where Isha = Maghrib + 90 min); otherwise it's an angle.
// Note: this map is informational/display-only — the actual calculation
// parameters come from adhan-js's CalculationMethod factories (see
// src/lib/prayerCalc.js).
export const METHODS = {
  MWL: { fajr: 18, isha: 17 }, // Muslim World League
  ISNA: { fajr: 15, isha: 15 }, // Islamic Society of North America
  Moonsighting: { fajr: 18, isha: 18 }, // Moonsighting Committee Worldwide
  Egypt: { fajr: 19.5, isha: 17.5 }, // Egyptian General Authority
  Makkah: { fajr: 18.5, isha: 90 }, // Umm al-Qura — Isha = 90 min after Maghrib
  Dubai: { fajr: 18.2, isha: 18.2 }, // UAE (with +3 min adjustments built into adhan-js)
  Qatar: { fajr: 18, isha: 90 }, // Qatar — Isha = 90 min after Maghrib
  Kuwait: { fajr: 18, isha: 17.5 }, // Kuwait
  Karachi: { fajr: 18, isha: 18 }, // University of Islamic Sciences, Karachi
  Singapore: { fajr: 20, isha: 18 }, // MUIS Singapore
  Turkey: { fajr: 18, isha: 17 }, // Diyanet approximation
  Tehran: { fajr: 17.7, isha: 14 }, // University of Tehran (Shia common)
};

// Friendly display names for the methods above. Ordered roughly by region/
// popularity for sensible dropdown ordering: global → North America → MENA →
// South Asia → other regional.
export const METHOD_LABELS = {
  MWL: 'Muslim World League',
  ISNA: 'ISNA – North America',
  Moonsighting: 'Moonsighting Committee',
  Egypt: 'Egyptian Authority',
  Dubai: 'Dubai (UAE)',
  Makkah: 'Umm al-Qura (Makkah)',
  Qatar: 'Qatar',
  Kuwait: 'Kuwait',
  Karachi: 'University of Karachi',
  Singapore: 'MUIS Singapore',
  Turkey: 'Diyanet (Turkey)',
  Tehran: 'University of Tehran',
};

// Open-Meteo API base URL — no API key required, free for civilian use
export const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

// 16-point compass directions, used to label qibla direction
export const COMPASS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

// Long-form names for the 16 compass points (for display)
export const COMPASS_LONG = {
  N: 'North',
  NNE: 'North-Northeast',
  NE: 'Northeast',
  ENE: 'East-Northeast',
  E: 'East',
  ESE: 'East-Southeast',
  SE: 'Southeast',
  SSE: 'South-Southeast',
  S: 'South',
  SSW: 'South-Southwest',
  SW: 'Southwest',
  WSW: 'West-Southwest',
  W: 'West',
  WNW: 'West-Northwest',
  NW: 'Northwest',
  NNW: 'North-Northwest',
};

// ── Rotating reminders ───────────────────────────────────────────────────────
// One hadith is shown per active-prayer index (cycles through 6 for 6 prayers).
// These are short, well-known sayings about prayer — kept brief so they fit
// the centre column without wrapping awkwardly on TV displays.
export const HADITHS = [
  { ar: 'الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ', en: 'Prayer is better than sleep' },
  { ar: 'الصَّلَاةُ عِمَادُ الدِّينِ', en: 'Prayer is the pillar of religion' },
  { ar: 'أَوَّلُ مَا يُحَاسَبُ بِهِ الصَّلَاة', en: 'The first thing accounted for is prayer' },
  { ar: 'بَيْنَ الْعَبْدِ وَالشِّرْكِ الصَّلَاة', en: 'Between a servant and shirk stands prayer' },
  {
    ar: 'مَنْ حَافَظَ عَلَيْهَا كَانَتْ لَهُ نُوراً',
    en: 'Who guards it — it will be light for them',
  },
  {
    ar: 'الصَّلَوَاتُ الْخَمْسُ كَفَّارَةٌ لِمَا بَيْنَهُنَّ',
    en: 'The five prayers expiate what is between them',
  },
];

// ── External API + env-driven config ────────────────────────────────────────
// City search is powered by Open-Meteo's free geocoding API (~600k cities,
// no API key needed). Keeping the URL here lets the search handler import it
// alongside WEATHER_API rather than redefining it.
export const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';

// Optional PIN guard for the Settings panel — set VITE_SETTINGS_PIN in .env
// (or as an environment variable in the deployment) to require a PIN before
// the Settings panel opens. Leave unset or empty for open access (good for
// trusted kiosk environments where the screen is physically secured).
export const SETTINGS_PIN = import.meta.env.VITE_SETTINGS_PIN || '';

// Show the "Test Pattern" / "Test Jumu'ah" buttons in the footer status strip?
// Useful during initial setup to verify the prayer-context colour shifts and
// Jumu'ah replacement render correctly. Disable in production deployments by
// setting VITE_SHOW_TEST_BUTTONS=false in .env.
export const SHOW_TEST_BTNS = import.meta.env.VITE_SHOW_TEST_BUTTONS !== 'false';

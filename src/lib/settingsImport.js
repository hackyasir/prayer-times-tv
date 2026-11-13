import { METHOD_LABELS } from './constants.js';
import { THEMES } from './themes.js';

const ALLOWED_METHODS = new Set(Object.keys(METHOD_LABELS));
const ALLOWED_THEMES = new Set(Object.keys(THEMES));
const ALLOWED_LANGS = new Set(['en', 'ar', 'ur']);
const ALLOWED_TICKER_MODES = new Set(['scroll', 'static']);
const ALLOWED_PROGRESS = new Set(['ring', 'daybar', 'moon', 'hero', 'line', 'orbit']);
const ALLOWED_HIGH_LAT_RULES = new Set(['middleOfNight', 'seventhOfNight', 'twilightAngle']);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── Coordinates from the device's own position ─────────────────────────────
// Earlier versions could take the location from the device ("Use my
// location", and a lookup on first run) and labelled it with the
// coordinates: "43.65°N  79.38°W" (the first version: "43.65°N  -79.38°E").
// Those coordinates pinpointed where the screen was. Settings with such a
// label keep them only to two decimal places (about 1 km), which is plenty
// for prayer times and weather. A city picked in the search keeps its own.
const DEVICE_LOCATION_LABEL = /^-?\d{1,3}(?:\.\d+)?°[NS][\s,]+-?\d{1,3}(?:\.\d+)?°[EW]$/;

/** Was this location taken from the device (rather than a city)? */
export function isDeviceLocationLabel(locName) {
  return typeof locName === 'string' && DEVICE_LOCATION_LABEL.test(locName.trim());
}

const roundCoordinate = (value) => Math.round(value * 100) / 100;

/** The same settings, with a device-taken location rounded (anything else as it is). */
export function roundDeviceLocation(settings) {
  if (!isPlainObject(settings) || !isDeviceLocationLabel(settings.locName)) return settings;
  const out = { ...settings };
  for (const k of ['lat', 'lng']) {
    if (typeof out[k] === 'number' && Number.isFinite(out[k])) out[k] = roundCoordinate(out[k]);
  }
  return out;
}

/**
 * Text, at most `max` characters (imported files and shared settings can
 * hold anything; the screens only ever need this much).
 */
function toText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  return null;
}

function toStringValue(value) {
  return typeof value === 'string' ? value : null;
}

function normalizeNumberMap(source, defaults) {
  const normalized = { ...defaults };
  if (!isPlainObject(source)) return normalized;

  for (const key of Object.keys(defaults)) {
    const parsed = toFiniteNumber(source[key]);
    if (parsed !== null) normalized[key] = parsed;
  }

  return normalized;
}

// ── Auto-iqamah rule migration ─────────────────────────────────────────────
// Rule 2 (current): each buffer is the MINIMUM wait after the adhan, rounded
// UP to the quarter-hour; Maghrib is exact. Rule 1 (settings saved without
// `iqamahRule`) rounded to the NEAREST quarter-hour, which could make the
// wait up to 7 minutes shorter than the buffer.
//
//   - Untouched rule-1 defaults (30 / 15 / 15 / 0 / 10) move to the new
//     default minimums — their short waits (Isha could be ~3 minutes) were
//     the reason for the change.
//   - Customised buffers are converted b → b − 7, which gives exactly the
//     same Fajr / Dhuhr / Asr / Isha times under rule 2 (buffers of 1–7
//     become 1; that differs only on days the adhan is exactly on a
//     quarter-hour), so a mosque's own schedule doesn't move. Maghrib keeps
//     its minutes but is no longer rounded.
export const IQAMAH_RULE = 2;
const LEGACY_NEAREST_OFFSET = 7;
const RULE1_DEFAULT_BUFFERS = { fajr: 30, dhuhr: 15, asr: 15, maghrib: 0, isha: 10 };

function isRule1Default(buffers) {
  return Object.entries(RULE1_DEFAULT_BUFFERS).every(
    ([key, value]) => toFiniteNumber(buffers[key]) === value
  );
}

/** Returns converted buffers, or undefined to mean "use the current defaults". */
function migrateRule1Buffers(buffers) {
  if (!isPlainObject(buffers) || isRule1Default(buffers)) return undefined;
  const out = { ...buffers };
  for (const key of ['fajr', 'dhuhr', 'asr', 'isha']) {
    const b = toFiniteNumber(out[key]);
    if (b === null) continue;
    out[key] = b <= 0 ? 0 : Math.max(1, b - LEGACY_NEAREST_OFFSET);
  }
  return out;
}

function normalizeSlot(slot, fallback = { time: '', enabled: false }) {
  if (!isPlainObject(slot)) return { ...fallback };
  return {
    time: toStringValue(slot.time) ?? fallback.time,
    enabled: toBoolean(slot.enabled) ?? fallback.enabled,
  };
}

function normalizeSlotArray(source, defaults) {
  if (!Array.isArray(source)) return defaults.map((slot) => ({ ...slot }));
  return source.map((slot, index) => normalizeSlot(slot, defaults[index] ?? { time: '', enabled: false }));
}

function normalizeLegacyEidSlots(source, defaults) {
  if (!Array.isArray(source.eid) || ('eidFitr' in source) || ('eidAdha' in source)) {
    return { eidFitr: defaults.eidFitr, eidAdha: defaults.eidAdha };
  }

  const migratedSlots = source.eid.map((slot) => ({
    time: toStringValue(slot?.time) ?? '',
    enabled: slot?.enabled !== false,
  }));
  const guessedKind = toStringValue(source.eid[0]?.label)?.toLowerCase().includes('adha')
    ? 'adha'
    : 'fitr';

  if (guessedKind === 'adha') {
    return {
      eidFitr: defaults.eidFitr,
      eidAdha: migratedSlots,
    };
  }

  return {
    eidFitr: migratedSlots,
    eidAdha: defaults.eidAdha,
  };
}

export function normalizeImportedSettings(raw, defaults) {
  if (!isPlainObject(raw) || !isPlainObject(defaults)) {
    return { ok: false, error: 'invalid-shape' };
  }

  const source = { ...raw };

  if ('chimeEnabled' in source && !('chimeAdhan' in source) && !('chimeIqamah' in source)) {
    source.chimeAdhan = !!source.chimeEnabled;
    source.chimeIqamah = !!source.chimeEnabled;
  }

  const legacyEid = normalizeLegacyEidSlots(source, defaults);
  const normalized = {
    ...defaults,
    lat: toFiniteNumber(source.lat) ?? defaults.lat,
    lng: toFiniteNumber(source.lng) ?? defaults.lng,
    locName: toText(source.locName, 200) ?? defaults.locName,
    cityTz: toText(source.cityTz, 64) ?? defaults.cityTz,
    masjidName: toText(source.masjidName, 100) ?? defaults.masjidName,
    screenLabel: toText(source.screenLabel, 60) ?? defaults.screenLabel,
    // A logo of up to 100 KB, as a data URL (LogoUploader).
    logoDataUrl: toText(source.logoDataUrl, 200_000) ?? defaults.logoDataUrl,
    method: toStringValue(source.method) && ALLOWED_METHODS.has(source.method) ? source.method : defaults.method,
    shadow: source.shadow === 2 || source.shadow === 1 ? source.shadow : defaults.shadow,
    iqamah: normalizeNumberMap(source.iqamah, defaults.iqamah),
    iqamahAutoCalc:
      toBoolean(source.iqamahAutoCalc) ?? defaults.iqamahAutoCalc,
    iqamahAutoBuffers: normalizeNumberMap(
      'iqamahRule' in source ? source.iqamahAutoBuffers : migrateRule1Buffers(source.iqamahAutoBuffers),
      defaults.iqamahAutoBuffers
    ),
    iqamahRule: IQAMAH_RULE,
    iqamahRoundTo: [1, 5, 15].includes(toFiniteNumber(source.iqamahRoundTo))
      ? toFiniteNumber(source.iqamahRoundTo)
      : defaults.iqamahRoundTo,
    iqamahFajrBeforeSunrise: Math.min(
      90,
      Math.max(0, toFiniteNumber(source.iqamahFajrBeforeSunrise) ?? defaults.iqamahFajrBeforeSunrise)
    ),
    jumuah: normalizeSlotArray(source.jumuah, defaults.jumuah),
    eidFitr: normalizeSlotArray(source.eidFitr ?? legacyEid.eidFitr, defaults.eidFitr),
    eidAdha: normalizeSlotArray(source.eidAdha ?? legacyEid.eidAdha, defaults.eidAdha),
    eidDaysBefore: Math.min(30, Math.max(0, toFiniteNumber(source.eidDaysBefore) ?? defaults.eidDaysBefore)),
    eidLocation: toText(source.eidLocation, 120) ?? defaults.eidLocation,
    hijriOffset: Math.min(3, Math.max(-3, toFiniteNumber(source.hijriOffset) ?? defaults.hijriOffset)),
    highLatRule:
      toStringValue(source.highLatRule) && ALLOWED_HIGH_LAT_RULES.has(source.highLatRule)
        ? source.highLatRule
        : defaults.highLatRule,
    theme: toStringValue(source.theme) && ALLOWED_THEMES.has(source.theme) ? source.theme : defaults.theme,
    ecoMode: toBoolean(source.ecoMode) ?? defaults.ecoMode,
    chimeAdhan: toBoolean(source.chimeAdhan) ?? defaults.chimeAdhan,
    chimeIqamah: toBoolean(source.chimeIqamah) ?? defaults.chimeIqamah,
    fontScale: Math.min(130, Math.max(70, toFiniteNumber(source.fontScale) ?? defaults.fontScale)),
    viewingMode: ['manual', 'distance', 'calibrate'].includes(source.viewingMode)
      ? source.viewingMode
      : defaults.viewingMode,
    viewingDistance: ['close', 'medium', 'large', 'grand'].includes(source.viewingDistance)
      ? source.viewingDistance
      : defaults.viewingDistance,
    viewingCalibrated: Math.min(3.0, Math.max(0.8, toFiniteNumber(source.viewingCalibrated) ?? defaults.viewingCalibrated)),
    progressStyle:
      toStringValue(source.progressStyle) && ALLOWED_PROGRESS.has(source.progressStyle)
        ? source.progressStyle
        : defaults.progressStyle,
    lang: toStringValue(source.lang) && ALLOWED_LANGS.has(source.lang) ? source.lang : defaults.lang,
    autoAnnouncements: toBoolean(source.autoAnnouncements) ?? defaults.autoAnnouncements,
    announcements: toText(source.announcements, 12_000) ?? defaults.announcements,
    tickerMode:
      toStringValue(source.tickerMode) && ALLOWED_TICKER_MODES.has(source.tickerMode)
        ? source.tickerMode
        : defaults.tickerMode,
    tickerStaticSeconds: Math.min(
      30,
      Math.max(3, toFiniteNumber(source.tickerStaticSeconds) ?? defaults.tickerStaticSeconds)
    ),
    blackoutEnabled: toBoolean(source.blackoutEnabled) ?? defaults.blackoutEnabled,
    blackoutLeadSeconds:
      Math.min(300, Math.max(0, toFiniteNumber(source.blackoutLeadSeconds) ?? defaults.blackoutLeadSeconds)),
    blackoutOpacity:
      Math.min(100, Math.max(0, toFiniteNumber(source.blackoutOpacity) ?? defaults.blackoutOpacity)),
    blackoutDurations: normalizeNumberMap(source.blackoutDurations, defaults.blackoutDurations),
  };

  if (isDeviceLocationLabel(normalized.locName)) {
    normalized.lat = roundCoordinate(normalized.lat);
    normalized.lng = roundCoordinate(normalized.lng);
  }

  return { ok: true, value: normalized };
}
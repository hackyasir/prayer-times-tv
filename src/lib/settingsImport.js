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
    locName: toStringValue(source.locName) ?? defaults.locName,
    cityTz: toStringValue(source.cityTz) ?? defaults.cityTz,
    masjidName: toStringValue(source.masjidName) ?? defaults.masjidName,
    screenLabel: toStringValue(source.screenLabel) ?? defaults.screenLabel,
    logoDataUrl: toStringValue(source.logoDataUrl) ?? defaults.logoDataUrl,
    method: toStringValue(source.method) && ALLOWED_METHODS.has(source.method) ? source.method : defaults.method,
    shadow: source.shadow === 2 || source.shadow === 1 ? source.shadow : defaults.shadow,
    iqamah: normalizeNumberMap(source.iqamah, defaults.iqamah),
    iqamahAutoCalc:
      toBoolean(source.iqamahAutoCalc) ?? defaults.iqamahAutoCalc,
    iqamahAutoBuffers: normalizeNumberMap(source.iqamahAutoBuffers, defaults.iqamahAutoBuffers),
    jumuah: normalizeSlotArray(source.jumuah, defaults.jumuah),
    eidFitr: normalizeSlotArray(source.eidFitr ?? legacyEid.eidFitr, defaults.eidFitr),
    eidAdha: normalizeSlotArray(source.eidAdha ?? legacyEid.eidAdha, defaults.eidAdha),
    eidDaysBefore: Math.min(30, Math.max(0, toFiniteNumber(source.eidDaysBefore) ?? defaults.eidDaysBefore)),
    eidLocation: toStringValue(source.eidLocation) ?? defaults.eidLocation,
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
    announcements: toStringValue(source.announcements) ?? defaults.announcements,
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

  return { ok: true, value: normalized };
}
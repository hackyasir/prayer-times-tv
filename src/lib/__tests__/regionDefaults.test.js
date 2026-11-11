// ── regionDefaults.test.js ───────────────────────────────────────────────
// First-run calculation settings and interface language.

import { describe, it, expect } from 'vitest';
import {
  suggestCalcSettings,
  deviceLanguage,
  suggestIqamahPreset,
  iqamahPresetSettings,
  matchingIqamahPreset,
  suggestRegionSettings,
  regionCalcStatus,
  IQAMAH_PRESETS,
} from '../regionDefaults.js';

describe('suggestCalcSettings', () => {
  it('uses the country code from city search', () => {
    expect(suggestCalcSettings({ countryCode: 'CA' })).toEqual({ method: 'ISNA', shadow: 1 });
    expect(suggestCalcSettings({ countryCode: 'pk' })).toEqual({ method: 'Karachi', shadow: 2 });
    expect(suggestCalcSettings({ countryCode: 'TR' })).toEqual({ method: 'Turkey', shadow: 2 });
    expect(suggestCalcSettings({ countryCode: 'SA' })).toEqual({ method: 'Makkah', shadow: 1 });
  });

  it('falls back to the device timezone when no country is known', () => {
    expect(suggestCalcSettings({ timeZone: 'Asia/Karachi' })).toEqual({
      method: 'Karachi',
      shadow: 2,
    });
    expect(suggestCalcSettings({ timeZone: 'America/Toronto' })).toEqual({
      method: 'ISNA',
      shadow: 1,
    });
    expect(suggestCalcSettings({ timeZone: 'America/Indiana/Indianapolis' })).toEqual({
      method: 'ISNA',
      shadow: 1,
    });
  });

  it('prefers the country code over the timezone', () => {
    expect(suggestCalcSettings({ countryCode: 'AE', timeZone: 'America/Toronto' })).toEqual({
      method: 'Dubai',
      shadow: 1,
    });
  });

  it('returns null (keep the default) for unlisted places', () => {
    expect(suggestCalcSettings({ countryCode: 'GB' })).toBeNull();
    expect(suggestCalcSettings({ timeZone: 'America/Sao_Paulo' })).toBeNull();
    expect(suggestCalcSettings({ timeZone: 'Europe/London' })).toBeNull();
    expect(suggestCalcSettings({})).toBeNull();
    expect(suggestCalcSettings()).toBeNull();
  });

  it('returns a copy, so callers cannot change the table', () => {
    const a = suggestCalcSettings({ countryCode: 'CA' });
    a.method = 'MWL';
    expect(suggestCalcSettings({ countryCode: 'CA' }).method).toBe('ISNA');
  });
});

describe('deviceLanguage', () => {
  it('picks Arabic or Urdu when the device uses it', () => {
    expect(deviceLanguage(['ar-SA', 'en-US'])).toBe('ar');
    expect(deviceLanguage(['ur-PK'])).toBe('ur');
  });

  it('uses the first supported language in the list', () => {
    expect(deviceLanguage(['fr-FR', 'ur', 'en'])).toBe('ur');
    expect(deviceLanguage(['de-DE', 'en-GB'])).toBe('en');
  });

  it('defaults to English', () => {
    expect(deviceLanguage(['fr-FR'])).toBe('en');
    expect(deviceLanguage([])).toBe('en');
  });
});

describe('iqamah presets', () => {
  it('suggests the usual preset for a location', () => {
    expect(suggestIqamahPreset({ countryCode: 'SA' })).toBe('gulf');
    expect(suggestIqamahPreset({ countryCode: 'PK' })).toBe('southAsia');
    expect(suggestIqamahPreset({ countryCode: 'MV' })).toBe('maldives');
    expect(suggestIqamahPreset({ timeZone: 'Asia/Dubai' })).toBe('gulf');
    expect(suggestIqamahPreset({ countryCode: 'CA' })).toBe('rounded');
    expect(suggestIqamahPreset({})).toBe('rounded');
  });

  it('turns a preset into settings, as fresh copies', () => {
    const a = iqamahPresetSettings('southAsia');
    expect(a).toEqual({
      iqamahAutoBuffers: IQAMAH_PRESETS.southAsia.buffers,
      iqamahRoundTo: 15,
      iqamahFajrBeforeSunrise: 35,
    });
    a.iqamahAutoBuffers.fajr = 99;
    expect(IQAMAH_PRESETS.southAsia.buffers.fajr).toBe(20);
  });

  it('recognises settings that match a preset, and custom ones', () => {
    expect(matchingIqamahPreset(iqamahPresetSettings('gulf'))).toBe('gulf');
    const custom = { ...iqamahPresetSettings('gulf'), iqamahRoundTo: 5 };
    expect(matchingIqamahPreset(custom)).toBeNull();
  });

  it('first-setup suggestions combine method, Asr and the iqamah preset', () => {
    expect(suggestRegionSettings({ countryCode: 'PK' })).toEqual({
      method: 'Karachi',
      shadow: 2,
      ...iqamahPresetSettings('southAsia'),
    });
    // No method mapping (Bahrain) — just the Gulf iqamah preset.
    expect(suggestRegionSettings({ countryCode: 'BH' })).toEqual(iqamahPresetSettings('gulf'));
    // Unlisted — the rounded default.
    expect(suggestRegionSettings({ countryCode: 'GB' })).toEqual(iqamahPresetSettings('rounded'));
  });
});

describe('regionCalcStatus', () => {
  it('matches when method and Asr are the usual ones', () => {
    expect(regionCalcStatus({ countryCode: 'CA' }, { method: 'ISNA', shadow: 1 })).toEqual({
      status: 'matches',
      method: 'ISNA',
      shadow: 1,
    });
    // A missing shadow counts as Standard.
    expect(regionCalcStatus({ countryCode: 'CA' }, { method: 'ISNA' }).status).toBe('matches');
  });

  it('differs when either the method or the Asr convention is different', () => {
    expect(regionCalcStatus({ countryCode: 'CA' }, { method: 'MWL', shadow: 1 }).status).toBe(
      'differs'
    );
    expect(regionCalcStatus({ countryCode: 'PK' }, { method: 'Karachi', shadow: 1 })).toEqual({
      status: 'differs',
      method: 'Karachi',
      shadow: 2,
    });
  });

  it('reports none where no usual convention is known', () => {
    expect(regionCalcStatus({ countryCode: 'GB' }, { method: 'MWL', shadow: 1 })).toEqual({
      status: 'none',
    });
    expect(regionCalcStatus({}, {})).toEqual({ status: 'none' });
  });
});

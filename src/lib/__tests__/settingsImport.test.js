import { describe, it, expect } from 'vitest';
import { normalizeImportedSettings } from '../settingsImport.js';
import { DEFAULTS } from '../../context/SettingsContext.jsx';

describe('normalizeImportedSettings', () => {
  it('normalizes imported values and strips unknown keys', () => {
    const result = normalizeImportedSettings(
      {
        method: 'Dubai',
        fontScale: '120',
        lang: 'ur',
        progressStyle: 'orbit',
        ecoMode: false,
        autoAnnouncements: true,
        tickerMode: 'static',
        tickerStaticSeconds: '12',
        jumuah: [{ time: '13:15', enabled: true, iqamah: 22 }],
        blackoutOpacity: '80',
        extraField: 'ignore-me',
      },
      DEFAULTS
    );

    expect(result.ok).toBe(true);
    expect(result.value.method).toBe('Dubai');
    expect(result.value.fontScale).toBe(120);
    expect(result.value.lang).toBe('ur');
    expect(result.value.progressStyle).toBe('orbit');
    expect(result.value.ecoMode).toBe(false);
    expect(result.value.autoAnnouncements).toBe(true);
    expect(result.value.tickerMode).toBe('static');
    expect(result.value.tickerStaticSeconds).toBe(12);
    expect(result.value.jumuah[0]).toEqual({ time: '13:15', enabled: true });
    expect(result.value.blackoutOpacity).toBe(80);
    expect(result.value).not.toHaveProperty('extraField');
  });

  it('rejects non-object payloads', () => {
    expect(normalizeImportedSettings(null, DEFAULTS).ok).toBe(false);
    expect(normalizeImportedSettings([], DEFAULTS).ok).toBe(false);
  });

  it('migrates legacy Eid payloads', () => {
    const result = normalizeImportedSettings(
      {
        eid: [{ time: '08:30', enabled: true, label: 'Eid ul-Adha', iqamah: 25 }],
      },
      DEFAULTS
    );

    expect(result.ok).toBe(true);
    expect(result.value.eidAdha[0]).toEqual({ time: '08:30', enabled: true });
    expect(result.value.eidFitr).toEqual(DEFAULTS.eidFitr);
  });
});

// Settings saved before the minimum-wait rule (no `iqamahRule`) rounded to
// the nearest quarter-hour; their buffers are converted so the displayed
// iqamah times stay the same.
describe('normalizeImportedSettings — auto-iqamah rule migration', () => {
  it('moves untouched rule-1 defaults to the new default minimums', () => {
    const result = normalizeImportedSettings(
      { iqamahAutoBuffers: { fajr: 30, dhuhr: 15, asr: 15, maghrib: 0, isha: 10 } },
      DEFAULTS
    );
    expect(result.ok).toBe(true);
    expect(result.value.iqamahAutoBuffers).toEqual(DEFAULTS.iqamahAutoBuffers);
    expect(result.value.iqamahRule).toBe(2);
  });

  it('converts customised rule-1 buffers (b → b − 7) and leaves Maghrib as it was', () => {
    const result = normalizeImportedSettings(
      { iqamahAutoBuffers: { fajr: 25, dhuhr: 20, asr: 15, maghrib: 5, isha: 15 } },
      DEFAULTS
    );
    expect(result.value.iqamahAutoBuffers).toEqual({
      fajr: 18,
      dhuhr: 13,
      asr: 8,
      maghrib: 5,
      isha: 8,
    });
  });

  it('maps small rule-1 buffers to 1 and keeps 0 as 0', () => {
    const result = normalizeImportedSettings(
      { iqamahAutoBuffers: { fajr: 5, dhuhr: 0, asr: 7, maghrib: 10, isha: 1 } },
      DEFAULTS
    );
    expect(result.value.iqamahAutoBuffers).toEqual({
      fajr: 1,
      dhuhr: 0,
      asr: 1,
      maghrib: 10,
      isha: 1,
    });
  });

  it('leaves rule-2 buffers untouched', () => {
    const buffers = { fajr: 20, dhuhr: 10, asr: 10, maghrib: 5, isha: 10 };
    const result = normalizeImportedSettings(
      { iqamahRule: 2, iqamahAutoBuffers: buffers },
      DEFAULTS
    );
    expect(result.value.iqamahAutoBuffers).toEqual(buffers);
  });

  it('uses the new default minimum waits when no buffers were saved', () => {
    const result = normalizeImportedSettings({ method: 'ISNA' }, DEFAULTS);
    expect(result.value.iqamahAutoBuffers).toEqual(DEFAULTS.iqamahAutoBuffers);
    expect(DEFAULTS.iqamahAutoBuffers).toEqual({
      fajr: 20,
      dhuhr: 10,
      asr: 10,
      maghrib: 5,
      isha: 10,
    });
  });
});

describe('normalizeImportedSettings — automatic iqamah options', () => {
  it('keeps valid rounding steps and Fajr sunrise minutes', () => {
    const r = normalizeImportedSettings({ iqamahRoundTo: 5, iqamahFajrBeforeSunrise: 35 }, DEFAULTS);
    expect(r.value.iqamahRoundTo).toBe(5);
    expect(r.value.iqamahFajrBeforeSunrise).toBe(35);
  });

  it('rejects unknown steps and clamps the sunrise minutes', () => {
    const r = normalizeImportedSettings({ iqamahRoundTo: 7, iqamahFajrBeforeSunrise: 500 }, DEFAULTS);
    expect(r.value.iqamahRoundTo).toBe(DEFAULTS.iqamahRoundTo);
    expect(r.value.iqamahFajrBeforeSunrise).toBe(90);
  });
});

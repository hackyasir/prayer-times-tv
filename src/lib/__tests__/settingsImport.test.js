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

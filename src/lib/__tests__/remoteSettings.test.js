// ── remoteSettings.test.js ───────────────────────────────────────────────
// Shared masjid settings: codes, reading a Google Sheet, the sheet
// template, merging over a screen's own settings, and the saved copy.

import { describe, it, expect } from 'vitest';
import { DEFAULTS } from '../../context/SettingsContext.jsx';
import {
  normalizeCode,
  codeFromSearch,
  parseCsv,
  sheetRowsToSettings,
  settingsToSheetCsv,
  mergeRemote,
  contentVersion,
  resolveSheet,
  sheetCsvUrl,
  cloudflareUrls,
  reconnectDelay,
  loadSyncState,
  saveSyncState,
  DEVICE_KEYS,
  MASJID_KEYS,
  pickKeys,
  sharedForMode,
  modeFromSearch,
  settingsNeedPin,
  directoryEntries,
  filterDirectory,
  followLink,
  placeFromAddress,
} from '../remoteSettings.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('masjid codes', () => {
  it('normalises codes and rejects unusable ones', () => {
    expect(normalizeCode(' tor-4k7q ')).toBe('TOR4K7Q');
    expect(normalizeCode('ab')).toBeNull();
    expect(normalizeCode('TOO-LONG-CODE-123456')).toBeNull(); // 17 characters
    expect(normalizeCode('bad/code')).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });

  it('reads the code from the address', () => {
    expect(codeFromSearch('?masjid=tor4k7q&perf')).toBe('TOR4K7Q');
    expect(codeFromSearch('?code=ABC123')).toBe('ABC123');
    expect(codeFromSearch('?perf')).toBeNull();
  });
});

describe('reading a sheet', () => {
  it('parses CSV with quotes, commas and line breaks', () => {
    const csv =
      '﻿"key","value"\r\nannouncements,"Line one\nLine ""two"", with comma"\r\nmasjidName,Al-Noor\n';
    expect(parseCsv(csv)).toEqual([
      ['key', 'value'],
      ['announcements', 'Line one\nLine "two", with comma'],
      ['masjidName', 'Al-Noor'],
    ]);
  });

  it('turns rows into settings, typed like the defaults', () => {
    const rows = [
      ['key', 'value'],
      ['# a comment', 'ignored'],
      ['masjidName', 'Masjid Al-Noor'],
      ['iqamahAutoCalc', 'FALSE'],
      ['iqamah.fajr', '25'],
      ['jumuah.1.time', '13:15'],
      ['jumuah.2.enabled', 'TRUE'],
      ['ecoMode', 'no'],
      ['eidDaysBefore', ''], // a cell Google blanked: ignored, not wiped
      ['notASetting', 'x'],
      ['screenLabel', 'Main hall'], // device setting: never from the sheet
      ['iqamah.fajr.extra', '1'],
      ['jumuah.20.time', '14:00'],
    ];
    const { settings, skipped } = sheetRowsToSettings(rows, DEFAULTS);
    expect(settings.masjidName).toBe('Masjid Al-Noor');
    expect(settings.iqamahAutoCalc).toBe(false);
    expect(settings.iqamah.fajr).toBe(25);
    expect(settings.iqamah.dhuhr).toBe(DEFAULTS.iqamah.dhuhr);
    expect(settings.jumuah[0].time).toBe('13:15');
    expect(settings.jumuah[1].enabled).toBe(true);
    expect(settings.ecoMode).toBe(false);
    expect('eidDaysBefore' in settings).toBe(false);
    expect('screenLabel' in settings).toBe(false);
    expect(skipped).toEqual(['notASetting', 'screenLabel', 'iqamah.fajr.extra', 'jumuah.20.time']);
  });

  it('accepts a whole list as JSON, and fills gaps in a list', () => {
    const { settings } = sheetRowsToSettings(
      [
        ['eidFitr', '[{"time":"08:00","enabled":true}]'],
        ['eidAdha', '[{"time":"08:30","enabled":true}]'],
        ['eidAdha.3.time', '10:00'], // slot 2 not given
      ],
      DEFAULTS
    );
    expect(settings.eidFitr).toEqual([{ time: '08:00', enabled: true }]);
    expect(settings.eidAdha).toHaveLength(3);
    expect(settings.eidAdha.every(Boolean)).toBe(true);
    expect(settings.eidAdha[1]).toEqual(DEFAULTS.eidAdha[0]);
    expect(settings.eidAdha[2].time).toBe('10:00');
  });

  it('round-trips the sheet template', () => {
    const csv = settingsToSheetCsv(DEFAULTS);
    expect(csv.startsWith('key,value,description\r\n')).toBe(true);
    // Each row explains itself; the app reads only key and value.
    expect(csv).toMatch(
      /\r\njumuah\.1\.enabled,(TRUE|FALSE),"Jumu'ah 1: TRUE to show, FALSE to hide"\r\n/
    );
    expect(csv).toMatch(/\r\niqamah\.fajr,\d+,Fajr iqamah: minutes after the adhan/);
    expect(csv).not.toContain('logoDataUrl');
    for (const key of DEVICE_KEYS) expect(csv).not.toContain(`${key},`);
    const { settings, skipped } = sheetRowsToSettings(parseCsv(csv), DEFAULTS);
    expect(skipped).toEqual([]);
    for (const [key, value] of Object.entries(settings)) {
      expect(value, key).toEqual(DEFAULTS[key]);
    }
  });
});

describe('merging shared settings', () => {
  const current = {
    ...DEFAULTS,
    screenLabel: "Women's section",
    viewingDistance: 6,
    masjidName: 'Old',
  };

  it('applies shared values but keeps device settings and unmentioned ones', () => {
    const r = mergeRemote(
      current,
      { masjidName: 'New', screenLabel: 'Lobby', fontScale: 110 },
      DEFAULTS
    );
    expect(r.ok).toBe(true);
    expect(r.value.masjidName).toBe('New');
    expect(r.value.fontScale).toBe(110);
    expect(r.value.screenLabel).toBe("Women's section");
    expect(r.value.viewingDistance).toBe(6);
    expect(r.value.method).toBe(current.method);
  });

  it('checks values like an imported file and accepts only image logos', () => {
    const r = mergeRemote(
      { ...current, logoDataUrl: 'data:image/png;base64,AAAA' },
      { hijriOffset: 99, logoDataUrl: 'javascript:alert(1)' },
      DEFAULTS
    );
    expect(r.value.hijriOffset).toBe(3); // clamped
    expect(r.value.logoDataUrl).toBe('data:image/png;base64,AAAA'); // kept
    expect(mergeRemote(current, 'nope', DEFAULTS).ok).toBe(false);
  });

  it('fingerprints settings regardless of key order', () => {
    expect(contentVersion({ a: 1, b: [1, 2] })).toBe(contentVersion({ b: [1, 2], a: 1 }));
    expect(contentVersion({ a: 1 })).not.toBe(contentVersion({ a: 2 }));
  });
});

describe('a link and the PIN', () => {
  const place = (o) => placeFromAddress({ pinSet: true, ...o });

  it("can't re-point a masjid screen (or a managing one) behind the PIN", () => {
    expect(place({ urlCode: 'XYZ789', savedCode: 'ABC234', savedMode: 'masjid' })).toEqual({
      code: 'ABC234',
      mode: 'masjid',
    });
    expect(place({ urlCode: 'XYZ789', savedCode: 'ABC234', savedMode: 'manage' })).toEqual({
      code: 'ABC234',
      mode: 'manage',
    });
    // The same code, or no PIN: as before.
    expect(place({ urlCode: 'ABC234', savedCode: 'ABC234', savedMode: 'masjid' }).code).toBe(
      'ABC234'
    );
    expect(
      placeFromAddress({
        urlCode: 'XYZ789',
        savedCode: 'ABC234',
        savedMode: 'masjid',
        pinSet: false,
      })
    ).toEqual({ code: 'XYZ789', mode: 'masjid' });
  });

  it('follows from a link on a new screen or a follower’s, and sets up a masjid screen', () => {
    expect(place({ urlCode: 'ABC234' })).toEqual({ code: 'ABC234', mode: 'follow' });
    expect(place({ urlCode: 'XYZ789', savedCode: 'ABC234', savedMode: 'follow' })).toEqual({
      code: 'XYZ789',
      mode: 'follow',
    });
    expect(place({ urlCode: 'ABC234', urlMode: 'masjid' })).toEqual({
      code: 'ABC234',
      mode: 'masjid',
    });
    expect(place({ savedCode: 'ABC234', savedMode: 'nonsense' })).toEqual({
      code: 'ABC234',
      mode: 'follow',
    });
  });
});

describe('addresses and the saved copy', () => {
  it('keeps a location once taken from a device only to about 1 km', () => {
    const storage = memoryStorage();
    saveSyncState(storage, {
      code: 'ABC234',
      settings: { lat: 43.467891, lng: -79.688123, locName: '43.47°N  79.69°W' },
    });
    expect(loadSyncState(storage, 'ABC234').settings).toMatchObject({ lat: 43.47, lng: -79.69 });
    saveSyncState(storage, {
      code: 'ABC234',
      settings: { lat: 43.6532, lng: -79.3832, locName: 'Toronto, Ontario, Canada' },
    });
    expect(loadSyncState(storage, 'ABC234').settings).toMatchObject({
      lat: 43.6532,
      lng: -79.3832,
    });
  });

  it('finds a code in masjids.json', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEF';
    const registry = {
      _note: 'x',
      TOR4K7Q: { sheetId: id, name: 'Al-Noor' },
      CSV1: { csvUrl: 'https://example.org/s.csv' },
    };
    expect(resolveSheet(registry, 'TOR4K7Q')).toEqual({ csvUrl: sheetCsvUrl(id), name: 'Al-Noor' });
    expect(resolveSheet(registry, 'CSV1').csvUrl).toBe('https://example.org/s.csv');
    expect(resolveSheet(registry, '_note')).toBeNull();
    expect(resolveSheet({ BAD: { sheetId: 'x' } }, 'BAD')).toBeNull();
    expect(sheetCsvUrl(id)).toBe(
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1`
    );
  });

  it('builds the Worker addresses', () => {
    expect(cloudflareUrls('https://s.example.org/', 'TOR4K7Q')).toEqual({
      state: 'https://s.example.org/m/TOR4K7Q',
      live: 'wss://s.example.org/m/TOR4K7Q/live',
      publish: 'https://s.example.org/m/TOR4K7Q/publish',
      origin: 'https://s.example.org',
    });
  });

  it('backs off reconnecting, up to five minutes', () => {
    expect(reconnectDelay(0)).toBe(5000);
    expect(reconnectDelay(2)).toBe(20000);
    expect(reconnectDelay(20)).toBe(300000);
  });

  it('keeps the last good copy per code', () => {
    const storage = memoryStorage();
    saveSyncState(storage, { code: 'TOR4K7Q', version: 'h1' });
    expect(loadSyncState(storage, 'TOR4K7Q').version).toBe('h1');
    expect(loadSyncState(storage, 'OTHER1')).toBeNull();
    expect(loadSyncState({ getItem: () => '{bad' }, 'TOR4K7Q')).toBeNull();
  });
});

describe('followers and masjid screens', () => {
  it("splits the masjid's settings from each screen's own", () => {
    for (const key of MASJID_KEYS) expect(key in DEFAULTS, key).toBe(true);
    for (const key of [
      'theme',
      'lang',
      'fontScale',
      'chimeAdhan',
      'blackoutEnabled',
      'tickerMode',
    ]) {
      expect(MASJID_KEYS).not.toContain(key);
    }
    for (const key of DEVICE_KEYS) expect(MASJID_KEYS).not.toContain(key);
    const shared = { masjidName: 'A', iqamah: { fajr: 20 }, theme: 'Royal Blue' };
    expect(sharedForMode(shared, 'follow')).toEqual({ masjidName: 'A', iqamah: { fajr: 20 } });
    expect(sharedForMode(shared, 'masjid')).toEqual(shared);
    // A managing screen takes another admin's copy in full too.
    expect(sharedForMode(shared, 'manage')).toEqual(shared);
    expect(pickKeys(shared, ['theme', 'missing'])).toEqual({ theme: 'Royal Blue' });
  });

  it('reads the masjid-screen setup link', () => {
    expect(modeFromSearch('?masjid=TOR4K7Q&screen=masjid')).toBe('masjid');
    expect(modeFromSearch('?masjid=TOR4K7Q')).toBeNull();
    expect(modeFromSearch('?screen=follow')).toBeNull(); // a link can't downgrade a masjid screen
  });

  it('asks for the PIN on masjid screens only', () => {
    expect(settingsNeedPin({ pinSet: true, code: 'TOR4K7Q', mode: 'follow' })).toBe(false);
    expect(settingsNeedPin({ pinSet: true, code: 'TOR4K7Q', mode: 'masjid' })).toBe(true);
    expect(settingsNeedPin({ pinSet: true, code: 'TOR4K7Q', mode: 'manage' })).toBe(true);
    expect(settingsNeedPin({ pinSet: true, code: null, mode: 'follow' })).toBe(true);
    expect(settingsNeedPin({ pinSet: false, code: 'TOR4K7Q', mode: 'masjid' })).toBe(false);
  });

  it('lists masjids to follow, and searches them', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEF';
    const registry = {
      _note: 'x',
      TOR4K7Q: { name: 'Masjid Al-Noor', city: 'Toronto', sheetId: id },
      OAK1: { name: 'Oakville Islamic Centre', city: 'Oakville' },
      HIDE1: { name: 'Hidden', sheetId: id, listed: false },
      bad: { name: 'Lower-case code' },
    };
    expect(directoryEntries(registry, 'cloudflare').map((e) => e.code)).toEqual([
      'TOR4K7Q',
      'OAK1',
    ]);
    expect(directoryEntries(registry, 'sheet').map((e) => e.code)).toEqual(['TOR4K7Q']); // needs a sheet
    const all = directoryEntries(registry, 'cloudflare');
    expect(filterDirectory(all, 'oakville').map((e) => e.code)).toEqual(['OAK1']);
    expect(filterDirectory(all, 'noor toronto').map((e) => e.code)).toEqual(['TOR4K7Q']);
    expect(filterDirectory(all, '')).toHaveLength(2);
    expect(directoryEntries(null, 'sheet')).toEqual([]);
  });

  it('builds the links to share', () => {
    const page = 'https://you.github.io/prayer-times-tv/?masjid=OLD1&perf#x';
    expect(followLink(page, 'TOR4K7Q')).toBe(
      'https://you.github.io/prayer-times-tv/?masjid=TOR4K7Q'
    );
    expect(followLink(page, 'TOR4K7Q', 'masjid')).toBe(
      'https://you.github.io/prayer-times-tv/?masjid=TOR4K7Q&screen=masjid'
    );
  });
});

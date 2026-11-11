// ── registrationSheetScript.test.js ──────────────────────────────────────
// docs/registration-sheet.gs — the clean-up script you paste into the
// registration sheet — run as Google Apps Script would run it: a plain
// JavaScript engine (no window, TextEncoder or atob) with Google's
// spreadsheet services, here stand-ins. And it's built from the current code.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { keyPairFromSeed, signUpdate, verifyUpdate } from '../signatures.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = fs.readFileSync(path.join(root, 'docs/registration-sheet.gs'), 'utf8');
const HEADER = [
  'Timestamp',
  'Masjid name',
  'City',
  'Masjid code',
  'Settings',
  'Publish key',
  'Approved',
];
const MASJID = keyPairFromSeed(new Uint8Array(32).fill(1));
const STRANGER = keyPairFromSeed(new Uint8Array(32).fill(2));

const row = (ts, code, pair, time, name, approved = false) => [
  new Date(ts),
  name,
  'Oakville',
  code,
  signUpdate({ code, time, settings: { masjidName: name } }, pair.secretKey),
  pair.publicKey,
  approved,
];

/** Google's services, just enough for the script: one sheet, a lock, triggers. */
function appsScript(values) {
  const data = values.map((r) => [...r]);
  const sheet = {
    data,
    maxRows: 1000,
    getDataRange: () => ({ getValues: () => data.map((r) => [...r]) }),
    getRange: (r, c) => ({
      setValue: (v) => {
        data[r - 1][c - 1] = v;
      },
      clearContent: () => data[r - 1].fill(''),
    }),
    deleteRow: (r) => {
      data.splice(r - 1, 1);
      sheet.maxRows--;
    },
    getMaxRows: () => sheet.maxRows,
    getFrozenRows: () => 1,
    getLastColumn: () => HEADER.length,
  };
  const toasts = [];
  const triggers = [];
  const menu = [];
  const services = {
    SpreadsheetApp: {
      getActive: () => ({ getSheets: () => [sheet], toast: (m) => toasts.push(m) }),
      getUi: () => {
        const ui = {
          createMenu: () => ui,
          addItem: (label, fn) => {
            menu.push(fn);
            return ui;
          },
          addToUi: () => {},
        };
        return ui;
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: () => {},
      newTrigger: (fn) => ({
        forSpreadsheet: () => ({
          onFormSubmit: () => ({
            create: () => triggers.push({ getHandlerFunction: () => fn }),
          }),
        }),
      }),
    },
  };
  const context = vm.createContext({ ...services });
  vm.runInContext(SCRIPT, context, { filename: 'registration-sheet.gs' });
  return { context, sheet, toasts, triggers, menu };
}

describe('the registration sheet clean-up script', () => {
  it('runs without browser features (as in Apps Script)', () => {
    const { context } = appsScript([HEADER]);
    for (const name of ['window', 'self', 'TextEncoder', 'atob', 'btoa', 'require', 'module']) {
      expect(vm.runInContext(`typeof ${name}`, context)).toBe('undefined');
    }
    expect(vm.runInContext('typeof MasjidSheet.plan', context)).toBe('function');
  });

  it('keeps one ticked row per masjid with its newest signed settings', () => {
    const { context, sheet, toasts } = appsScript([
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
      row('2026-11-02T10:00Z', 'ABC234', MASJID, 2, 'Published once'),
      row('2026-11-03T10:00Z', 'ABC234', MASJID, 3, 'Published twice'),
      row('2026-11-04T10:00Z', 'ABC234', STRANGER, 9, 'Not theirs'),
      [new Date('2026-11-05T10:00Z'), 'NAME', 'CITY', 'CODE', 'SETTINGS', 'KEY', false],
    ]);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data).toHaveLength(3);
    const [, kept, request] = sheet.data;
    expect(kept[6]).toBe(true);
    expect(kept[1]).toBe('Published twice');
    expect(verifyUpdate(kept[4], kept[5], 'ABC234').settings.masjidName).toBe('Published twice');
    expect(request[1]).toBe('Not theirs');
    expect(toasts[0]).toBe(
      '1 approved masjid(s), 0 waiting for approval, 1 new request(s) to check; 3 row(s) removed.'
    );
  });

  it('installs the after-each-response trigger and the menu', () => {
    const { context, triggers, menu } = appsScript([HEADER]);
    vm.runInContext('onOpen(); installAutoTidy(); installAutoTidy();', context);
    expect(menu).toEqual(['tidyNow', 'installAutoTidy']);
    expect(triggers.map((t) => t.getHandlerFunction())).toContain('tidyAfterResponse');
  });

  it("leaves a sheet that isn't the registration sheet alone", () => {
    const { context, sheet, toasts } = appsScript([
      ['key', 'value'],
      ['masjidName', 'X'],
    ]);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data).toHaveLength(2);
    expect(toasts[0]).toMatch(/^Nothing changed/);
  });

  it('is built from the current code', () => {
    const out = execFileSync(process.execPath, ['scripts/build-sheet-script.mjs', '--check'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(out).toMatch(/is current/);
  }, 60_000);
});

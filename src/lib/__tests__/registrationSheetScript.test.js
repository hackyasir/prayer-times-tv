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

const SERVER_ERROR = "We're sorry, a server error occurred. Please wait a bit and try again.";

/**
 * Google's services, just enough for the script: one sheet, a lock,
 * triggers. `faults` makes calls fail as Google's servers sometimes do:
 *   create: { tidyDaily: { times, after?, message? } }  that trigger's
 *     create() throws `times` times (with `after`, once it has created it)
 *   deleteRow: n  deleteRow() throws n times, after deleting the row
 */
function appsScript(values, faults = {}) {
  const data = values.map((r) => [...r]);
  let deleteFaults = faults.deleteRow || 0;
  const sheet = {
    data,
    maxRows: 1000,
    getDataRange: () => ({ getValues: () => data.map((r) => [...r]) }),
    getRange: (r, c, rows = 1, cols = 1) => ({
      setValue: (v) => {
        data[r - 1][c - 1] = v;
      },
      getValues: () => {
        faults.beforeRead?.(data);
        faults.beforeRead = null;
        return data.slice(r - 1, r - 1 + rows).map((row) => row.slice(c - 1, c - 1 + cols));
      },
      clearContent: () => data[r - 1].fill(''),
    }),
    deleteRow: (r) => {
      data.splice(r - 1, 1);
      sheet.maxRows--;
      if (deleteFaults > 0) {
        deleteFaults--;
        throw new Error(SERVER_ERROR);
      }
    },
    getMaxRows: () => sheet.maxRows,
    getFrozenRows: () => 1,
    getLastColumn: () => HEADER.length,
  };
  const toasts = [];
  const triggers = [];
  const menu = [];
  const sleeps = [];
  const logged = [];
  const services = {
    Utilities: {
      sleep: (ms) => sleeps.push(ms),
      getUuid: () => 'abcd1234-0000-4000-8000-000000000000',
    },
    console: { error: (...args) => logged.push(args.join(' ')) },
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
      getProjectTriggers: () => [...triggers],
      deleteTrigger: (trigger) => triggers.splice(triggers.indexOf(trigger), 1),
      newTrigger: (fn) => {
        const create = () => {
          const fault = faults.create?.[fn];
          if (fault?.times > 0) {
            fault.times--;
            if (fault.after) triggers.push({ getHandlerFunction: () => fn });
            throw new Error(fault.message || SERVER_ERROR);
          }
          triggers.push({ getHandlerFunction: () => fn });
        };
        return {
          forSpreadsheet: () => ({ onFormSubmit: () => ({ create }) }),
          timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create }) }) }),
        };
      },
    },
  };
  const context = vm.createContext({ ...services });
  // Rows waiting for approval expire: a fixed "now" keeps these tests stable.
  vm.runInContext(`Date.now = () => ${Date.parse('2026-11-10T12:00Z')};`, context);
  vm.runInContext(SCRIPT, context, { filename: 'registration-sheet.gs' });
  return { context, sheet, toasts, triggers, menu, sleeps, logged };
}

// The script checks signatures with tweetnacl's smaller, slower build (each
// test here takes up to about a second alone), so allow for a busy machine.
describe('the registration sheet clean-up script', { timeout: 20_000 }, () => {
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

  it('stops, rather than change the wrong row, if the sheet changes meanwhile', () => {
    const junk = (n) => [
      new Date(`2026-11-0${n}T10:00Z`),
      `Junk ${n}`,
      '',
      'ABC234',
      'x',
      'y',
      false,
    ];
    const { context, sheet, toasts } = appsScript(
      [HEADER, row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true), junk(2), junk(3)],
      // Someone inserts a row at the top just as the first row is checked.
      { beforeRead: (data) => data.splice(1, 0, junk(4)) }
    );
    vm.runInContext('tidyNow()', context);
    expect(sheet.data.map((r) => r[1])).toEqual([
      'Masjid name',
      'Junk 4',
      'Registered',
      'Junk 2',
      'Junk 3',
    ]);
    expect(toasts[0]).toMatch(/changed while it was being tidied/);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data.map((r) => r[1])).toEqual(['Masjid name', 'Registered']);
  });

  it('writes a merged name that looks like a formula as text', () => {
    const { context, sheet } = appsScript([
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
      row('2026-11-02T10:00Z', 'ABC234', MASJID, 2, '=HYPERLINK("x")'),
    ]);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data[1][1]).toBe('\'=HYPERLINK("x")');
  });

  it('unticks a response that arrives in a row ticked by mistake', () => {
    // You ticked an empty row; someone's registration for your masjid's
    // code, under their own key, then went into it.
    const theirs = row('2026-11-02T10:00Z', 'ABC234', STRANGER, 9, 'Not theirs', true);
    const { context, sheet } = appsScript([
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
      theirs,
    ]);
    context.response = {
      namedValues: { 'Masjid code': ['ABC234'], Settings: [theirs[4]], 'Publish key': [theirs[5]] },
    };
    vm.runInContext('tidyAfterResponse(response)', context);
    expect(sheet.data.map((r) => [r[1], r[6]])).toEqual([
      ['Masjid name', 'Approved'],
      ['Registered', true],
      ['Not theirs', false], // now just a request, for you to check
    ]);
  });

  it('unticks an empty row, and leaves empty checkbox rows alone', () => {
    const { context, sheet, toasts } = appsScript([
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
      ['', '', '', '', '', '', true],
      ['', '', '', '', '', '', false],
    ]);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data).toHaveLength(4);
    expect(sheet.data.map((r) => r[6])).toEqual(['Approved', true, false, false]);
    expect(toasts[0]).toMatch(/0 row\(s\) removed\. 1 empty row\(s\) unticked\.$/);
  });

  it('removes a copy of a ticked row, keeping the tick', () => {
    const ticked = row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true);
    const { context, sheet, toasts } = appsScript([HEADER, ticked, [...ticked]]);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data).toHaveLength(2);
    expect(sheet.data[1][6]).toBe(true);
    expect(toasts[0]).toMatch(/1 row\(s\) removed\.$/);
  });

  it('leaves a ticked row that no longer verifies, and says so', () => {
    const ticked = row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true);
    ticked[4] = ticked[4].replace('Registered', 'Edited by hand');
    const { context, sheet, toasts } = appsScript([HEADER, ticked]);
    vm.runInContext('tidyNow()', context);
    expect(sheet.data).toHaveLength(2);
    expect(sheet.data[1][6]).toBe(true);
    expect(toasts[0]).toMatch(/1 ticked row\(s\) aren't validly signed .*left as they are\.$/);
  });

  it('removes a row nested too deep to read instead of failing', () => {
    const deep = `{"v":1,"code":"ABC234","time":1,"sig":"${'A'.repeat(86)}","settings":{"x":${'['.repeat(5000)}${']'.repeat(5000)}}}`;
    const { context, sheet } = appsScript([
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
      [new Date('2026-11-02T10:00Z'), 'x', 'y', 'ABC234', deep, MASJID.publicKey, false],
    ]);
    expect(() => vm.runInContext('tidyNow()', context)).not.toThrow();
    expect(sheet.data).toHaveLength(2);
    expect(sheet.data[1][1]).toBe('Registered');
  });

  it('installs the after-each-response and daily triggers (once each) and the menu', () => {
    const { context, triggers, menu } = appsScript([HEADER]);
    vm.runInContext('onOpen(); installAutoTidy(); installAutoTidy();', context);
    expect(menu).toEqual(['tidyNow', 'installAutoTidy']);
    expect(triggers.map((t) => t.getHandlerFunction()).sort()).toEqual([
      'tidyAfterResponse',
      'tidyDaily',
    ]);
  });

  it('tries again after a passing server error, and never adds a trigger twice', () => {
    // Google created the trigger but still reported an error.
    const { context, triggers, sleeps, toasts } = appsScript([HEADER], {
      create: { tidyDaily: { times: 1, after: true } },
    });
    vm.runInContext('installAutoTidy()', context);
    expect(triggers.map((t) => t.getHandlerFunction()).sort()).toEqual([
      'tidyAfterResponse',
      'tidyDaily',
    ]);
    expect(sleeps).toHaveLength(1);
    expect(toasts.at(-1)).toMatch(/^0 approved masjid/);
  });

  it('says which step failed, with a reference, when Google keeps failing', () => {
    const { context, triggers, sleeps, toasts, logged } = appsScript([HEADER], {
      create: { tidyDaily: { times: 99 } },
    });
    const result = vm.runInContext('installAutoTidy()', context);
    expect(result).toMatchObject({ ok: false, ref: 'abcd1234' });
    expect(sleeps).toHaveLength(2); // three tries
    expect(toasts).toEqual([
      "Couldn't set up the daily tidy. Wait a minute and try again (ref abcd1234).",
    ]);
    expect(logged[0]).toMatch(/ref abcd1234.*server error/);
    // The response trigger is in place; running it again adds only the daily one.
    expect(triggers.map((t) => t.getHandlerFunction())).toEqual(['tidyAfterResponse']);
  });

  it("doesn't retry an error that isn't a passing one", () => {
    const { context, sleeps, toasts } = appsScript([HEADER], {
      create: { tidyDaily: { times: 1, message: 'You do not have permission' } },
    });
    vm.runInContext('installAutoTidy()', context);
    expect(sleeps).toHaveLength(0);
    expect(toasts[0]).toMatch(/^Couldn't set up the daily tidy/);
  });

  it('repeats a tidy that failed partway without removing any extra rows', () => {
    const { context, sheet, sleeps } = appsScript(
      [
        HEADER,
        row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
        row('2026-11-02T10:00Z', 'ABC234', MASJID, 2, 'Published once'),
        row('2026-11-03T10:00Z', 'ABC234', MASJID, 3, 'Published twice'),
        row('2026-11-04T10:00Z', 'ABC234', STRANGER, 9, 'Not theirs'),
        [new Date('2026-11-05T10:00Z'), 'NAME', 'CITY', 'CODE', 'SETTINGS', 'KEY', false],
      ],
      { deleteRow: 1 }
    );
    vm.runInContext('tidyNow()', context);
    expect(sleeps).toHaveLength(1);
    expect(sheet.data.map((r) => r[1])).toEqual(['Masjid name', 'Published twice', 'Not theirs']);
    expect(sheet.data[1][6]).toBe(true);
  });

  it('after a response tidies only that masjid; the daily run tidies the rest', () => {
    const { context, sheet } = appsScript([
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
      row('2026-11-02T10:00Z', 'ABC234', MASJID, 2, 'Published'),
      row('2026-11-01T10:00Z', 'XYZ789', MASJID, 1, 'Other v1'),
      row('2026-11-02T10:00Z', 'XYZ789', MASJID, 2, 'Other v2'),
      [new Date('2026-11-03T10:00Z'), 'NAME', 'CITY', 'CODE', 'SETTINGS', 'KEY', false],
    ]);
    const names = () => sheet.data.map((r) => r[1]);

    context.response = { namedValues: { Timestamp: ['x'], 'Masjid code': ['abc-234'] } };
    vm.runInContext('tidyAfterResponse(response)', context);
    expect(names()).toEqual(['Masjid name', 'Published', 'Other v1', 'Other v2', 'NAME']);

    // A response without a usable code changes nothing until the daily run.
    context.response = { namedValues: { 'Masjid code': ['not a code!'] } };
    vm.runInContext('tidyAfterResponse(response)', context);
    expect(sheet.data).toHaveLength(5);

    vm.runInContext('tidyDaily()', context);
    expect(names()).toEqual(['Masjid name', 'Published', 'Other v2']);
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

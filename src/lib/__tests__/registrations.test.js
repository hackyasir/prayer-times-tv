// ── registrations.test.js ────────────────────────────────────────────────
// Self-serve masjids in the shared registration sheet: new codes, the
// pre-filled form, reading the responses sheet (columns, queries, the
// approved key, the newest signed update), and the published list.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CODE_ALPHABET,
  KEY_RE,
  MAX_CHECKS_PER_MASJID,
  MAX_WAITING_KEYS,
  WAITING_DAYS,
  isSharedCode,
  keyFingerprint,
  approvalsQuery,
  approvedKey,
  buildDirectory,
  cityFromLocName,
  codeTakenQuery,
  columnLetter,
  formBody,
  mosqueInfoFromRows,
  newMasjidCode,
  newestUpdate,
  parseFormTemplate,
  passphraseProblem,
  sharedMasjids,
  sheetColumns,
  tidyPlan,
  updatesQuery,
} from '../registrations.js';
import { keyPairFromSeed, signUpdate, verifyUpdate } from '../signatures.js';
import { parseCsv, sheetIdFrom } from '../sheetFormat.js';
import { describeSetting } from '../settingDescriptions.js';

const HEADER = [
  'Timestamp',
  'Masjid name',
  'City',
  'Masjid code',
  'Settings',
  'Publish key',
  'Approved',
];
const TEMPLATE =
  'https://docs.google.com/forms/d/e/1FAIpQLSf-Example/viewform?usp=pp_url' +
  '&entry.101=NAME&entry.102=CITY&entry.103=CODE&entry.104=SETTINGS&entry.105=KEY';

const seed = (n) => new Uint8Array(32).fill(n);
const MASJID = keyPairFromSeed(seed(1));
const STRANGER = keyPairFromSeed(seed(2));
/** A cell anyone could send: 10 KB of arrays nested 5,000 deep. */
const deepCell = (code) =>
  `{"v":1,"code":"${code}","time":1,"sig":"${'A'.repeat(86)}","settings":{"x":${'['.repeat(5000)}${']'.repeat(5000)}}}`;

describe('new codes and passphrases', () => {
  it('makes easy-to-read codes that Google Sheets keeps as text', () => {
    const fixed = (values) => () => Uint32Array.from(values);
    expect(newMasjidCode(fixed([0, 0, 1, 2, 3, 4]))).toBe('A23456');
    // 4 would be "E" among the first letters; E is skipped (2E5 reads as a number).
    expect(newMasjidCode(fixed([4, 0, 0, 0, 0, 0]))[0]).toBe('F');
    for (let i = 0; i < 200; i++) {
      const code = newMasjidCode();
      expect(code).toMatch(/^[A-DF-HJ-NP-Z][2-9A-HJ-NP-Z]{5}$/);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('asks for a long passphrase, typed the same twice', () => {
    expect(passphraseProblem('short one')).toBe('short');
    expect(passphraseProblem('long enough words', 'long enough wordz')).toBe('mismatch');
    expect(passphraseProblem('long enough words', 'long enough words')).toBeNull();
    expect(passphraseProblem('long enough words')).toBeNull();
  });

  it("refuses a new passphrase that's easy to guess, but not one typed to publish", () => {
    const avoid = { avoid: ['Masjid Al-Noor', 'Oakville, Ontario'] };
    const choose = (p) => passphraseProblem(p, p, avoid);
    expect(choose('AlNoorMasjid2026')).toBe('weak');
    expect(choose('oakville oakville')).toBe('weak');
    expect(choose('aaaaaaaaaaaaaa')).toBe('weak');
    expect(choose('121212121212')).toBe('weak');
    expect(choose('olive lantern river stone')).toBeNull();
    expect(choose('Al-Noor olive lantern river')).toBeNull();
    // Typing an existing passphrase (to publish): only the length counts.
    expect(passphraseProblem('AlNoorMasjid2026')).toBeNull();
  });

  it("shows the start of a publish key, for the sheet's owner to check", () => {
    const body = MASJID.publicKey.slice(8, 24);
    expect(keyFingerprint(MASJID.publicKey)).toBe(
      `ed25519:${body.slice(0, 4)} ${body.slice(4, 8)} ${body.slice(8, 12)} ${body.slice(12)}`
    );
    expect(keyFingerprint('not a key')).toBe('');
  });
});

describe('the registration form', () => {
  it('reads the pre-filled link: where to send, and which field takes what', () => {
    expect(parseFormTemplate(TEMPLATE)).toEqual({
      action: 'https://docs.google.com/forms/d/e/1FAIpQLSf-Example/formResponse',
      fields: {
        name: 'entry.101',
        city: 'entry.102',
        code: 'entry.103',
        settings: 'entry.104',
        key: 'entry.105',
      },
    });
    // Without the signed settings or the key, it can't be used.
    expect(parseFormTemplate(TEMPLATE.replace('&entry.105=KEY', ''))).toBeNull();
    expect(parseFormTemplate(TEMPLATE.replace('https:', 'http:'))).toBeNull();
    expect(parseFormTemplate(TEMPLATE.replace('docs.google.com', 'docs.example.org'))).toBeNull();
    expect(parseFormTemplate('not a link')).toBeNull();
    // Answers typed in lower case still count.
    expect(
      parseFormTemplate(TEMPLATE.toLowerCase().replace('1faipqlsf-example', 'X'))
    ).not.toBeNull();
  });

  it('takes the sheet as its ID or as a whole link', () => {
    const id = '1KbjKqNbVeXBIxNKKqabRSua-LsLUSGVTODA_Oly8HkE';
    expect(sheetIdFrom(id)).toBe(id);
    expect(sheetIdFrom(` https://docs.google.com/spreadsheets/d/${id}/edit?gid=0#gid=0 `)).toBe(id);
    expect(sheetIdFrom('https://example.org/not-a-sheet')).toBe('');
    expect(sheetIdFrom(undefined)).toBe('');
  });

  it('builds the answers to send', () => {
    const body = formBody(parseFormTemplate(TEMPLATE), {
      name: 'Al-Noor',
      code: 'ABC234',
      settings: '{"v":1}',
      key: MASJID.publicKey,
    });
    expect(body.get('entry.101')).toBe('Al-Noor');
    expect(body.get('entry.102')).toBe('');
    expect(body.get('entry.103')).toBe('ABC234');
    expect(body.get('entry.104')).toBe('{"v":1}');
    expect(body.get('entry.105')).toBe(MASJID.publicKey);
  });
});

describe('the responses sheet', () => {
  const cols = sheetColumns(HEADER);

  it('finds the columns by their titles', () => {
    expect(cols).toMatchObject({
      timestamp: 'A',
      name: 'B',
      city: 'C',
      code: 'D',
      settings: 'E',
      key: 'F',
      approved: 'G',
      ready: true,
    });
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    // Approved can come later; without Settings the sheet isn't usable.
    expect(sheetColumns(HEADER.slice(0, 6))).toMatchObject({ approved: null, ready: true });
    expect(sheetColumns(['Timestamp', 'Masjid code']).ready).toBe(false);
  });

  it('asks only for one masjid’s rows, and never puts unchecked text in a query', () => {
    expect(approvalsQuery(cols, 'abc234')).toBe("select F, G where D = 'ABC234' order by A desc");
    expect(updatesQuery(cols, 'ABC234', MASJID.publicKey)).toBe(
      `select E where D = 'ABC234' and F = '${MASJID.publicKey}' order by A desc limit 10`
    );
    expect(codeTakenQuery(cols, 'ABC234')).toBe("select D where D = 'ABC234' limit 1");
    expect(updatesQuery(cols, "x' or 1=1", "k' or '1'='1")).toBe(
      "select E where D = '-' and F = 'none' order by A desc limit 10"
    );
  });

  it('trusts the key on the newest approved row', () => {
    const newer = keyPairFromSeed(seed(3)).publicKey;
    expect(
      approvedKey([
        [STRANGER.publicKey, 'FALSE'],
        [newer, 'TRUE'],
        [MASJID.publicKey, 'TRUE'],
      ])
    ).toBe(newer);
    expect(approvedKey([[MASJID.publicKey, 'FALSE']])).toBeNull();
    expect(approvedKey([['not a key', 'TRUE']])).toBeNull();
    expect(KEY_RE.test(MASJID.publicKey)).toBe(true);
  });

  it('picks the newest update that verifies, ignoring the rest', () => {
    const at = (time, name, pair = MASJID, code = 'ABC234') =>
      signUpdate({ code, time, settings: { masjidName: name } }, pair.secretKey);
    const texts = [
      at(3000, 'Stranger', STRANGER), // newer, but not the masjid's key
      at(2500, 'Other masjid', MASJID, 'ZZZ999'), // replayed under another code
      at(2000, 'Newest'),
      at(1000, 'Oldest'),
      'garbage',
    ];
    const best = newestUpdate(texts, MASJID.publicKey, 'ABC234', verifyUpdate);
    expect(best).toMatchObject({ time: 2000, settings: { masjidName: 'Newest' } });
    expect(newestUpdate(['garbage'], MASJID.publicKey, 'ABC234', verifyUpdate)).toBeNull();
  });

  it("isn't stopped by a row it can't read", () => {
    const good = signUpdate(
      { code: 'ABC234', time: 1, settings: { masjidName: 'Al-Noor' } },
      MASJID.secretKey
    );
    const texts = [deepCell('ABC234'), good];
    expect(newestUpdate(texts, MASJID.publicKey, 'ABC234', verifyUpdate)).toMatchObject({
      settings: { masjidName: 'Al-Noor' },
    });
    const throws = (text, key, code) => {
      if (text === 'boom') throw new Error('unreadable');
      return verifyUpdate(text, key, code);
    };
    expect(newestUpdate(['boom', good], MASJID.publicKey, 'ABC234', throws)).toMatchObject({
      time: 1,
    });
  });
});

describe('the published list', () => {
  const row = (ts, code, pair, settings, approved, name = 'Form name', city = 'Form city') => [
    ts,
    name,
    city,
    code,
    signUpdate({ code, time: Date.parse(ts), settings }, pair.secretKey),
    pair.publicKey,
    approved ? 'TRUE' : 'FALSE',
  ];

  it('lists approved masjids under the name and city in their newest signed settings', () => {
    const rows = [
      HEADER,
      row('2026-11-01', 'ABC234', MASJID, { masjidName: 'Al-Noor' }, true),
      row(
        '2026-11-05',
        'ABC234',
        MASJID,
        { masjidName: 'Masjid Al-Noor', locName: 'Oakville, Ontario, Canada' },
        false
      ),
      row('2026-11-06', 'ABC234', STRANGER, { masjidName: 'Hijacked' }, false),
      row('2026-11-02', 'WAKT22', STRANGER, { masjidName: 'Not approved' }, false),
    ];
    expect(sharedMasjids(rows, verifyUpdate)).toEqual([
      { code: 'ABC234', name: 'Masjid Al-Noor', city: 'Oakville, Ontario' },
    ]);
    expect(sharedMasjids([HEADER], verifyUpdate)).toEqual([]);
  });

  it('still lists the masjid when someone sends it a row nested too deep to read', () => {
    const rows = [
      HEADER,
      row('2026-11-01', 'ABC234', MASJID, { masjidName: 'Al-Noor' }, true),
      ['2026-11-02', 'x', 'y', 'ABC234', deepCell('ABC234'), MASJID.publicKey, 'FALSE'],
    ];
    expect(sharedMasjids(rows, verifyUpdate)).toEqual([
      { code: 'ABC234', name: 'Al-Noor', city: 'Form city' },
    ]);
  });

  it('puts your own entries first; a code you list with its own sheet keeps it', () => {
    const registry = {
      _note: 'notes stay',
      TEST01: { name: 'Test Masjid', sheetId: '1KbjKqNbVeXBIxNKKqabRSua-LsLUSGVTODA_Oly8HkE' },
      HIDE22: { listed: false },
    };
    const info = new Map([
      [registry.TEST01.sheetId, { masjidName: 'Noor-Ul-Haram', locName: 'Oakville, Ontario' }],
    ]);
    const {
      registry: out,
      added,
      skipped,
    } = buildDirectory(
      registry,
      [
        { code: 'ABC234', name: 'Al-Noor', city: 'Toronto, Ontario' },
        { code: 'TEST01', name: 'Clash', city: '' },
        { code: 'HIDE22', name: 'Hidden', city: 'X' },
      ],
      info
    );
    expect(out._note).toBe('notes stay');
    expect(out.TEST01).toMatchObject({ name: 'Noor-Ul-Haram', city: 'Oakville, Ontario' });
    expect(out.ABC234).toEqual({ name: 'Al-Noor', city: 'Toronto, Ontario', shared: true });
    expect(out.HIDE22).toEqual({ listed: false, name: 'Hidden', city: 'X', shared: true });
    expect(added).toEqual(['ABC234', 'HIDE22']);
    expect(skipped).toHaveLength(1);
  });

  it("reads a masjid's own name and location from its sheet", () => {
    const rows = parseCsv(
      'key,value,description\nmasjidName,Noor-Ul-Haram,x\nlocName,"Oakville, Ontario, Canada",y\n'
    );
    expect(mosqueInfoFromRows(rows)).toEqual({
      masjidName: 'Noor-Ul-Haram',
      locName: 'Oakville, Ontario, Canada',
    });
    expect(cityFromLocName('Oakville, Ontario, Canada')).toBe('Oakville, Ontario');
    expect(cityFromLocName('43.467°N 79.688°W')).toBe('');
  });
});

describe('tidying the sheet: one row per masjid', () => {
  // Rows waiting for approval expire, so "now" is fixed for these tests.
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T12:00Z') }));
  afterEach(() => vi.useRealTimers());

  const OLD = keyPairFromSeed(seed(4));
  const NEW = keyPairFromSeed(seed(5));
  const OTHER = keyPairFromSeed(seed(6));
  const row = (ts, code, pair, time, name, approved = false) => [
    new Date(ts),
    name,
    'City',
    code,
    signUpdate({ code, time, settings: { masjidName: name } }, pair.secretKey),
    pair.publicKey,
    approved,
  ];
  const apply = (rows, plan) => {
    const next = rows.map((r) => [...r]);
    for (const u of plan.updates) for (const [col, value] of u.cells) next[u.row][col] = value;
    for (const d of plan.deletes) next.splice(d, 1); // highest first
    return next;
  };
  const sheet = () => [
    HEADER,
    row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true), // 1: approved
    row('2026-11-03T10:00Z', 'ABC234', MASJID, 3, 'Newest'), // 2
    row('2026-11-02T10:00Z', 'ABC234', MASJID, 2, 'Middle'), // 3
    row('2026-10-30T10:00Z', 'ABC234', OTHER, 1, 'Before approval'), // 4
    row('2026-11-05T10:00Z', 'ABC234', STRANGER, 9, 'Request'), // 5
    [new Date('2026-11-06T10:00Z'), 'x', 'y', 'ABC234', '{"v":1}', MASJID.publicKey, false], // 6: junk
    [new Date('2026-11-06T11:00Z'), 'NAME', 'CITY', 'CODE', 'SETTINGS', 'KEY', false], // 7: a test row
    row('2026-11-01T10:00Z', 'WAKT22', MASJID, 1, 'Waiting v1'), // 8
    row('2026-11-02T10:00Z', 'WAKT22', MASJID, 2, 'Waiting v2'), // 9
    row('2026-11-01T10:00Z', 'RER234', OLD, 1, 'Old key', true), // 10
    row('2026-11-04T10:00Z', 'RER234', NEW, 5, 'New key', true), // 11: re-approved
    row('2026-11-05T10:00Z', 'RER234', OLD, 6, 'Old key, later'), // 12
  ];

  it('keeps the approved row, ticked, with the newest signed settings in it', () => {
    const plan = tidyPlan(sheet(), verifyUpdate);
    expect(plan.ok).toBe(true);
    expect(plan.deletes).toEqual([12, 8, 7, 6, 4, 3, 2]);
    expect(plan.summary).toMatchObject({
      approved: 2,
      merged: 1,
      pending: 1,
      waiting: 1,
      removed: 7,
      unverified: 0,
    });
    const after = apply(sheet(), plan);
    const abc = after.filter((r) => r[3] === 'ABC234');
    expect(abc).toHaveLength(2);
    const [kept, request] = abc;
    expect(kept[6]).toBe(true);
    expect(kept[1]).toBe('Newest');
    // Merging copies the settings, name and city, never the Timestamp.
    expect(kept[0]).toEqual(new Date('2026-11-01T10:00Z'));
    expect(verifyUpdate(kept[4], kept[5], 'ABC234').settings.masjidName).toBe('Newest');
    expect(request[1]).toBe('Request');
    expect(after.filter((r) => r[3] === 'WAKT22').map((r) => r[1])).toEqual(['Waiting v2']);
    // After a re-approval both ticked rows stay (ticks are only ever yours to
    // remove); screens use the newer one's key.
    expect(after.filter((r) => r[3] === 'RER234').map((r) => r[1])).toEqual(['Old key', 'New key']);
    // What screens read still works: the approved key, and its newest update.
    expect(approvedKey(abc.map((r) => [r[5], r[6]]).reverse())).toBe(MASJID.publicKey);
  });

  it('removes a row nested too deep to read, and tidies the rest as usual', () => {
    const deep = [
      new Date('2026-11-07T10:00Z'),
      'x',
      'y',
      'ABC234',
      deepCell('ABC234'),
      MASJID.publicKey,
      false,
    ];
    const plan = tidyPlan([...sheet(), deep], verifyUpdate);
    expect(plan.ok).toBe(true);
    expect(plan.deletes).toEqual([13, 12, 8, 7, 6, 4, 3, 2]);
  });

  it('with `only`, tidies just that masjid and leaves the others as they are', () => {
    const full = tidyPlan(sheet(), verifyUpdate);
    const one = tidyPlan(sheet(), verifyUpdate, { only: 'abc-234' });
    expect(one.deletes).toEqual([6, 4, 3, 2]);
    expect(one.updates).toEqual(full.updates.filter((u) => u.row === 1));
    expect(one.summary).toMatchObject({ approved: 1, pending: 1, waiting: 0 });
    expect(tidyPlan(sheet(), verifyUpdate, { only: 'not a code!' })).toMatchObject({
      ok: true,
      updates: [],
      deletes: [],
    });
  });

  it('never removes a ticked row, even one that no longer verifies', () => {
    const edited = (r) => {
      const copy = [...r];
      copy[4] = copy[4].replace('"masjidName":"', '"masjidName":"Edited ');
      return copy;
    };
    // Ticked and edited by hand, with a newer signed update under its key:
    // the update is copied in, which repairs it.
    const repaired = tidyPlan(
      [
        HEADER,
        edited(row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true)),
        row('2026-11-02T10:00Z', 'ABC234', MASJID, 2, 'Published'),
      ],
      verifyUpdate
    );
    expect(repaired.deletes).toEqual([2]);
    expect(repaired.updates).toHaveLength(1);
    expect(repaired.summary).toMatchObject({ approved: 1, merged: 1, unverified: 0 });
    // Ticked and edited, with nothing to repair it from, or with no usable
    // code: left as it is, and counted.
    const left = tidyPlan(
      [
        HEADER,
        edited(row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true)),
        [new Date('2026-11-02T10:00Z'), 'NAME', 'CITY', 'CODE', 'SETTINGS', 'KEY', true],
      ],
      verifyUpdate
    );
    expect(left.deletes).toEqual([]);
    expect(left.updates).toEqual([]);
    expect(left.summary).toMatchObject({ unverified: 2 });
  });

  it('leaves empty rows alone, checkboxes and all, and clears a tick on one', () => {
    const empty = (approved) => ['', '', '', '', '', '', approved];
    const plan = tidyPlan(
      [
        HEADER,
        row('2026-11-01T10:00Z', 'ABC234', MASJID, 1, 'Registered', true),
        empty(true),
        empty(false),
        empty(''),
      ],
      verifyUpdate
    );
    expect(plan.deletes).toEqual([]);
    expect(plan.updates).toEqual([{ row: 2, cells: [[6, false]] }]);
    expect(plan.summary).toMatchObject({ approved: 1, cleared: 1, unverified: 0, removed: 0 });
    // Only for that masjid (after a response): empty rows aren't looked at.
    // After a response too (only that masjid): a tick on an empty row is
    // cleared every time.
    const one = tidyPlan([HEADER, empty(true)], verifyUpdate, { only: 'ABC234' });
    expect(one.updates).toEqual([{ row: 1, cells: [[6, false]] }]);
  });

  it('lets a key ticked later outrank the old one, even after the old key publishes', () => {
    const apply2 = (rows) => apply(rows, tidyPlan(rows, verifyUpdate));
    const keyOf = (r) => (r[5] === OLD.publicKey ? 'old' : 'new');
    // A: old key, ticked. B: a re-registration under a new key. C: the old
    // key publishes after it.
    let rows = [
      HEADER,
      row('2026-11-01T10:00Z', 'ABC234', OLD, 1, 'A', true),
      row('2026-11-02T10:00Z', 'ABC234', NEW, 2, 'B'),
      row('2026-11-03T10:00Z', 'ABC234', OLD, 3, 'C'),
    ];
    rows = apply2(apply2(rows));
    expect(rows.slice(1).map(keyOf)).toEqual(['old', 'new']); // the request stays
    rows[2][6] = true; // you tick it
    rows = apply2(rows);
    const newestFirst = rows.slice(1).sort((a, b) => b[0] - a[0]);
    expect(approvedKey(newestFirst.map((r) => [r[5], r[6]]))).toBe(NEW.publicKey);
  });

  it('removes rows whose code this app never makes, and old waiting rows', () => {
    expect(['K7Q4TR', 'k7q4tr', '123456', 'E7Q4TR', 'K7Q4TO'].map(isSharedCode)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    const signedFor = (ts, code, name) => row(ts, code, STRANGER, 1, name);
    const plan = tidyPlan(
      [
        HEADER,
        signedFor('2026-11-09T10:00Z', '123456', 'Digits only'),
        signedFor('2026-11-09T10:00Z', 'abc234', 'Lower case'),
        signedFor('2026-09-01T10:00Z', 'WAKT22', 'Too old'),
        signedFor('2026-11-09T10:00Z', 'XYZ789', 'Waiting'),
      ],
      verifyUpdate
    );
    expect(plan.deletes).toEqual([3, 2, 1]);
    expect(plan.summary).toMatchObject({ waiting: 1, expired: 1 });
    expect(WAITING_DAYS).toBe(30);
  });

  it("checks at most a set number of one masjid's rows per run", () => {
    const many = Array.from({ length: MAX_CHECKS_PER_MASJID + 5 }, (_, i) => [
      new Date(Date.parse('2026-11-01T10:00Z') + i * 1000),
      'x',
      'y',
      'ABC234',
      '{"v":1}',
      MASJID.publicKey,
      false,
    ]);
    const plan = tidyPlan([HEADER, ...many], verifyUpdate);
    expect(plan.deletes).toHaveLength(MAX_CHECKS_PER_MASJID);
    expect(plan.summary.partial).toBe(true);
    // A time budget leaves masjids it didn't reach as they are.
    let t = 0;
    const late = tidyPlan(sheet(), verifyUpdate, { budgetMs: 5, clock: () => (t += 10) });
    expect(late.deletes).toEqual([7]); // only the cheap check: a test row
    expect(late.summary.partial).toBe(true);
  });

  it('removes duplicate rows, ticked or not, keeping one tick per key', () => {
    const at = (ts, time, name, approved) => row(ts, 'ABC234', MASJID, time, name, approved);
    // Two identical ticked rows: one goes.
    const twin = at('2026-11-01T10:00Z', 1, 'Registered', true);
    expect(tidyPlan([HEADER, twin, [...twin]], verifyUpdate).deletes).toEqual([1]);
    // A ticked row and an unticked copy, either way round: the copy goes.
    const copy = [...twin];
    copy[6] = false;
    expect(tidyPlan([HEADER, twin, copy], verifyUpdate).deletes).toEqual([2]);
    expect(tidyPlan([HEADER, copy, twin], verifyUpdate).deletes).toEqual([1]);
    // Two identical rows waiting for approval: one goes.
    const waiting = row('2026-11-01T10:00Z', 'WAKT22', MASJID, 1, 'Waiting');
    expect(tidyPlan([HEADER, waiting, [...waiting]], verifyUpdate).deletes).toHaveLength(1);
    // An older ticked row of the same key goes: the newer one has the settings.
    const ticked = [
      HEADER,
      at('2026-11-01T10:00Z', 1, 'Registered', true),
      at('2026-11-02T10:00Z', 2, 'Ticked again', true),
    ];
    expect(tidyPlan(ticked, verifyUpdate).deletes).toEqual([1]);
  });

  it('keeps the newest few keys waiting for approval, and the newest few requests', () => {
    const keys = [11, 12, 13, 14, 15, 16, 17].map((n) => keyPairFromSeed(seed(n)));
    const day = (n) => `2026-11-${String(n).padStart(2, '0')}T10:00Z`;
    const waiting = [
      HEADER,
      ...keys.map((pair, i) => row(day(i + 1), 'WAKT22', pair, i + 1, `Key ${i + 1}`)),
    ];
    const plan = tidyPlan(waiting, verifyUpdate);
    expect(plan.summary.waiting).toBe(MAX_WAITING_KEYS);
    expect(plan.deletes).toEqual([2, 1]); // the two oldest keys
    const approvedFirst = [
      HEADER,
      row(day(1), 'ABC234', MASJID, 1, 'Registered', true),
      ...keys.map((pair, i) => row(day(i + 2), 'ABC234', pair, i + 2, `Request ${i + 1}`)),
    ];
    const withRequests = tidyPlan(approvedFirst, verifyUpdate);
    expect(withRequests.summary.pending).toBe(MAX_WAITING_KEYS);
    expect(withRequests.deletes).toEqual([3, 2]);
  });

  it('changes nothing the second time', () => {
    const once = apply(sheet(), tidyPlan(sheet(), verifyUpdate));
    const twice = tidyPlan(once, verifyUpdate);
    expect(twice.updates).toEqual([]);
    expect(twice.deletes).toEqual([]);
  });

  it("leaves a sheet it doesn't recognise alone", () => {
    expect(tidyPlan([['key', 'value']], verifyUpdate)).toMatchObject({
      ok: false,
      reason: 'columns',
      deletes: [],
    });
    expect(tidyPlan([], verifyUpdate).ok).toBe(false);
  });
});

describe('sheet help text', () => {
  it('explains rows in plain English', () => {
    expect(describeSetting('masjidName')).toMatch(/name/);
    expect(describeSetting('iqamah.isha')).toBe(
      'Isha iqamah: minutes after the adhan (when iqamahAutoCalc is FALSE)'
    );
    expect(describeSetting('jumuah.2.time')).toBe("Jumu'ah 2: time, 24-hour (e.g. 13:15)");
    expect(describeSetting('eidAdha.1.enabled')).toBe(
      'Eid al-Adha prayer 1: TRUE to show, FALSE to hide'
    );
    expect(describeSetting('blackoutDurations.jumuah')).toBe(
      "Jumu'ah: dim the screen for this many minutes"
    );
    expect(describeSetting('unknown')).toBe('');
  });
});

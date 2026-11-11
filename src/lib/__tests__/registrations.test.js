// ── registrations.test.js ────────────────────────────────────────────────
// Self-serve masjids in the shared registration sheet: new codes, the
// pre-filled form, reading the responses sheet (columns, queries, the
// approved key, the newest signed update), and the published list.

import { describe, it, expect } from 'vitest';
import {
  CODE_ALPHABET,
  KEY_RE,
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
      row('2026-11-02', 'WAIT22', STRANGER, { masjidName: 'Not approved' }, false),
    ];
    expect(sharedMasjids(rows, verifyUpdate)).toEqual([
      { code: 'ABC234', name: 'Masjid Al-Noor', city: 'Oakville, Ontario' },
    ]);
    expect(sharedMasjids([HEADER], verifyUpdate)).toEqual([]);
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
    row('2026-11-01T10:00Z', 'WAIT22', MASJID, 1, 'Waiting v1'), // 8
    row('2026-11-02T10:00Z', 'WAIT22', MASJID, 2, 'Waiting v2'), // 9
    row('2026-11-01T10:00Z', 'RER234', OLD, 1, 'Old key', true), // 10
    row('2026-11-04T10:00Z', 'RER234', NEW, 5, 'New key', true), // 11: re-approved
    row('2026-11-05T10:00Z', 'RER234', OLD, 6, 'Old key, later'), // 12
  ];

  it('keeps the approved row, ticked, with the newest signed settings in it', () => {
    const plan = tidyPlan(sheet(), verifyUpdate);
    expect(plan.ok).toBe(true);
    expect(plan.deletes).toEqual([12, 10, 8, 7, 6, 4, 3, 2]);
    expect(plan.summary).toMatchObject({
      approved: 2,
      merged: 1,
      pending: 1,
      waiting: 1,
      removed: 8,
    });
    const after = apply(sheet(), plan);
    const abc = after.filter((r) => r[3] === 'ABC234');
    expect(abc).toHaveLength(2);
    const [kept, request] = abc;
    expect(kept[6]).toBe(true);
    expect(kept[1]).toBe('Newest');
    expect(kept[0]).toEqual(new Date('2026-11-03T10:00Z'));
    expect(verifyUpdate(kept[4], kept[5], 'ABC234').settings.masjidName).toBe('Newest');
    expect(request[1]).toBe('Request');
    expect(after.filter((r) => r[3] === 'WAIT22').map((r) => r[1])).toEqual(['Waiting v2']);
    // After a re-approval only the new key's row is left.
    expect(after.filter((r) => r[3] === 'RER234').map((r) => r[1])).toEqual(['New key']);
    // What screens read still works: the approved key, and its newest update.
    expect(approvedKey(abc.map((r) => [r[5], r[6]]).reverse())).toBe(MASJID.publicKey);
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

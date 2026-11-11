/* @vitest-environment jsdom */
// ── useRemoteSettings.test.jsx ───────────────────────────────────────────
// A screen following a masjid code: Google Sheet and Cloudflare sources,
// keeping its own device settings, waiting while Settings is open, and
// reporting problems without changing anything.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useRemoteSettings from '../useRemoteSettings.js';
import { DEFAULTS } from '../../context/SettingsContext.jsx';
import { CODE_STORAGE_KEY, MODE_STORAGE_KEY, SYNC_STORAGE_KEY } from '../../lib/remoteSettings.js';

const SHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEF';
const base = { ...DEFAULTS, screenLabel: 'Lobby', masjidName: 'Local' };

function mockFetch(routes) {
  const fn = vi.fn(async (url) => {
    for (const [match, respond] of routes) {
      if (String(url).includes(match)) return respond();
    }
    throw new TypeError('network');
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const csv = (text) => () => new Response(text, { status: 200 });
const jsonRes =
  (body, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });

// No registration sheet or form unless a test gives one: the defaults come
// from the build settings, which may be set on this computer (.env.local).
const NO_SHARED = { sharedSheetId: '', formUrl: '' };

function render(props) {
  const updateApplied = vi.fn();
  const hook = renderHook(
    (p) => useRemoteSettings({ updateApplied, baseUrl: '/', ...NO_SHARED, ...p }),
    {
      initialProps: { applied: base, paused: false, ...props },
    }
  );
  return { ...hook, updateApplied };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google Sheet source', () => {
  it('follows the code in the address and applies the sheet, keeping device settings', async () => {
    window.history.replaceState(null, '', '/?masjid=test01');
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID, name: 'Al-Noor' } })],
      [
        'docs.google.com',
        csv('key,value\nmasjidName,Shared name\nscreenLabel,Ignored\niqamah.fajr,30\n'),
      ],
    ]);
    const { result, updateApplied } = render({ source: 'sheet' });
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    expect(result.current.code).toBe('TEST01');
    expect(localStorage.getItem(CODE_STORAGE_KEY)).toBe('TEST01');
    expect(updateApplied).toHaveBeenCalledTimes(1);
    const applied = updateApplied.mock.calls[0][0];
    expect(applied.masjidName).toBe('Shared name');
    expect(applied.iqamah.fajr).toBe(30);
    expect(applied.screenLabel).toBe('Lobby');
    // The masjid's own saved name wins over how it's listed.
    expect(result.current.status.name).toBe('Shared name');
    expect(JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)).code).toBe('TEST01');
  });

  it("puts the masjid's settings back but leaves the follower's own", async () => {
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID } })],
      ['docs.google.com', csv('masjidName,Shared\ntheme,Royal Blue\n')],
    ]);
    localStorage.setItem(CODE_STORAGE_KEY, 'TEST01');
    const first = render({ source: 'sheet' });
    await waitFor(() => expect(first.result.current.status.phase).toBe('ok'));
    // A follower takes the masjid's name, not its theme.
    expect(first.updateApplied.mock.calls[0][0].masjidName).toBe('Shared');
    expect(first.updateApplied.mock.calls[0][0].theme).toBe(base.theme);
    first.unmount();

    // Changed on the screen since: their theme stays, the masjid's name returns.
    const second = render({
      source: 'sheet',
      applied: { ...base, masjidName: 'Changed here', theme: 'Emerald Night' },
    });
    await waitFor(() => expect(second.updateApplied).toHaveBeenCalled());
    const fixed = second.updateApplied.mock.calls.at(-1)[0];
    expect(fixed.masjidName).toBe('Shared');
    expect(fixed.theme).toBe('Emerald Night');
    expect(second.result.current.locked).toBe(true);
  });

  it('applies the display settings too on a masjid screen', async () => {
    window.history.replaceState(null, '', '/?masjid=TEST01&screen=masjid');
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID } })],
      ['docs.google.com', csv('masjidName,Shared\ntheme,Royal Blue\n')],
    ]);
    const { result, updateApplied } = render({ source: 'sheet' });
    await waitFor(() => expect(updateApplied).toHaveBeenCalled());
    expect(result.current.mode).toBe('masjid');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('masjid');
    expect(updateApplied.mock.calls[0][0].theme).toBe('Royal Blue');
  });

  it('switching a follower to a masjid screen applies the full copy', async () => {
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID } })],
      ['docs.google.com', csv('masjidName,Shared\ntheme,Royal Blue\n')],
    ]);
    localStorage.setItem(CODE_STORAGE_KEY, 'TEST01');
    const { result, updateApplied } = render({ source: 'sheet' });
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    expect(updateApplied.mock.calls.every((c) => c[0].theme === base.theme)).toBe(true);
    act(() => {
      result.current.setMode('masjid');
    });
    await waitFor(() =>
      expect(updateApplied.mock.calls.some((c) => c[0].theme === 'Royal Blue')).toBe(true)
    );
  });

  it('waits while Settings is open', async () => {
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID } })],
      ['docs.google.com', csv('masjidName,Shared\n')],
    ]);
    localStorage.setItem(CODE_STORAGE_KEY, 'TEST01');
    const { result, rerender, updateApplied } = render({ source: 'sheet', paused: true });
    await waitFor(() => expect(result.current.status.phase).toBe('pending'));
    expect(updateApplied).not.toHaveBeenCalled();
    rerender({ applied: base, paused: false });
    await waitFor(() => expect(updateApplied).toHaveBeenCalledTimes(1));
  });

  it('reports an unknown code, a sheet that isn’t shared, and offline — without changes', async () => {
    localStorage.setItem(CODE_STORAGE_KEY, 'NOPE01');
    mockFetch([['masjids.json', jsonRes({})]]);
    const a = render({ source: 'sheet' });
    await waitFor(() => expect(a.result.current.status.phase).toBe('notFound'));
    a.unmount();

    localStorage.setItem(CODE_STORAGE_KEY, 'TEST01');
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID } })],
      ['docs.google.com', csv('<!DOCTYPE html><html>Sign in</html>')],
    ]);
    const b = render({ source: 'sheet' });
    await waitFor(() => expect(b.result.current.status.phase).toBe('notShared'));
    b.unmount();

    mockFetch([]); // everything fails, and no sheet address saved yet
    const c = render({ source: 'sheet' });
    await waitFor(() => expect(c.result.current.status.phase).toBe('offline'));
    for (const h of [a, b, c]) expect(h.updateApplied).not.toHaveBeenCalled();
  });

  it('can stop following, and rejects a bad code', async () => {
    mockFetch([]);
    const { result } = render({ source: 'sheet' });
    expect(result.current.code).toBeNull();
    expect(result.current.status.phase).toBe('off');
    act(() => {
      expect(result.current.setCode('x')).toBe(false);
    });
    act(() => {
      result.current.setCode('abc123');
    });
    expect(result.current.code).toBe('ABC123');
    act(() => {
      result.current.setCode(null);
    });
    expect(localStorage.getItem(CODE_STORAGE_KEY)).toBeNull();
  });
});

// ── Self-serve masjids: one shared registration sheet, signed rows ──────────

const SHARED_ID = '1SharedRegistrationsSheet0123456789abcdEFG';
const FORM =
  'https://docs.google.com/forms/d/e/FORMID/viewform?usp=pp_url' +
  '&entry.1=NAME&entry.2=CITY&entry.3=CODE&entry.4=SETTINGS&entry.5=KEY';
const FAST_KDF = { iterations: 1, memorySize: 64, parallelism: 1 };
const PASS = 'olive lantern river stone';
const HEADER = ['Timestamp', 'Masjid name', 'City', 'Masjid code', 'Settings', 'Publish key'];

/** A stand-in for the responses sheet and the form that feeds it. */
function fakeShared({ approvedColumn = true } = {}) {
  const rows = [];
  let clock = 0;
  const csvOf = (table) =>
    table.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const answer = (tq) => {
    if (/limit 0$/.test(tq)) return csvOf([approvedColumn ? [...HEADER, 'Approved'] : HEADER]);
    const code = tq.match(/D = '([^']*)'/)?.[1];
    const key = tq.match(/F = '([^']*)'/)?.[1];
    const limit = Number(tq.match(/limit (\d+)$/)?.[1] || 1e9);
    const mine = rows
      .filter((r) => r.code === code && (!key || r.key === key))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    if (tq.startsWith('select F, G')) {
      return csvOf([['Publish key', 'Approved'], ...mine.map((r) => [r.key, r.approved])]);
    }
    if (tq.startsWith('select F ')) return csvOf([['Publish key'], ...mine.map((r) => [r.key])]);
    if (tq.startsWith('select E')) return csvOf([['Settings'], ...mine.map((r) => [r.settings])]);
    if (tq.startsWith('select D')) return csvOf([['Masjid code'], ...mine.map((r) => [r.code])]);
    throw new Error(`unexpected query: ${tq}`);
  };
  const add = (row) => rows.push({ ts: ++clock, approved: 'FALSE', ...row });
  const posts = [];
  const fetchFn = vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('masjids.json')) return new Response('{}', { status: 200 });
    if (u.includes('/formResponse')) {
      const body = new URLSearchParams(init.body);
      posts.push(body);
      add({ code: body.get('entry.3'), settings: body.get('entry.4'), key: body.get('entry.5') });
      return new Response('', { status: 200 });
    }
    if (u.includes('/gviz/')) return new Response(answer(new URL(u).searchParams.get('tq')));
    throw new TypeError('network');
  });
  vi.stubGlobal('fetch', fetchFn);
  return { rows, add, posts, fetchFn };
}

async function signedRow(code, time, settings, passphrase = PASS) {
  const { derivePublishKey } = await import('../../lib/passphraseKey.js');
  const { signUpdate } = await import('../../lib/signatures.js');
  const pair = await derivePublishKey(passphrase, code, FAST_KDF);
  return {
    code,
    key: pair.publicKey,
    settings: signUpdate({ code, time, settings }, pair.secretKey),
  };
}

const sharedProps = {
  source: 'sheet',
  sharedSheetId: SHARED_ID,
  formUrl: FORM,
  kdf: FAST_KDF,
  confirmWaits: [0, 0],
};

describe('Self-serve masjids (shared registration sheet)', () => {
  it('applies only the newest update signed with the approved key', async () => {
    const sheet = fakeShared();
    sheet.add({ ...(await signedRow('ABC234', 1, { masjidName: 'v1' })), approved: 'TRUE' });
    sheet.add(
      await signedRow('ABC234', 2, { masjidName: 'v2', iqamah: { ...base.iqamah, isha: 7 } })
    );
    // A stranger's rows: their own key, and the masjid's key with a forged signature.
    sheet.add(await signedRow('ABC234', 9, { masjidName: 'Hijacked' }, 'someone else entirely'));
    const forged = await signedRow('ABC234', 8, { masjidName: 'Forged' });
    sheet.add({ ...forged, settings: forged.settings.replace('Forged', 'Swapped') });
    localStorage.setItem(CODE_STORAGE_KEY, 'ABC234');

    const { result, updateApplied } = render(sharedProps);
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    expect(updateApplied).toHaveBeenCalledTimes(1);
    expect(updateApplied.mock.calls[0][0].masjidName).toBe('v2');
    expect(updateApplied.mock.calls[0][0].iqamah.isha).toBe(7);
    expect(result.current.status).toMatchObject({ via: 'shared', name: 'v2' });
    expect(JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)).version).toBe('s2');
  });

  it('waits for approval, and tells a sheet that isn’t set up apart', async () => {
    const sheet = fakeShared();
    sheet.add(await signedRow('ABC234', 1, { masjidName: 'v1' }));
    localStorage.setItem(CODE_STORAGE_KEY, 'ABC234');
    const a = render(sharedProps);
    await waitFor(() => expect(a.result.current.status.phase).toBe('notApproved'));
    expect(a.updateApplied).not.toHaveBeenCalled();
    a.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('"Timestamp","Something else"'))
    );
    const b = render(sharedProps);
    await waitFor(() => expect(b.result.current.status.phase).toBe('setup'));
    // Registering there says the site isn't set up, rather than "try again".
    let res;
    await act(async () => {
      res = await b.result.current.register({ passphrase: PASS, settings: base, again: true });
    });
    expect(res).toEqual({ ok: false, reason: 'setup' });
  });

  it('registers a new masjid with a passphrase, then follows it', async () => {
    const sheet = fakeShared();
    const { result } = render(sharedProps);
    expect(result.current.canRegister).toBe(true);
    let res;
    await act(async () => {
      res = await result.current.register({ passphrase: 'too short', settings: base });
    });
    expect(res).toEqual({ ok: false, reason: 'short' });
    await act(async () => {
      res = await result.current.register({ passphrase: PASS, settings: base });
    });
    expect(res.ok).toBe(true);
    expect(res.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(sheet.posts).toHaveLength(1);
    const sent = sheet.posts[0];
    expect(sent.get('entry.1')).toBe('Local');
    expect(sent.get('entry.3')).toBe(res.code);
    // The screen's label stays on the screen; the settings are signed.
    const { verifyUpdate } = await import('../../lib/signatures.js');
    const update = verifyUpdate(sent.get('entry.4'), sent.get('entry.5'), res.code);
    expect(update.settings.masjidName).toBe('Local');
    expect(update.settings).not.toHaveProperty('screenLabel');
    expect(result.current.code).toBe(res.code);
    await waitFor(() => expect(result.current.status.phase).toBe('notApproved'));
  });

  it('publishes with the right passphrase only', async () => {
    const sheet = fakeShared();
    sheet.add({ ...(await signedRow('ABC234', 1, { masjidName: 'v1' })), approved: 'TRUE' });
    localStorage.setItem(CODE_STORAGE_KEY, 'ABC234');
    const { result } = render(sharedProps);
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));

    let res;
    await act(async () => {
      res = await result.current.publish({ ...base, masjidName: 'Too soon' });
    });
    expect(res).toEqual({ ok: false, reason: 'locked' });
    await act(async () => {
      res = await result.current.unlock('the wrong passphrase');
    });
    expect(res).toEqual({ ok: false, reason: 'wrong' });
    expect(result.current.unlocked).toBe(false);
    await act(async () => {
      res = await result.current.unlock(PASS);
    });
    expect(res.ok).toBe(true);
    expect(result.current.unlocked).toBe(true);

    await act(async () => {
      res = await result.current.publish({ ...base, masjidName: 'Al-Noor', theme: 'Royal Blue' });
    });
    expect(res.ok).toBe(true);
    expect(sheet.posts).toHaveLength(1);
    const { verifyUpdate } = await import('../../lib/signatures.js');
    const update = verifyUpdate(sheet.posts[0].get('entry.4'), sheet.rows[0].key, 'ABC234');
    // From a follower's screen: the masjid's settings, not this person's theme.
    expect(update.settings.masjidName).toBe('Al-Noor');
    expect(update.settings).not.toHaveProperty('theme');
    expect(update.time).toBeGreaterThan(1);
    const saved = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY));
    expect(saved).toMatchObject({ version: `s${update.time}`, signedAt: update.time });

    act(() => result.current.lock());
    expect(result.current.unlocked).toBe(false);
  });

  it("says when a publish didn't arrive", async () => {
    const sheet = fakeShared();
    sheet.add({ ...(await signedRow('ABC234', 1, { masjidName: 'v1' })), approved: 'TRUE' });
    localStorage.setItem(CODE_STORAGE_KEY, 'ABC234');
    const { result } = render(sharedProps);
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    await act(async () => {
      await result.current.unlock(PASS);
    });
    // The form drops it (e.g. it asks people to sign in).
    const original = sheet.fetchFn.getMockImplementation();
    sheet.fetchFn.mockImplementation(async (url, init) =>
      String(url).includes('/formResponse') ? new Response('') : original(url, init)
    );
    let res;
    await act(async () => {
      res = await result.current.publish({ ...base, masjidName: 'Lost' });
    });
    expect(res).toEqual({ ok: false, reason: 'notConfirmed' });
  });

  it('registering makes this screen manage the masjid, with nothing locked', async () => {
    fakeShared();
    const { result, rerender } = render({ ...sharedProps, paused: true });
    let res;
    await act(async () => {
      res = await result.current.register({ passphrase: PASS, settings: base });
    });
    expect(res.ok).toBe(true);
    expect(result.current).toMatchObject({
      code: res.code,
      mode: 'manage',
      locked: false,
      unlocked: true,
    });
    // The key is kept only while Settings is open.
    rerender({ ...sharedProps, applied: base, paused: false });
    expect(result.current.unlocked).toBe(false);
  });

  it('manages a masjid from another screen with its code and passphrase, even before approval', async () => {
    const sheet = fakeShared();
    sheet.add(await signedRow('ABC234', 1, { masjidName: 'Waiting' }));
    const { result } = render({ ...sharedProps, paused: true });
    let res;
    await act(async () => {
      res = await result.current.unlock('a wrong passphrase here', 'ABC234');
    });
    expect(res).toEqual({ ok: false, reason: 'wrong' });
    await act(async () => {
      res = await result.current.unlock(PASS, 'ZZZ999');
    });
    expect(res).toEqual({ ok: false, reason: 'unknownCode' });
    await act(async () => {
      res = await result.current.unlock(PASS, 'abc234');
    });
    expect(res).toEqual({ ok: true });
    act(() => {
      result.current.manage('ABC234');
    });
    expect(result.current).toMatchObject({ code: 'ABC234', mode: 'manage', unlocked: true });
    await act(async () => {
      res = await result.current.publish({ ...base, masjidName: 'Published before approval' });
    });
    expect(res.ok).toBe(true);
    expect(sheet.posts).toHaveLength(1);
  });

  it("keeps a managing screen's own changes, and takes what other admins publish", async () => {
    const sheet = fakeShared();
    sheet.add({ ...(await signedRow('ABC234', 1, { masjidName: 'v1' })), approved: 'TRUE' });
    localStorage.setItem(CODE_STORAGE_KEY, 'ABC234');
    localStorage.setItem(MODE_STORAGE_KEY, 'manage');
    const { result, rerender, updateApplied } = render(sharedProps);
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    expect(result.current.locked).toBe(false);
    expect(updateApplied.mock.calls.at(-1)[0].masjidName).toBe('v1');

    // Changed here (and not published yet): a check doesn't undo it.
    updateApplied.mockClear();
    rerender({ ...sharedProps, applied: { ...base, masjidName: 'Edited here' }, paused: false });
    await act(async () => {
      await result.current.checkNow();
    });
    expect(updateApplied).not.toHaveBeenCalled();

    // Another admin publishes: this screen takes it.
    sheet.add(await signedRow('ABC234', 5, { masjidName: 'From the other admin' }));
    await act(async () => {
      await result.current.checkNow();
    });
    expect(updateApplied.mock.calls.at(-1)[0].masjidName).toBe('From the other admin');
  });

  it('never goes back to an older update sent to the form again', async () => {
    const sheet = fakeShared();
    const old = await signedRow('ABC234', 1, { masjidName: 'Old' });
    sheet.add({ ...old, approved: 'TRUE' });
    sheet.add(await signedRow('ABC234', 5, { masjidName: 'Current' }));
    localStorage.setItem(CODE_STORAGE_KEY, 'ABC234');
    const { result, updateApplied } = render(sharedProps);
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    expect(updateApplied.mock.calls.at(-1)[0].masjidName).toBe('Current');

    // Someone sends the old (validly signed) row again, enough times to push
    // the current one out of the rows screens look at.
    for (let i = 0; i < 12; i++) sheet.add(old);
    updateApplied.mockClear();
    await act(async () => {
      await result.current.checkNow();
    });
    expect(updateApplied.mock.calls.every((c) => c[0].masjidName !== 'Old')).toBe(true);
    expect(JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)).signedAt).toBe(5);
  });

  it('forgets what it knew about the last masjid when the code changes', async () => {
    mockFetch([
      ['masjids.json', jsonRes({ TEST01: { sheetId: SHEET_ID } })],
      [SHARED_ID, csv('"Timestamp","Something else"')],
      [SHEET_ID, csv('masjidName,Own sheet\n')],
    ]);
    localStorage.setItem(CODE_STORAGE_KEY, 'ZZZ999');
    const { result } = render(sharedProps);
    await waitFor(() =>
      expect(result.current.status).toMatchObject({ phase: 'setup', via: 'shared' })
    );
    act(() => {
      result.current.setCode('TEST01');
    });
    expect(result.current.status.via).toBeNull();
    await waitFor(() =>
      expect(result.current.status).toMatchObject({ phase: 'ok', via: 'sheet', name: 'Own sheet' })
    );
  });

  it('needs both the sheet ID and a usable form link to register', () => {
    mockFetch([]);
    expect(render(sharedProps).result.current.registerProblems).toEqual([]);
    expect(
      render({ ...sharedProps, sharedSheetId: '', formUrl: '' }).result.current.registerProblems
    ).toEqual(['sheetId', 'formUrl']);
    expect(render({ ...sharedProps, source: 'none' }).result.current.registerProblems).toEqual([]);
    expect(render({ ...sharedProps, sharedSheetId: '' }).result.current.canRegister).toBe(false);
    expect(
      render({ ...sharedProps, formUrl: 'https://example.org/form' }).result.current.canRegister
    ).toBe(false);
  });
});

describe('Cloudflare source', () => {
  it('applies the current version and each pushed one', async () => {
    const sockets = [];
    class FakeSocket {
      constructor(url) {
        this.url = url;
        sockets.push(this);
        setTimeout(() => this.onopen?.(), 0);
      }
      send() {}
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeSocket);
    mockFetch([['/m/TOR4K7Q', jsonRes({ version: 1, settings: { masjidName: 'v1' } })]]);
    localStorage.setItem(CODE_STORAGE_KEY, 'TOR4K7Q');
    localStorage.setItem(MODE_STORAGE_KEY, 'masjid'); // live updates are for masjid screens
    const { result, updateApplied } = render({
      source: 'cloudflare',
      apiUrl: 'https://s.example.org',
    });
    await waitFor(() => expect(updateApplied).toHaveBeenCalledTimes(1));
    expect(updateApplied.mock.calls[0][0].masjidName).toBe('v1');
    expect(sockets[0].url).toBe('wss://s.example.org/m/TOR4K7Q/live');
    await waitFor(() => expect(result.current.status.live).toBe(true));

    act(() => {
      sockets[0].onmessage({
        data: JSON.stringify({ version: 2, settings: { masjidName: 'v2' } }),
      });
    });
    expect(updateApplied).toHaveBeenCalledTimes(2);
    expect(updateApplied.mock.calls[1][0].masjidName).toBe('v2');
    act(() => {
      sockets[0].onmessage({ data: 'pong' });
    });
    expect(updateApplied).toHaveBeenCalledTimes(2);
  });

  it('gives followers no live connection (they check every 30 minutes)', async () => {
    const sockets = [];
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          sockets.push(this);
        }
        close() {}
      }
    );
    mockFetch([['/m/TOR4K7Q', jsonRes({ version: 1, settings: { masjidName: 'v1' } })]]);
    localStorage.setItem(CODE_STORAGE_KEY, 'TOR4K7Q');
    const { result } = render({ source: 'cloudflare', apiUrl: 'https://s.example.org' });
    await waitFor(() => expect(result.current.status.phase).toBe('ok'));
    expect(result.current.mode).toBe('follow');
    expect(sockets).toHaveLength(0);
  });

  it('is off without a Worker address', () => {
    mockFetch([]);
    const { result } = render({ source: 'cloudflare', apiUrl: '' });
    expect(result.current.enabled).toBe(false);
  });
});

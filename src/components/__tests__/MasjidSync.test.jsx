/* @vitest-environment jsdom */
// ── MasjidSync.test.jsx ──────────────────────────────────────────────────
//
// Settings → Share & follow: one question ("How is this screen used?") with
// three answers — following, a masjid screen, managing — registering a new
// masjid in one form, managing an existing one with its code and
// passphrase, and what a followed or managed masjid shows.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MasjidSync from '../settings/MasjidSync.jsx';
import { SettingsProvider } from '../../context/SettingsContext.jsx';
import { I18nProvider } from '../../i18n/I18nContext.jsx';

const details = {
  name: 'Masjid Al-Noor',
  location: 'Oakville, Ontario, Canada',
  method: 'ISNA – North America',
  jumuah: ['13:15', '14:00'],
};

function sync(overrides = {}) {
  return {
    enabled: true,
    source: 'sheet',
    code: null,
    mode: 'follow',
    status: { phase: 'off', via: null, name: '', lastSync: null },
    canRegister: true,
    registerProblems: [],
    setCode: vi.fn(),
    setMode: vi.fn(),
    checkNow: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    manage: vi.fn(),
    unlocked: false,
    ...overrides,
  };
}

function renderSync(props) {
  return render(
    <SettingsProvider>
      <I18nProvider>
        <MasjidSync details={details} {...props} />
      </I18nProvider>
    </SettingsProvider>
  );
}

const choose = (name) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 }))
  );
});

describe('Share & follow: how is this screen used?', () => {
  it('asks one question with three answers, starting on My own screen', () => {
    renderSync({ remoteSync: sync() });
    expect(screen.getByText('How is this screen used?')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /My own screen/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText("Or enter the masjid's code")).toBeInTheDocument();
  });

  it('follows as a follower or as a masjid screen', () => {
    const remoteSync = sync();
    const { rerender } = renderSync({ remoteSync });
    fireEvent.change(screen.getByLabelText("Or enter the masjid's code"), {
      target: { value: 'abc234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(remoteSync.setMode).toHaveBeenLastCalledWith('follow');
    expect(remoteSync.setCode).toHaveBeenLastCalledWith('ABC234');

    rerender(
      <SettingsProvider>
        <I18nProvider>
          <MasjidSync details={details} remoteSync={remoteSync} />
        </I18nProvider>
      </SettingsProvider>
    );
    choose('A screen in the masjid');
    fireEvent.change(screen.getByLabelText("Or enter the masjid's code"), {
      target: { value: 'ABC234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(remoteSync.setMode).toHaveBeenLastCalledWith('masjid');
  });

  it("registers a new masjid in one form, showing what it'll share", async () => {
    const onRegister = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'notConfirmed' })
      .mockResolvedValueOnce({ ok: true, code: 'ABC234' });
    renderSync({ remoteSync: sync(), onRegister });
    choose('I manage this masjid');
    expect(screen.getByText('Register a new masjid')).toBeInTheDocument();
    expect(screen.getByText('Masjid Al-Noor')).toBeInTheDocument();
    expect(screen.getByText('1:15 PM, 2:00 PM')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Publish passphrase'), {
      target: { value: 'olive lantern river stone' },
    });
    fireEvent.change(screen.getByLabelText('Type it again'), {
      target: { value: 'olive lantern river stone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('status')).toHaveTextContent('Tick the box');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent("The form didn't accept it")
    );
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(onRegister).toHaveBeenCalledTimes(2));
    expect(onRegister).toHaveBeenLastCalledWith({
      passphrase: 'olive lantern river stone',
      again: false,
    });
  });

  it("won't register without the masjid's name and location", () => {
    const onRegister = vi.fn();
    renderSync({ remoteSync: sync(), onRegister, details: { ...details, name: '' } });
    choose('I manage this masjid');
    expect(screen.getByText('Not set')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('status')).toHaveTextContent("Set the masjid's name and location");
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('manages an existing masjid with its code and passphrase', async () => {
    const remoteSync = sync({
      unlock: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, reason: 'wrong' })
        .mockResolvedValueOnce({ ok: true }),
    });
    renderSync({ remoteSync });
    choose('I manage this masjid');
    fireEvent.click(screen.getByRole('button', { name: /Already registered/ }));
    fireEvent.change(screen.getByLabelText("The masjid's code"), { target: { value: 'abc234' } });
    fireEvent.change(screen.getByLabelText('Publish passphrase'), {
      target: { value: 'not the passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent("That isn't this masjid's")
    );
    expect(remoteSync.manage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    await waitFor(() => expect(remoteSync.manage).toHaveBeenCalledWith('ABC234'));
    expect(remoteSync.unlock).toHaveBeenLastCalledWith('not the passphrase', 'ABC234');
  });
});

describe('Share & follow: a followed or managed masjid', () => {
  const following = (overrides) =>
    sync({ code: 'ABC234', status: { phase: 'ok', via: 'shared', name: 'Al-Noor' }, ...overrides });

  it("says what a follower's screen does, and switches roles", () => {
    const remoteSync = following();
    renderSync({ remoteSync });
    expect(screen.getByText(/Everything else on this screen is yours/)).toBeInTheDocument();
    choose('A screen in the masjid');
    expect(remoteSync.setMode).toHaveBeenCalledWith('masjid');
    // Managing asks for the passphrase first.
    choose('I manage this masjid');
    expect(remoteSync.setMode).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Type the publish passphrase to manage Al-Noor/)).toBeInTheDocument();
  });

  it('tells a managing screen that nothing is locked, and how to publish', () => {
    renderSync({ remoteSync: following({ mode: 'manage' }) });
    expect(screen.getByRole('radio', { name: /I manage this masjid/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText(/Nothing is locked here/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop managing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lost the passphrase?' })).toBeInTheDocument();
  });

  it('shows that a newly registered masjid waits for approval', () => {
    renderSync({
      remoteSync: following({
        mode: 'manage',
        status: { phase: 'notApproved', via: 'shared', name: '' },
      }),
    });
    expect(screen.getByText('Registered; waiting for approval')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for approval. Until then/)).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it("won't manage a masjid that has its own sheet", () => {
    renderSync({ remoteSync: following({ status: { phase: 'ok', via: 'sheet', name: 'X' } }) });
    choose('I manage this masjid');
    expect(screen.getByText(/changed in its own Google Sheet/)).toBeInTheDocument();
  });
});

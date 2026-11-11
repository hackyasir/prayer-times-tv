// ── MasjidSync — Settings → Share & follow ──────────────────────────────────
//
// Shown only when the deployment has a shared-settings source
// (VITE_SETTINGS_SOURCE, see docs/remote-settings.md), in its own Settings
// tab. One question — "How is this screen used?" — with three answers
// (MODES in lib/remoteSettings.js):
//
//   My own screen           follow a masjid: its prayer times, iqamah,
//                           Jumu'ah, Eid and announcements; the rest is yours
//   A screen in the masjid  shows everything the masjid sets
//   I manage this masjid    nothing is locked: the ordinary Apply button
//                           becomes "Apply and publish" (SettingsPanel), and
//                           sends this screen's settings to every screen.
//                           Register a new masjid here, or manage an existing
//                           one with its code and publish passphrase.

import { useEffect, useState } from 'react';
import { useT, fmtStr } from '../../i18n/I18nContext.jsx';
import { fmt12 } from '../../lib/formatters.js';
import { passphraseProblem } from '../../lib/registrations.js';
import {
  directoryEntries,
  filterDirectory,
  followLink,
  normalizeCode,
} from '../../lib/remoteSettings.js';

const noteStyle = {
  fontSize: 12,
  lineHeight: 1.45,
  color: 'var(--t-text-dim)',
  marginTop: 6,
};
const alertStyle = { ...noteStyle, color: 'var(--t-accent)' };

const MAX_RESULTS = 8;
const ROLES = ['follow', 'masjid', 'manage'];

/** "13:15" → "1:15 PM" (the display's usual style). */
function to12(hm) {
  const [h, m] = String(hm || '')
    .split(':')
    .map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(hm || '');
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function SectionTitle({ children }) {
  return <div className="sync-section-title">{children}</div>;
}

function CopyLink({ label, url }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access: the field is selectable for a manual copy.
    }
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ ...noteStyle, marginTop: 0 }}>{label}</div>
      <div className="sync-actions" style={{ marginTop: 4 }}>
        <input
          className="sinput sync-link"
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label={label}
        />
        <button type="button" className="sbtn-meta" onClick={copy}>
          {copied ? t('settings.sync.copied') : t('settings.sync.copy')}
        </button>
      </div>
    </div>
  );
}

export function PassphraseInput({ id, label, value, onChange, autoComplete, disabled, onEnter }) {
  return (
    <div style={{ marginTop: 8 }}>
      <label className="slbl" htmlFor={id} style={{ fontSize: 12 }}>
        {label}
      </label>
      <input
        id={id}
        className="sinput"
        type="password"
        autoComplete={autoComplete}
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
      />
    </div>
  );
}

/** How is this screen used? Three answers, one chosen. */
function RoleChooser({ role, onChoose }) {
  const { t } = useT();
  return (
    <div className="sync-role" role="radiogroup" aria-label={t('settings.sync.role')}>
      <div className="sync-role-question">{t('settings.sync.role')}</div>
      {ROLES.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={role === key}
          className="sync-role-option"
          onClick={() => onChoose(key)}
        >
          <span className="sync-role-dot" aria-hidden="true" />
          <span>
            <strong>{t(`settings.sync.role.${key}`)}</strong>
            <span>{t(`settings.sync.role.${key}Note`)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Follow a masjid (or set up a masjid screen): find it, or type its code. */
function FindMasjid({ directory, onFollow }) {
  const { t } = useT();
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState(false);
  const [query, setQuery] = useState('');
  const matches = filterDirectory(directory, query).slice(0, MAX_RESULTS);

  const follow = (value) => {
    const next = normalizeCode(value);
    if (!next) {
      setInputError(true);
      return;
    }
    setInputError(false);
    onFollow(next);
  };

  return (
    <div className="sync-step">
      {directory.length > 0 && (
        <>
          <label className="slbl" htmlFor="masjid-find">
            {t('settings.sync.find')}
          </label>
          <input
            id="masjid-find"
            className="sinput"
            type="search"
            placeholder={t('settings.sync.findPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="sync-directory">
              {matches.map((m) => (
                <li key={m.code}>
                  <span className="sync-directory-name">
                    {m.name}
                    {m.city && <span className="sync-directory-city">{m.city}</span>}
                  </span>
                  <button type="button" className="sbtn-meta" onClick={() => follow(m.code)}>
                    {t('settings.sync.follow')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={noteStyle}>{t('settings.sync.noMatches')}</div>
          )}
        </>
      )}
      <div style={{ ...noteStyle, marginTop: directory.length ? 12 : 0 }}>
        {t('settings.sync.orCode')}
      </div>
      <div className="sync-actions" style={{ marginTop: 4 }}>
        <input
          className="sinput"
          type="text"
          autoCapitalize="characters"
          placeholder={t('settings.sync.codePlaceholder')}
          value={input}
          maxLength={20}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') follow(input);
          }}
          aria-label={t('settings.sync.orCode')}
          aria-invalid={inputError || undefined}
        />
        <button type="button" className="sbtn pri" onClick={() => follow(input)}>
          {t('settings.sync.follow')}
        </button>
      </div>
      {inputError && (
        <div style={alertStyle} role="alert">
          {t('settings.sync.badCode')}
        </div>
      )}
    </div>
  );
}

/** What registering will share, as set in the other tabs (read-only). */
function DetailsSummary({ details }) {
  const { t } = useT();
  const rows = [
    ['name', details.name],
    ['location', details.location],
    ['method', details.method],
    ['jumuah', (details.jumuah || []).map(to12).join(', ')],
  ];
  return (
    <ul className="sync-details">
      {rows.map(([key, value]) => (
        <li key={key}>
          <span className="sync-details-label">{t(`settings.sync.detail.${key}`)}</span>
          <span className="sync-details-value" data-missing={!value || undefined}>
            {value || t('settings.sync.notSet')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Choose a publish passphrase and register: a new masjid with this
 * screen's settings, or — with `again` — the managed masjid under a new
 * passphrase (a lost one), which counts once approved again.
 */
function RegisterForm({ details = {}, onRegister, again = false }) {
  const { t } = useT();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [authorised, setAuthorised] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const id = again ? 'register-again' : 'register';
  const missing =
    !again && (!String(details.name || '').trim() || !String(details.location || '').trim());

  const submit = async () => {
    const problem = missing
      ? 'details'
      : passphraseProblem(pass, confirm) || (authorised ? null : 'authorised');
    if (problem) {
      setMsg(
        t(
          problem === 'details'
            ? 'settings.sync.detailsMissing'
            : `settings.sync.problem.${problem}`
        )
      );
      return;
    }
    setBusy(true);
    setMsg(t('settings.sync.registering'));
    let result;
    try {
      result = await onRegister?.({ passphrase: pass, again });
    } catch {
      result = { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
    if (result?.ok) {
      setPass('');
      setConfirm('');
      // A new masjid: this screen now manages it (the tab shows it).
      if (again) setMsg(t('settings.sync.registeredAgain'));
    } else {
      // A registration that never reached the sheet: almost always the
      // form's own settings (sign-in, required questions, not published).
      const reason = result?.reason === 'notConfirmed' ? 'formRefused' : result?.reason;
      setMsg(t(`settings.sync.problem.${reason || 'error'}`));
    }
  };

  return (
    <div className="sync-step">
      <div className="sync-step-title">
        {t(again ? 'settings.sync.registerAgain' : 'settings.sync.registerNew')}
      </div>
      {again ? (
        <div style={{ ...noteStyle, marginTop: 4 }}>{t('settings.sync.registerAgainNote')}</div>
      ) : (
        <>
          <div style={{ ...noteStyle, marginTop: 4 }}>{t('settings.sync.summary')}</div>
          <DetailsSummary details={details} />
          <div style={missing ? alertStyle : noteStyle}>
            {t(missing ? 'settings.sync.detailsMissing' : 'settings.sync.summaryHint')}
          </div>
        </>
      )}
      <PassphraseInput
        id={`${id}-pass`}
        label={t(again ? 'settings.sync.newPassphrase' : 'settings.sync.passphrase')}
        value={pass}
        onChange={setPass}
        autoComplete="new-password"
        disabled={busy}
      />
      <PassphraseInput
        id={`${id}-confirm`}
        label={t('settings.sync.passphraseConfirm')}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        disabled={busy}
      />
      <div style={noteStyle}>{t('settings.sync.passphraseHint')}</div>
      <label style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={authorised}
          disabled={busy}
          onChange={(e) => setAuthorised(e.target.checked)}
        />
        <span>{t('settings.sync.authorised')}</span>
      </label>
      <div className="sync-actions">
        <button type="button" className="sbtn pri" onClick={submit} disabled={busy}>
          {t(again ? 'settings.sync.registerAgainButton' : 'settings.sync.registerButton')}
        </button>
      </div>
      {msg && (
        <div style={noteStyle} role="status">
          {msg}
        </div>
      )}
      {!again && <div style={noteStyle}>{t('settings.sync.registerNote')}</div>}
    </div>
  );
}

/**
 * Manage an existing self-serve masjid from this screen: its code (unless
 * it's the one this screen follows) and its publish passphrase.
 */
function ManageExisting({ remoteSync, fixedCode, name }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    const target = fixedCode || normalizeCode(code);
    if (!target) {
      setMsg(t('settings.sync.badCode'));
      return;
    }
    setBusy(true);
    setMsg(t('settings.sync.checkingPassphrase'));
    try {
      const result = await remoteSync.unlock(pass, target);
      if (result?.ok) {
        setPass('');
        setMsg('');
        remoteSync.manage(target);
      } else {
        setMsg(t(`settings.sync.problem.${result?.reason || 'error'}`));
      }
    } catch {
      setMsg(t('settings.sync.problem.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sync-step">
      {fixedCode ? (
        <div style={{ ...noteStyle, marginTop: 0 }}>
          {fmtStr(t('settings.sync.manageThis'), { name: name || fixedCode })}
        </div>
      ) : (
        <>
          <div className="sync-step-title">{t('settings.sync.manageExisting')}</div>
          <label className="slbl" htmlFor="manage-code" style={{ fontSize: 12, marginTop: 8 }}>
            {t('settings.sync.manageCode')}
          </label>
          <input
            id="manage-code"
            className="sinput"
            type="text"
            autoCapitalize="characters"
            placeholder={t('settings.sync.codePlaceholder')}
            value={code}
            maxLength={20}
            disabled={busy}
            onChange={(e) => setCode(e.target.value)}
          />
        </>
      )}
      <PassphraseInput
        id="manage-pass"
        label={t('settings.sync.passphrase')}
        value={pass}
        onChange={setPass}
        autoComplete="current-password"
        disabled={busy}
        onEnter={submit}
      />
      <div className="sync-actions">
        <button type="button" className="sbtn pri" onClick={submit} disabled={busy}>
          {t('settings.sync.manageButton')}
        </button>
      </div>
      {msg && (
        <div style={noteStyle} role="status">
          {msg}
        </div>
      )}
    </div>
  );
}

/** Cloudflare: managing needs only the code; the sign-in comes when publishing. */
function ManageCode({ onManage }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const submit = () => {
    const next = normalizeCode(code);
    setBad(!next);
    if (next) onManage(next);
  };
  return (
    <div className="sync-step">
      <label className="slbl" htmlFor="manage-code" style={{ fontSize: 12 }}>
        {t('settings.sync.manageCode')}
      </label>
      <div className="sync-actions" style={{ marginTop: 4 }}>
        <input
          id="manage-code"
          className="sinput"
          type="text"
          autoCapitalize="characters"
          placeholder={t('settings.sync.codePlaceholder')}
          value={code}
          maxLength={20}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button type="button" className="sbtn pri" onClick={submit}>
          {t('settings.sync.manageButton')}
        </button>
      </div>
      {bad && (
        <div style={alertStyle} role="alert">
          {t('settings.sync.badCode')}
        </div>
      )}
    </div>
  );
}

/**
 * Development only (npm run dev): why Register your masjid isn't shown.
 * English on purpose — it's for whoever sets up the deployment.
 */
function DevRegisterNote({ problems }) {
  const reasons = {
    sheetId:
      "VITE_REGISTRATIONS_SHEET_ID is missing, or isn't a Google Sheets ID or link (the part between /d/ and /edit).",
    formUrl:
      "VITE_REGISTER_FORM_URL is missing, or isn't a Google Forms pre-filled link (…/viewform?usp=pp_url&entry.…) made with the answers CODE, SETTINGS and KEY (and NAME, CITY).",
  };
  return (
    <div
      role="note"
      style={{
        ...noteStyle,
        marginTop: 16,
        paddingLeft: 10,
        borderLeft: '3px solid var(--t-accent)',
      }}
    >
      <strong>Development only: registering a masjid is off.</strong>
      {problems.map((p) => (
        <div key={p}>• {reasons[p]}</div>
      ))}
      <div>Change .env.local, restart npm run dev, then reload this page.</div>
    </div>
  );
}

export default function MasjidSync({
  remoteSync,
  onRegister,
  onExportSheet,
  cityTz,
  // Registering: the masjid's details as set now ({ name, location, method,
  // jumuah: ['13:00', …] }).
  details = {},
  // The answer chosen before following anything, and (managing) whether to
  // register or use an existing code — kept by the Settings panel so it
  // survives a visit to another tab.
  flow: flowProp,
  setFlow: setFlowProp,
}) {
  const { t } = useT();
  const [directory, setDirectory] = useState([]);
  const [localFlow, setLocalFlow] = useState({ choice: 'follow', manageView: 'new' });
  const [wantManage, setWantManage] = useState(false);
  const [lost, setLost] = useState(false);
  const flow = flowProp || localFlow;
  const setFlow = setFlowProp || setLocalFlow;

  const enabled = Boolean(remoteSync?.enabled);
  const code = remoteSync?.code;
  const source = remoteSync?.source;

  // The list of masjids to choose from (only while not following one).
  useEffect(() => {
    if (!enabled || code) return undefined;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL || '/'}masjids.json`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setDirectory(directoryEntries(json, source));
      })
      .catch(() => {
        // Offline: following by code still works.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, code, source]);

  if (!enabled) return null;
  const { status, mode } = remoteSync;
  const ownSheet = source === 'sheet' && status.via === 'sheet';
  const canRegister = source === 'sheet' && remoteSync.canRegister;
  const devNote = import.meta.env.DEV && remoteSync.registerProblems?.length > 0 && (
    <DevRegisterNote problems={remoteSync.registerProblems} />
  );

  // ── Not following a masjid: choose, then find it or register it ──
  if (!code) {
    const choice = flow.choice;
    const followAs = (role) => (next) => {
      remoteSync.setMode(role);
      remoteSync.setCode(next);
    };
    let body;
    if (choice !== 'manage') {
      body = <FindMasjid directory={directory} onFollow={followAs(choice)} />;
    } else if (source === 'cloudflare') {
      body = <ManageCode onManage={(next) => remoteSync.manage(next)} />;
    } else if (canRegister && flow.manageView !== 'existing') {
      body = (
        <>
          <RegisterForm details={details} onRegister={onRegister} />
          <div className="sync-actions">
            <button
              type="button"
              className="sbtn-meta"
              onClick={() => setFlow({ ...flow, manageView: 'existing' })}
            >
              {t('settings.sync.haveCode')}
            </button>
          </div>
        </>
      );
    } else {
      body = (
        <>
          <ManageExisting remoteSync={remoteSync} />
          {canRegister && (
            <div className="sync-actions">
              <button
                type="button"
                className="sbtn-meta"
                onClick={() => setFlow({ ...flow, manageView: 'new' })}
              >
                {t('settings.sync.registerInstead')}
              </button>
            </div>
          )}
        </>
      );
    }
    return (
      <div className="sgrp">
        <RoleChooser role={choice} onChoose={(key) => setFlow({ ...flow, choice: key })} />
        {body}
        {choice === 'manage' && devNote}
        {/* For a masjid you list with its own sheet (docs, section A2). */}
        {source === 'sheet' && choice === 'manage' && (
          <div className="sync-actions" style={{ marginTop: 16 }}>
            <button type="button" className="sbtn-meta" onClick={onExportSheet}>
              {t('settings.sync.exportSheet')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Following or managing a masjid ──
  // Asked to manage the followed masjid: the passphrase first.
  const asking = wantManage && mode !== 'manage';
  const role = asking ? 'manage' : mode;
  const choose = (key) => {
    if (key === mode) {
      setWantManage(false);
      return;
    }
    if (key === 'manage') {
      if (source === 'cloudflare') remoteSync.manage();
      else setWantManage(true);
      return;
    }
    setWantManage(false);
    remoteSync.setMode(key);
  };

  const time = status.lastSync ? fmt12(new Date(status.lastSync), cityTz) : '';
  const statusText =
    status.phase === 'ok'
      ? fmtStr(t(status.live ? 'settings.sync.status.live' : 'settings.sync.status.ok'), { time })
      : t(`settings.sync.status.${status.phase}`);
  const page = typeof window !== 'undefined' ? window.location.href : '';
  const name = status.name || code;

  let about;
  if (asking) {
    about = ownSheet ? (
      <div style={noteStyle}>{t('settings.sync.about.ownSheet')}</div>
    ) : (
      <ManageExisting remoteSync={remoteSync} fixedCode={code} name={name} />
    );
  } else if (mode === 'manage') {
    about = (
      <>
        <div className="sync-next">
          {t(
            source === 'cloudflare'
              ? 'settings.sync.about.manageCloudflare'
              : 'settings.sync.about.manage'
          )}
        </div>
        {status.phase === 'notApproved' && (
          <div className="sync-next">{t('settings.sync.pendingManage')}</div>
        )}
      </>
    );
  } else {
    about = <div style={noteStyle}>{t(`settings.sync.about.${mode}`)}</div>;
  }

  return (
    <div className="sgrp">
      <RoleChooser role={role} onChoose={choose} />

      <div className="sync-current">
        <div className="sync-status" data-phase={status.phase}>
          <strong>{name}</strong>
          {status.name ? ` · ${code}` : ''}
          <span className="sync-status-text">{statusText}</span>
        </div>
        {about}
        {ownSheet && !asking && status.skipped > 0 && (
          <div style={noteStyle}>
            {fmtStr(t('settings.sync.skipped'), { n: String(status.skipped) })}
          </div>
        )}
      </div>

      <SectionTitle>{t('settings.sync.sectionShare')}</SectionTitle>
      <CopyLink label={t('settings.sync.linkFollow')} url={followLink(page, code, 'follow')} />
      <CopyLink label={t('settings.sync.linkScreen')} url={followLink(page, code, 'masjid')} />

      {mode === 'manage' && source === 'sheet' && (
        <>
          {lost ? (
            <RegisterForm onRegister={onRegister} again />
          ) : (
            <div className="sync-actions" style={{ marginTop: 16 }}>
              <button type="button" className="sbtn-meta" onClick={() => setLost(true)}>
                {t('settings.sync.forgot')}
              </button>
            </div>
          )}
        </>
      )}

      <div className="sync-actions" style={{ marginTop: 18 }}>
        {ownSheet && (
          <button type="button" className="sbtn-meta" onClick={onExportSheet}>
            {t('settings.sync.exportSheet')}
          </button>
        )}
        <button type="button" className="sbtn-meta" onClick={remoteSync.checkNow}>
          {t('settings.sync.checkNow')}
        </button>
        <button
          type="button"
          className="sbtn-meta"
          onClick={() => {
            setWantManage(false);
            setLost(false);
            remoteSync.setCode(null);
          }}
        >
          {t(mode === 'manage' ? 'settings.sync.stopManaging' : 'settings.sync.stop')}
        </button>
      </div>
    </div>
  );
}

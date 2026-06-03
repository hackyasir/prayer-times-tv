// ── Settings Panel ──────────────────────────────────────────────────────────
//
// The big editing overlay. Opens via the ⚙ Settings button in the footer.
// Tabbed layout — five tabs across the top organize the dozen+ settings:
//   1. Display       — Language, Theme, Display Size, Progress Style
//   2. Location      — City search, Masjid name
//   3. Prayer Times  — Calculation method, High-latitude rule, Asr method,
//                      Hijri date adjustment
//   4. Iqamah        — Per-prayer iqamah offsets, Jumu'ah congregations,
//                      Eid prayer congregations
//   5. Behaviour     — Prayer beep (chime), Blackout mode, Announcements
//
// Tab state is component-local (NOT persisted across sessions) — opening
// Settings always starts on the Display tab. Drafts still commit globally
// on Apply: switching tabs doesn't discard edits in the previous tab.
// Cancel closes the overlay; Apply commits drafts → applied + persists to
// localStorage. Sanitisation/clamping happens in the parent's applySettings.
//
// This component receives a large prop bag because the panel is tightly
// coupled to almost every settings field. Rather than refactor each input
// to read from context directly (which would mean rewriting all input
// handlers), we pass the existing draft state and setters through verbatim.
// The result: SettingsContext owns persistence + applied/drafts lifecycle;
// this component owns the form UI.

import { useEffect, useMemo, useState, useRef } from 'react';
import { THEMES } from '../../lib/themes.js';
import { METHOD_LABELS } from '../../lib/constants.js';
import { fmt12, addMins } from '../../lib/formatters.js';
import { toHijri } from '../../lib/hijri.js';
import { playBeep } from '../../lib/audio.js';
import { useT, fmtStr } from '../../i18n/I18nContext.jsx';
import { LANGUAGE_LABELS } from '../../i18n/I18nContext.jsx';
import { findNonAscendingSlot, buildOrderErrorMessage } from '../../lib/scheduleValidation.js';
import NumberStepper from '../NumberStepper.jsx';
import LogoUploader from './LogoUploader.jsx';

const TAB_ORDER = ['display', 'location', 'prayerTimes', 'iqamah', 'behaviour'];
const EXP_TOKEN = /^@(\d{4}-\d{2}-\d{2})$/;

function parseRawAnnouncements(raw) {
  const lines = (raw || '').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    const tokens = line.split(/\s+/);
    let urgent = false;
    let expiresOn = '';
    let cursor = 0;

    while (cursor < tokens.length) {
      const token = tokens[cursor];
      if (token === '!') {
        urgent = true;
        cursor += 1;
        continue;
      }
      const exp = token.match(EXP_TOKEN);
      if (exp) {
        expiresOn = exp[1];
        cursor += 1;
        continue;
      }
      break;
    }

    return {
      text: tokens.slice(cursor).join(' ').trim(),
      urgent,
      expiresOn,
    };
  });
}

function serializeAnnouncements(rows) {
  return (rows || [])
    .map((row) => {
      const text = (row?.text || '').trim();
      if (!text) return '';
      const parts = [];
      if (row?.urgent) parts.push('!');
      if (row?.expiresOn) parts.push(`@${row.expiresOn}`);
      parts.push(text);
      return parts.join(' ');
    })
    .filter(Boolean)
    .join('\n');
}

export default function SettingsPanel({
  // Lifecycle
  onCancel,
  onApply,
  // Draft state (all 12 persistent settings drafts)
  draftMethod,
  setDraftMethod,
  draftAsr,
  setDraftAsr,
  draftIqamah,
  setDraftIqamah,
  draftIqamahAutoCalc,
  setDraftIqamahAutoCalc,
  draftIqamahAutoBuffers,
  setDraftIqamahAutoBuffers,
  draftJumuah,
  setDraftJumuah,
  draftEidFitr,
  setDraftEidFitr,
  draftEidAdha,
  setDraftEidAdha,
  draftEidDays,
  setDraftEidDays,
  draftEidLocation,
  setDraftEidLocation,
  draftHijri,
  setDraftHijri,
  draftHighLat,
  setDraftHighLat,
  draftTheme,
  setDraftTheme,
  draftEcoMode,
  setDraftEcoMode,
  draftChimeAdhan,
  setDraftChimeAdhan,
  draftChimeIqamah,
  setDraftChimeIqamah,
  draftFontScale,
  setDraftFontScale,
  draftViewingMode,
  setDraftViewingMode,
  draftViewingDistance,
  setDraftViewingDistance,
  draftViewingCalibrated,
  setDraftViewingCalibrated,
  draftProgress,
  setDraftProgress,
  draftMasjid,
  setDraftMasjid,
  draftScreenLabel,
  setDraftScreenLabel,
  draftLogo,
  setDraftLogo,
  draftLang,
  setDraftLang,
  draftAutoAnnouncements,
  setDraftAutoAnnouncements,
  draftAnnouncements,
  setDraftAnnouncements,
  draftTickerMode,
  setDraftTickerMode,
  draftTickerStaticSeconds,
  setDraftTickerStaticSeconds,
  draftBlackoutEnabled,
  setDraftBlackoutEnabled,
  draftBlackoutDurations,
  setDraftBlackoutDurations,
  draftBlackoutOpacity,
  setDraftBlackoutOpacity,
  // City search state + handlers
  searchQuery,
  searchResults,
  searchStatus,
  onSearchInput,
  onSelectCity,
  onClearCity,
  selectedCity,
  // Geolocation handler
  onGeolocate,
  onExportSettings,
  onImportSettings,
  onResetSettings,
  onPrintSchedule,
  // City-time context — used for Hijri preview + Jumu'ah time displays
  cityNow,
  cityTz,
  currentLocName,
  currentLat,
  currentLng,
  // Today's prayer times — used by the iqamah offset preview ("Fajr 4:19 → 4:39")
  todayTimes,
}) {
  // NOTE: this component is now mounted conditionally by App.jsx only when
  // the settings dialog is visible, so hooks can run normally without a
  // visibility guard.
  const { t } = useT();
  const dialogRef = useRef(null);

  // Active tab — local component state. Resets to 'display' each time the
  // panel opens (the component unmounts when the dialog is closed).
  // Drafts persist across tab switches because they live in the parent.
  const [activeTab, setActiveTab] = useState('display');
  const tabButtonRefs = useRef([]);

  function handleTabKeyDown(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const lastIndex = TAB_ORDER.length - 1;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : event.key === 'ArrowRight'
            ? (index + 1) % TAB_ORDER.length
            : (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;

    setActiveTab(TAB_ORDER[nextIndex]);
    tabButtonRefs.current[nextIndex]?.focus();
  }

  useEffect(() => {
    tabButtonRefs.current[TAB_ORDER.indexOf(activeTab)]?.focus();
  }, [activeTab]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(node.querySelectorAll(focusableSelector));
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  // Hidden <input type="file"> used by the Import button — we click it
  // programmatically since the default file picker UI is ugly. `importMsg`
  // is the transient feedback message shown next to the buttons after an
  // import attempt (success or parse error). Auto-clears after 3 seconds.
  const fileInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null); // { ok: bool, text: str } | null
  const [announcementRows, setAnnouncementRows] = useState(() => {
    const parsed = parseRawAnnouncements(draftAnnouncements);
    return parsed.length ? parsed : [{ text: '', urgent: false, expiresOn: '' }];
  });

  // Reset confirmation — 2-click pattern to avoid accidental wipes. First
  // click puts the button into "confirm?" state; second click within 5s
  // commits. Timeout returns to safe state.
  const [resetConfirming, setResetConfirming] = useState(false);
  const resetTimeoutRef = useRef(null);

  function handleResetClick() {
    if (!resetConfirming) {
      setResetConfirming(true);
      resetTimeoutRef.current = setTimeout(() => setResetConfirming(false), 5000);
      return;
    }
    // Confirmed — clear timeout, call handler, exit confirm state
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    setResetConfirming(false);
    onResetSettings?.();
  }

  useEffect(() => {
    const parsed = parseRawAnnouncements(draftAnnouncements);
    const next = parsed.length ? parsed : [{ text: '', urgent: false, expiresOn: '' }];
    const curSerialized = serializeAnnouncements(announcementRows);
    const nextSerialized = serializeAnnouncements(next);
    if (curSerialized !== nextSerialized) {
      setAnnouncementRows(next);
    }
  }, [draftAnnouncements, announcementRows]);

  function updateAnnouncementRows(mutator) {
    const nextRows = mutator(announcementRows.map((row) => ({ ...row })));
    setAnnouncementRows(nextRows);
    setDraftAnnouncements(serializeAnnouncements(nextRows));
  }

  function addAnnouncementRow(afterIndex) {
    updateAnnouncementRows((rows) => {
      const at = Math.max(0, Math.min(rows.length, (afterIndex ?? rows.length - 1) + 1));
      rows.splice(at, 0, { text: '', urgent: false, expiresOn: '' });
      return rows;
    });
  }

  function removeAnnouncementRow(index) {
    if (announcementRows.length <= 1) {
      setAnnouncementRows([{ text: '', urgent: false, expiresOn: '' }]);
      setDraftAnnouncements('');
      return;
    }
    updateAnnouncementRows((rows) => {
      rows.splice(index, 1);
      return rows;
    });
  }

  function patchAnnouncementRow(index, patch) {
    updateAnnouncementRows((rows) => {
      rows[index] = { ...rows[index], ...patch };
      return rows;
    });
  }

  const announcementPreviewItems = useMemo(() => {
    const now = new Date();
    return announcementRows.map((row) => {
      let expired = false;
      if (row.expiresOn) {
        const [y, m, d] = row.expiresOn.split('-').map(Number);
        if ([y, m, d].every(Number.isFinite)) {
          const expiresAt = new Date(y, m - 1, d, 23, 59, 59, 999);
          expired = now > expiresAt;
        }
      }
      return { ...row, expired };
    });
  }, [announcementRows]);

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await onImportSettings?.(file);
    setImportMsg({
      ok,
      text: ok ? t('settings.import.ok') : t('settings.import.error'),
    });
    setTimeout(() => setImportMsg(null), 3000);
    // Reset the input so the same file can be re-picked
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Some local aliases to match the original variable names from App.jsx —
  // the inlined JSX below uses `setShowSett(false)` / `applySettings` /
  // `handleSearchInput` / `handleSelectCity` / `geolocate`. We bind those
  // to the corresponding prop-named callbacks here so we don't have to
  // touch the (large) JSX block.
  const setShowSett = () => onCancel();
  const validationErrors = useMemo(() => {
    const jumuahError = findNonAscendingSlot(draftJumuah);
    const eidFitrError = findNonAscendingSlot(draftEidFitr);
    const eidAdhaError = findNonAscendingSlot(draftEidAdha);
    return {
      jumuah: jumuahError ? buildOrderErrorMessage('Jumuah', jumuahError) : '',
      eidFitr: eidFitrError ? buildOrderErrorMessage('Eid ul-Fitr', eidFitrError) : '',
      eidAdha: eidAdhaError ? buildOrderErrorMessage('Eid ul-Adha', eidAdhaError) : '',
    };
  }, [draftJumuah, draftEidFitr, draftEidAdha]);

  const hasValidationErrors =
    Boolean(validationErrors.jumuah) ||
    Boolean(validationErrors.eidFitr) ||
    Boolean(validationErrors.eidAdha);

  const applySettings = () => {
    if (hasValidationErrors) return;
    onApply?.();
  };

  const handleSearchInput = onSearchInput;
  const handleSelectCity = onSelectCity;
  const geolocate = onGeolocate;

  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="sbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        {/* Fixed header with title + action buttons */}
        <div className="sbox-hdr">
          <div className="stitle" id="settings-dialog-title">
            {t('settings.title')}
          </div>
          <div className="sbtn-row">
            <button className="sbtn" onClick={() => setShowSett(false)}>
              {t('settings.cancel')}
            </button>
            <button
              className="sbtn pri"
              onClick={applySettings}
              disabled={hasValidationErrors}
              title={
                hasValidationErrors
                  ? validationErrors.jumuah || validationErrors.eidFitr || validationErrors.eidAdha
                  : ''
              }
            >
              {t('settings.apply')}
            </button>
          </div>
        </div>

        {/* Tab strip — horizontal navigation across the panel. Five tabs
              ordered by usage frequency: Display first (most-tweaked), then
              Location, Prayer Times, Iqamah, and Behaviour. On narrow widths
              the tab buttons wrap to a second row (flex-wrap in CSS). */}
        <div className="stab-strip" role="tablist" aria-label={t('settings.title')}>
          {TAB_ORDER.map((key, index) => {
            const label =
              key === 'display'
                ? t('settings.tab.display')
                : key === 'location'
                  ? t('settings.tab.location')
                  : key === 'prayerTimes'
                    ? t('settings.tab.prayerTimes')
                    : key === 'iqamah'
                      ? t('settings.tab.iqamah')
                      : t('settings.tab.behaviour');
            return (
            <button
              key={key}
              ref={(node) => {
                tabButtonRefs.current[index] = node;
              }}
              id={`settings-tab-${key}`}
              role="tab"
              aria-selected={activeTab === key}
              aria-controls="settings-panel"
              tabIndex={activeTab === key ? 0 : -1}
              className={'stab' + (activeTab === key ? ' active' : '')}
              onClick={() => setActiveTab(key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {label}
            </button>
          );})}
        </div>

        {/* Scrollable content */}
        <div className="sbox-body" id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
          {activeTab === 'display' && (
            <>
              {/* Language picker — first setting, since it changes everything else.
              `lang` is stored as a 2-letter ISO code ('en','ar','ur') in
              applied.lang. Changing it instantly retranslates the entire UI
              via I18nContext, and flips `dir` on <html> for Arabic/Urdu. */}
              <div className="sgrp">
                <label className="slbl">{t('settings.language')}</label>
                <select
                  className="ssel"
                  value={draftLang}
                  onChange={(e) => setDraftLang(e.target.value)}
                >
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'behaviour' && (
            <>
              {/* Announcements — newline-separated list shown in the bottom ticker.
              Empty string = ticker hidden entirely (default).
              Stays in whatever language the admin types — no per-language
              variants, to keep the authoring workflow simple. */}
              <div className="sgrp">
                <label className="slbl">{t('settings.announcements')}</label>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '10px 14px',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600 }}>
                      {t('settings.announcements.auto')}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                        lineHeight: 1.4,
                        maxWidth: '42ch',
                      }}
                    >
                      {t('settings.announcements.auto.note')}
                    </div>
                  </div>
                  <button
                    onClick={() => setDraftAutoAnnouncements((v) => !v)}
                    style={{
                      width: 46,
                      height: 24,
                      borderRadius: 12,
                      background: draftAutoAnnouncements ? 'var(--t-accent)' : '#333',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background .2s',
                      flexShrink: 0,
                    }}
                    aria-pressed={draftAutoAnnouncements}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: draftAutoAnnouncements ? 24 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .2s',
                      }}
                    />
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11,
                    color: 'var(--t-text-dim)',
                    letterSpacing: '.05em',
                    lineHeight: 1.4,
                  }}
                >
                  {t('settings.announcements.note')}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.1em',
                        marginBottom: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('settings.announcements.mode')}
                    </div>
                    <select
                      className="ssel"
                      value={draftTickerMode}
                      onChange={(e) => setDraftTickerMode(e.target.value)}
                    >
                      <option value="scroll">{t('settings.announcements.mode.scroll')}</option>
                      <option value="static">{t('settings.announcements.mode.static')}</option>
                    </select>
                  </div>

                  {draftTickerMode === 'static' && (
                    <div style={{ minWidth: 140 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--t-text-dim)',
                          letterSpacing: '.1em',
                          marginBottom: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('settings.announcements.staticSeconds')}
                      </div>
                      <NumberStepper
                        value={draftTickerStaticSeconds}
                        onChange={setDraftTickerStaticSeconds}
                        min={3}
                        max={30}
                        step={1}
                        width={72}
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 12,
                    fontSize: 11,
                    color: 'var(--t-text-dim)',
                    letterSpacing: '.03em',
                    lineHeight: 1.45,
                  }}
                >
                  {t('settings.announcements.format')}
                </div>

                <div className="ann-preview">
                  <div className="ann-preview-head">
                    <div className="ann-preview-title">{t('settings.announcements.previewEditable')}</div>
                    <button
                      type="button"
                      className="ann-preview-add"
                      onClick={() => addAnnouncementRow(announcementPreviewItems.length - 1)}
                      aria-label={t('settings.announcements.addRow')}
                      title={t('settings.announcements.addRow')}
                    >
                      +
                    </button>
                  </div>
                  {announcementPreviewItems.map((item, idx) => (
                    <div
                      key={`${idx}-${item.text}-${item.expiresOn}`}
                      className={`ann-editor-row${item.expired ? ' is-expired' : ''}`}
                    >
                      <div className="ann-row-meta">
                        <button
                          type="button"
                          className={`ann-icon-toggle${item.urgent ? ' is-on' : ''}`}
                          onClick={() => patchAnnouncementRow(idx, { urgent: !item.urgent })}
                          aria-label={t('settings.announcements.preview.urgent')}
                          title={t('settings.announcements.preview.urgent')}
                        >
                          !
                        </button>

                        <div className={`ann-expiry-wrap${item.expired ? ' is-expired' : ''}`}>
                          <span className="ann-expiry-icon">@</span>
                          <input
                            type="date"
                            className="ann-date ann-row-date"
                            value={item.expiresOn || ''}
                            onChange={(e) => patchAnnouncementRow(idx, { expiresOn: e.target.value })}
                            aria-label={t('settings.announcements.insertDate')}
                          />
                        </div>

                        <button
                          type="button"
                          className="ann-row-remove"
                          onClick={() => removeAnnouncementRow(idx)}
                          aria-label={t('settings.announcements.removeRow')}
                          title={t('settings.announcements.removeRow')}
                        >
                          ×
                        </button>
                      </div>

                      <input
                        className="sinput ann-row-input"
                        value={item.text}
                        placeholder={t('settings.announcements.placeholder')}
                        onChange={(e) => patchAnnouncementRow(idx, { text: e.target.value })}
                      />

                      <div className="ann-preview-tags">
                        {item.expiresOn && !item.expired && (
                          <span className="ann-tag">{fmtStr(t('settings.announcements.preview.expires'), { date: item.expiresOn })}</span>
                        )}
                        {item.expired && <span className="ann-tag ann-tag-expired">{t('settings.announcements.preview.expired')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'behaviour' && (
            <>
              {/* Blackout mode — global toggle + per-prayer durations.
              When enabled, the dashboard goes dark from `blackoutLeadSeconds`
              before each iqamah until the configured duration after. Defaults
              are sensible (10/10/10/7/12 minutes for Fajr/Dhuhr/Asr/Maghrib/Isha)
              and reflect typical mosque prayer lengths. */}
              <div className="sgrp">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '10px 14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600 }}>
                      {t('settings.blackout')}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                        lineHeight: 1.4,
                        maxWidth: '42ch',
                      }}
                    >
                      {t('settings.blackout.note')}
                    </div>
                  </div>
                  {/* Custom-styled toggle — same pattern as the chime toggle elsewhere */}
                  <button
                    onClick={() => setDraftBlackoutEnabled((v) => !v)}
                    style={{
                      width: 46,
                      height: 24,
                      borderRadius: 12,
                      background: draftBlackoutEnabled ? 'var(--t-accent)' : '#333',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background .2s',
                      flexShrink: 0,
                    }}
                    aria-pressed={draftBlackoutEnabled}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: draftBlackoutEnabled ? 24 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .2s',
                      }}
                    />
                  </button>
                </div>

                {/* Opacity slider — controls how dim the overlay is when active.
                0% = fully transparent (dashboard fully visible — defeats the
                purpose, but available for those who want it).
                100% = fully opaque (pure black, no dashboard visible).
                Default 85% matches industry standard for "dim mode" displays. */}
                {draftBlackoutEnabled && (
                  <div style={{ marginTop: 8 }}>
                    <label className="slbl">{t('settings.blackout.opacity')}</label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: '#111',
                        border: '1px solid rgba(201,168,76,.15)',
                        borderRadius: 4,
                        padding: '8px 12px',
                      }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={draftBlackoutOpacity}
                        onChange={(e) => setDraftBlackoutOpacity(Number(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--t-accent)', cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          width: 48,
                          textAlign: 'right',
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#F0C96A',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {draftBlackoutOpacity}%
                      </span>
                    </div>
                    {/* Live preview swatch — shows roughly what the overlay will
                    look like at the chosen opacity. The swatch sits on a
                    "checkerboard" background (built via gradients) so the
                    transparency is visually clear at low values. */}
                    <div
                      style={{
                        marginTop: 8,
                        height: 32,
                        borderRadius: 4,
                        overflow: 'hidden',
                        border: '1px solid rgba(201,168,76,.15)',
                        background:
                          'repeating-linear-gradient(45deg, #222 0 8px, #2c2c2c 8px 16px)',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: `rgba(0,0,0,${draftBlackoutOpacity / 100})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'Amiri, serif',
                          fontSize: 14,
                          color: 'rgba(201, 168, 76, 0.55)',
                          letterSpacing: '.04em',
                        }}
                      >
                        بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-prayer durations — visible only when blackout is enabled */}
                {draftBlackoutEnabled && (
                  <div style={{ marginTop: 8 }}>
                    <label className="slbl">{t('settings.blackout.duration')}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((key) => (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: '#111',
                            border: '1px solid rgba(201,168,76,.15)',
                            borderRadius: 4,
                            padding: '7px 12px',
                          }}
                        >
                          <span
                            style={{
                              width: 62,
                              fontSize: 13,
                              color: '#9A8B6E',
                              letterSpacing: '.08em',
                              textTransform: 'uppercase',
                              flexShrink: 0,
                            }}
                          >
                            {t(`prayer.${key}`)}
                          </span>
                          <NumberStepper
                            value={draftBlackoutDurations[key]}
                            onChange={(v) =>
                              setDraftBlackoutDurations((prev) => ({ ...prev, [key]: v }))
                            }
                            min={0}
                            max={60}
                            step={5}
                            width={56}
                          />
                          <span
                            style={{ fontSize: 11, color: 'rgba(201,168,76,.4)', flexShrink: 0 }}
                          >
                            {t('unit.min')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'display' && (
            <>
              {/* Theme picker */}
              <div className="sgrp">
                <label className="slbl">{t('settings.theme')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {Object.entries(THEMES).map(([key, theme]) => {
                    const active = draftTheme === key;
                    const [bg, acc, txt] = theme.preview;
                    return (
                      <button
                        key={key}
                        onClick={() => setDraftTheme(key)}
                        style={{
                          background: bg,
                          border: `2px solid ${active ? acc : 'rgba(255,255,255,.1)'}`,
                          borderRadius: 6,
                          padding: '8px 6px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'border-color .2s',
                          outline: 'none',
                        }}
                      >
                        {/* Colour swatches */}
                        <div
                          style={{
                            display: 'flex',
                            gap: 3,
                            justifyContent: 'center',
                            marginBottom: 5,
                          }}
                        >
                          {[bg, acc, txt].map((c, i) => (
                            <div
                              key={i}
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: c,
                                border: '1px solid rgba(255,255,255,.15)',
                              }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: active ? acc : 'rgba(255,255,255,.5)',
                            fontFamily: 'Rajdhani,sans-serif',
                            letterSpacing: '.05em',
                            fontWeight: active ? 700 : 400,
                          }}
                        >
                          {theme.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sgrp">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '10px 14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600 }}>
                      {t('settings.eco')}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                        lineHeight: 1.4,
                        maxWidth: '42ch',
                      }}
                    >
                      {t('settings.eco.note')}
                    </div>
                  </div>
                  <button
                    onClick={() => setDraftEcoMode((v) => !v)}
                    style={{
                      width: 46,
                      height: 24,
                      borderRadius: 12,
                      background: draftEcoMode ? 'var(--t-accent)' : '#333',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background .2s',
                      flexShrink: 0,
                    }}
                    aria-pressed={draftEcoMode}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: draftEcoMode ? 24 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .2s',
                      }}
                    />
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'display' && (
            <>
              {/* Font size scale */}
              <div className="sgrp">
                <label className="slbl">{t('settings.size')}</label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '12px 14px',
                  }}
                >
                  <input
                    type="range"
                    min={70}
                    max={130}
                    step={1}
                    value={draftFontScale}
                    onChange={(e) => setDraftFontScale(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--t-accent)', cursor: 'pointer' }}
                    aria-label={t('settings.size')}
                  />
                  <div style={{ minWidth: 92, textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 16,
                        color: 'var(--t-text)',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {draftFontScale}%
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                      }}
                    >
                      {draftFontScale === 100
                        ? t('settings.size.default')
                        : draftFontScale < 100
                          ? t('settings.size.smaller')
                          : t('settings.size.larger')}
                    </div>
                  </div>
                  {draftFontScale !== 100 && (
                    <button
                      onClick={() => setDraftFontScale(100)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--t-border)',
                        borderRadius: 4,
                        padding: '5px 10px',
                        color: 'var(--t-text-dim)',
                        fontFamily: 'Rajdhani,sans-serif',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '.08em',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {t('settings.size.reset')}
                    </button>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11,
                    color: 'var(--t-text-dim)',
                    letterSpacing: '.05em',
                  }}
                >
                  {t('settings.size.note')}
                </div>
              </div>

              {/* ── Viewing distance / legibility ──────────────────────────
                  Three ways to scale type for distance. Manual = slider only.
                  Distance = one-tap "how far is the furthest viewer". Calibrate
                  = walk to the far point and tune by eye. All feed one global
                  multiplier combined with the font-size slider above. */}
              <div className="sgrp">
                <label className="slbl">{t('settings.viewing')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { key: 'manual', label: t('settings.viewing.manual') },
                    { key: 'distance', label: t('settings.viewing.distance') },
                    { key: 'calibrate', label: t('settings.viewing.calibrate') },
                  ].map((opt) => {
                    const on = (draftViewingMode || 'manual') === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setDraftViewingMode(opt.key)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: 4,
                          border: `1px solid ${on ? 'var(--t-accent)' : 'var(--t-border)'}`,
                          background: on ? 'rgba(var(--t-accent-rgb),.12)' : 'transparent',
                          color: on ? 'var(--t-accent)' : 'var(--t-text)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        aria-pressed={on}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Distance picker — four buckets the admin recognises instantly */}
                {draftViewingMode === 'distance' && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    {[
                      { key: 'close', label: t('settings.viewing.close'), ft: '~15 ft' },
                      { key: 'medium', label: t('settings.viewing.medium'), ft: '~30 ft' },
                      { key: 'large', label: t('settings.viewing.large'), ft: '~50 ft' },
                      { key: 'grand', label: t('settings.viewing.grand'), ft: '~80 ft' },
                    ].map((opt) => {
                      const on = (draftViewingDistance || 'medium') === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setDraftViewingDistance(opt.key)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderRadius: 4,
                            border: `1px solid ${on ? 'var(--t-accent)' : 'var(--t-border)'}`,
                            background: on ? 'rgba(var(--t-accent-rgb),.12)' : '#111',
                            color: on ? 'var(--t-accent)' : 'var(--t-text)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          aria-pressed={on}
                        >
                          <span>{opt.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--t-text-dim)' }}>{opt.ft}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Calibrate — big sample word + bigger/smaller, tune by eye */}
                {draftViewingMode === 'calibrate' && (
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        background: '#000',
                        border: '1px solid var(--t-border)',
                        borderRadius: 4,
                        padding: '18px 12px',
                        textAlign: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          fontSize: `${(draftViewingCalibrated || 1) * 28}px`,
                          fontWeight: 700,
                          color: 'var(--t-accent)',
                          lineHeight: 1.1,
                          letterSpacing: '.02em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        FAJR 4:45
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.04em',
                        lineHeight: 1.4,
                      }}
                    >
                      {t('settings.viewing.calibrate.note')}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: '#111',
                        border: '1px solid var(--t-border)',
                        borderRadius: 4,
                        padding: '12px 14px',
                      }}
                    >
                      <input
                        type="range"
                        min={80}
                        max={300}
                        step={1}
                        value={Math.round((draftViewingCalibrated || 1) * 100)}
                        onChange={(e) =>
                          setDraftViewingCalibrated(Number(e.target.value) / 100)
                        }
                        style={{ flex: 1, accentColor: 'var(--t-accent)', cursor: 'pointer' }}
                        aria-label={t('settings.viewing.calibrate')}
                      />
                      <div
                        style={{
                          minWidth: 56,
                          textAlign: 'right',
                          fontSize: 16,
                          fontWeight: 700,
                          color: 'var(--t-text)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {Math.round((draftViewingCalibrated || 1) * 100)}%
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11,
                    color: 'var(--t-text-dim)',
                    letterSpacing: '.05em',
                    lineHeight: 1.4,
                  }}
                >
                  {t('settings.viewing.note')}
                </div>
              </div>
            </>
          )}

          {activeTab === 'display' && (
            <>
              <div className="sgrp">
                <label className="slbl">{t('settings.progressStyle')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    {
                      key: 'ring',
                      label: t('settings.progress.ring'),
                      desc: t('settings.progress.ring.sub'),
                    },
                    {
                      key: 'daybar',
                      label: t('settings.progress.daybar'),
                      desc: t('settings.progress.daybar.sub'),
                    },
                    {
                      key: 'moon',
                      label: t('settings.progress.moon'),
                      desc: t('settings.progress.moon.sub'),
                    },
                    {
                      key: 'line',
                      label: t('settings.progress.line'),
                      desc: t('settings.progress.line.sub'),
                    },
                    {
                      key: 'hero',
                      label: t('settings.progress.hero'),
                      desc: t('settings.progress.hero.sub'),
                    },
                    {
                      key: 'orbit',
                      label: t('settings.progress.orbit'),
                      desc: t('settings.progress.orbit.sub'),
                    },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setDraftProgress(opt.key)}
                      style={{
                        background:
                          draftProgress === opt.key
                            ? 'rgba(var(--t-accent-rgb),.18)'
                            : 'transparent',
                        border: `1px solid ${draftProgress === opt.key ? 'var(--t-border-hi)' : 'var(--t-border)'}`,
                        borderRadius: 4,
                        padding: '10px 6px',
                        color: draftProgress === opt.key ? 'var(--t-accent-hi)' : 'var(--t-text)',
                        fontFamily: 'Rajdhani,sans-serif',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '.05em',
                        cursor: 'pointer',
                        transition: 'all .15s',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</div>
                      <div
                        style={{
                          fontSize: 9,
                          color: 'var(--t-text-dim)',
                          marginTop: 2,
                          letterSpacing: '.03em',
                        }}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11,
                    color: 'var(--t-text-dim)',
                    letterSpacing: '.05em',
                  }}
                >
                  Visual indicator between "Next Prayer" and the countdown.
                </div>
              </div>
            </>
          )}

          {activeTab === 'display' && (
            <>
              {/* Print Monthly Schedule — opens a separate full-page view with
               * the whole month's prayer times formatted for paper. Clicking
               * this closes Settings and swaps the live dashboard for the
               * printable view. The printable view has its own back button. */}
              <div className="sgrp">
                <label className="slbl">Monthly Schedule</label>
                <button
                  type="button"
                  className="sbtn pri"
                  onClick={() => onPrintSchedule?.()}
                  style={{ width: '100%' }}
                >
                  🖨 Open Printable Monthly Schedule
                </button>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11,
                    color: 'var(--t-text-dim)',
                    letterSpacing: '.05em',
                  }}
                >
                  Generates a printable table of the entire month's prayer times, suitable for
                  posting on the wall or distributing to visitors.
                </div>
              </div>
            </>
          )}

          {activeTab === 'behaviour' && (
            <>
              {/* Prayer beeps — split into adhan + iqamah, each independently
              toggleable. A test button at the top plays the sound once so
              the admin can verify volume. Most mosques want iqamah ON
              (the "stand up" cue) and adhan OFF (real adhan plays from
              speakers anyway). */}
              <div className="sgrp">
                {/* Section header with overall label + Test button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 7,
                  }}
                >
                  <label className="slbl" style={{ margin: 0 }}>
                    {t('settings.beep')}
                  </label>
                  <button
                    onClick={() => playBeep()}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--t-border)',
                      borderRadius: 4,
                      padding: '5px 10px',
                      color: 'var(--t-accent)',
                      fontFamily: 'Rajdhani,sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '.08em',
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = 'rgba(var(--t-accent-rgb),.1)')
                    }
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    🔔 {t('settings.beep.test')}
                  </button>
                </div>
                {/* Adhan toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '10px 14px',
                    marginBottom: 6,
                  }}
                >
                  <button
                    onClick={() => setDraftChimeAdhan((v) => !v)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      background: draftChimeAdhan ? 'var(--t-accent)' : '#333',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background .2s',
                    }}
                    aria-pressed={draftChimeAdhan}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: draftChimeAdhan ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .2s',
                      }}
                    />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600 }}>
                      {t('settings.beep.adhan')}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                      }}
                    >
                      {t('settings.beep.adhan.desc')}
                    </div>
                  </div>
                </div>
                {/* Iqamah toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '10px 14px',
                  }}
                >
                  <button
                    onClick={() => setDraftChimeIqamah((v) => !v)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      background: draftChimeIqamah ? 'var(--t-accent)' : '#333',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'background .2s',
                    }}
                    aria-pressed={draftChimeIqamah}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: draftChimeIqamah ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .2s',
                      }}
                    />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600 }}>
                      {t('settings.beep.iqamah')}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                      }}
                    >
                      {t('settings.beep.iqamah.desc')}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'location' && (
            <>
              {/* Masjid name */}
              <div className="sgrp">
                <label className="slbl">{t('settings.masjidName')}</label>
                <input
                  className="sinput"
                  type="text"
                  placeholder={t('settings.masjidName.placeholder')}
                  value={draftMasjid}
                  onChange={(e) => setDraftMasjid(e.target.value)}
                  maxLength={60}
                />
                {draftMasjid && (
                  <div
                    style={{ marginTop: 5, fontSize: 11, color: '#9A8B6E', letterSpacing: '.05em' }}
                  >
                    Shown in header · leave blank to show "Prayer Times"
                  </div>
                )}
              </div>

              {/* Screen label — optional per-screen subtitle. Replaces the
                  "Prayer Times · Digital Display" line. Useful when one masjid
                  runs several screens (Main Hall, Women's Section, etc.). */}
              <div className="sgrp">
                <label className="slbl">{t('settings.screenLabel')}</label>
                <input
                  className="sinput"
                  type="text"
                  placeholder={t('settings.screenLabel.placeholder')}
                  value={draftScreenLabel}
                  onChange={(e) => setDraftScreenLabel(e.target.value)}
                  maxLength={60}
                />
                <div
                  style={{ marginTop: 5, fontSize: 11, color: '#9A8B6E', letterSpacing: '.05em' }}
                >
                  {t('settings.screenLabel.note')}
                </div>
              </div>

              {/* Mosque logo upload — optional branding.
               * Reads the picked file via FileReader → base64 string, then
               * stores it in `draftLogo`. The handler enforces a 100 KB cap to
               * keep localStorage usage modest; larger files are rejected with
               * a small inline warning rather than silently truncated. */}
              <div className="sgrp">
                <label className="slbl">Mosque Logo (optional)</label>
                <LogoUploader value={draftLogo} onChange={setDraftLogo} />
              </div>
            </>
          )}

          {activeTab === 'location' && (
            <>
              {/* City search */}
              <div className="sgrp">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 7,
                  }}
                >
                  <label className="slbl" style={{ margin: 0 }}>
                    {t('settings.searchCity')}
                  </label>
                  <button
                    onClick={geolocate}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--t-border)',
                      borderRadius: 4,
                      padding: '4px 10px',
                      color: 'var(--t-accent)',
                      fontFamily: 'Rajdhani,sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '.08em',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background .2s',
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = 'rgba(var(--t-accent-rgb),.1)')
                    }
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    📍 {t('settings.useMyLocation')}
                  </button>
                </div>
                {/* Search input — always rendered so the admin can refine their pick.
                Picking a city from the dropdown sets `selectedCity` (parent state)
                but does NOT clear this input — it stays for context. */}
                <input
                  className="sinput"
                  type="text"
                  placeholder={t('settings.searchCity.placeholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                />
                <div className="search-results">
                  {searchStatus === 'searching' && (
                    <div className="search-status">{t('settings.searchCity.searching')}</div>
                  )}
                  {searchStatus === 'empty' && (
                    <div className="search-status">{t('settings.searchCity.empty')}</div>
                  )}
                  {searchStatus === 'error' && (
                    <div className="search-status">{t('settings.searchCity.error')}</div>
                  )}
                  {searchResults.map((r) => (
                    <div key={r.id} className="search-item" onClick={() => handleSelectCity(r)}>
                      <div className="search-item-name">{r.name}</div>
                      <div className="search-item-sub">
                        {[r.admin1, r.country].filter(Boolean).join(', ')}
                        {r.tz ? ` · ${r.tz}` : ''}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Location summary card — ALWAYS shown below the search.
                When `selectedCity` is set (new pick pending Apply): gold accent,
                shows the SELECTED city.
                Otherwise: dimmer chrome, shows the CURRENTLY APPLIED location.
                This gives the admin clear context: "I'm currently configured
                for X; here's what I'd switch to if I click Apply." */}
                <div className="loc-summary" data-pending={selectedCity ? 'true' : 'false'}>
                  <div className="loc-summary-text">
                    <div className="loc-summary-label">
                      {selectedCity ? t('settings.city.selected') : t('settings.city.current')}
                    </div>
                    {selectedCity ? (
                      <>
                        <div className="loc-summary-name">📍 {selectedCity.name}</div>
                        <div className="loc-summary-sub">
                          {[selectedCity.admin1, selectedCity.country].filter(Boolean).join(', ')}
                          {' · '}
                          {selectedCity.lat.toFixed(3)}°N {selectedCity.lng.toFixed(3)}°E
                          {selectedCity.tz ? ` · ${selectedCity.tz}` : ''}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="loc-summary-name">📍 {currentLocName}</div>
                        <div className="loc-summary-sub">
                          {currentLat != null && currentLng != null && (
                            <>
                              {currentLat.toFixed(3)}°N {currentLng.toFixed(3)}°E
                            </>
                          )}
                          {cityTz && ` · ${cityTz}`}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Clear button visible only when a new city is pending. Clearing
                  cancels the pending change; current applied location is then
                  shown again. */}
                  {selectedCity && (
                    <button className="search-clear" onClick={onClearCity}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'prayerTimes' && (
            <>
              <div className="sgrp">
                <label className="slbl">{t('settings.method')}</label>
                <select
                  className="ssel"
                  value={draftMethod}
                  onChange={(e) => setDraftMethod(e.target.value)}
                >
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'prayerTimes' && (
            <>
              {/* High-latitude rule — for cities above ~48° (Stockholm, Edmonton,
              etc) where the sun doesn't dip 18° below the horizon in summer.
              Has no observable effect below ~48° latitude — fine to leave at
              the default. */}
              <div className="sgrp">
                <label className="slbl">{t('settings.highLat')}</label>
                <select
                  className="ssel"
                  value={draftHighLat}
                  onChange={(e) => setDraftHighLat(e.target.value)}
                >
                  <option value="middleOfNight">{t('settings.highLat.middle')}</option>
                  <option value="seventhOfNight">{t('settings.highLat.seventh')}</option>
                  <option value="twilightAngle">{t('settings.highLat.angle')}</option>
                </select>
                <div
                  style={{
                    fontSize: 11,
                    color: '#9A8B6E',
                    marginTop: 6,
                    letterSpacing: '.04em',
                    lineHeight: 1.4,
                  }}
                >
                  Only matters above ~48° latitude in summer, when the sun doesn't dip far enough
                  below the horizon for standard Fajr/Isha angles.
                </div>
              </div>
            </>
          )}

          {activeTab === 'prayerTimes' && (
            <>
              {/* Hijri date adjustment */}
              <div className="sgrp">
                <label className="slbl">{t('settings.hijri')}</label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#111',
                    border: '1px solid rgba(201,168,76,.15)',
                    borderRadius: 4,
                    padding: '10px 14px',
                  }}
                >
                  <button
                    onClick={() => setDraftHijri((v) => Math.max(-3, Number(v) - 1))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      border: '1px solid rgba(201,168,76,.3)',
                      background: 'transparent',
                      color: '#C9A84C',
                      fontSize: 18,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    −
                  </button>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#F0C96A',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Number(draftHijri) === 0
                        ? '0'
                        : Number(draftHijri) > 0
                          ? `+${draftHijri}`
                          : draftHijri}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#9A8B6E',
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        marginTop: 2,
                      }}
                    >
                      {Number(draftHijri) === 0
                        ? t('settings.hijri.none')
                        : fmtStr(
                          t(
                            Number(draftHijri) > 0 ? 'settings.hijri.fwd' : 'settings.hijri.back'
                          ),
                          {
                            days: Math.abs(Number(draftHijri)),
                            plural: Math.abs(Number(draftHijri)) !== 1 ? 's' : '',
                          }
                        )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDraftHijri((v) => Math.min(3, Number(v) + 1))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      border: '1px solid rgba(201,168,76,.3)',
                      background: 'transparent',
                      color: '#C9A84C',
                      fontSize: 18,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    +
                  </button>
                </div>
                <div
                  style={{ marginTop: 5, fontSize: 11, color: '#9A8B6E', letterSpacing: '.05em' }}
                >
                  {t('settings.hijri.preview')}{' '}
                  {(() => {
                    const d = new Date(cityNow);
                    d.setDate(d.getDate() + Number(draftHijri));
                    return toHijri(d);
                  })()}
                </div>
              </div>
            </>
          )}

          {activeTab === 'prayerTimes' && (
            <>
              <div className="sgrp">
                <label className="slbl">{t('settings.asrMethod')}</label>
                <select
                  className="ssel"
                  value={draftAsr}
                  onChange={(e) => setDraftAsr(e.target.value)}
                >
                  <option value="Standard">{t('settings.asr.standard')}</option>
                  <option value="Hanafi">{t('settings.asr.hanafi')}</option>
                </select>
              </div>
            </>
          )}
          {activeTab === 'iqamah' && (
            <>
              {/* Auto-iqamah toggle + per-prayer buffers.
              When enabled, iqamah times are computed daily from adhan +
              buffer minutes, rounded to the NEAREST quarter-hour, with a
              safety floor (iqamah never before adhan). When the toggle is
              OFF, the manual "Iqamah Offset" section below is active. When
              ON, manual offsets are hidden (avoids confusion). */}
              <div className="sgrp">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#111',
                    border: '1px solid var(--t-border)',
                    borderRadius: 4,
                    padding: '10px 14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--t-text)', fontWeight: 600 }}>
                      {t('settings.iqamahAuto')}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t-text-dim)',
                        letterSpacing: '.05em',
                        marginTop: 2,
                        lineHeight: 1.4,
                        maxWidth: '48ch',
                      }}
                    >
                      {t('settings.iqamahAuto.note')}
                    </div>
                  </div>
                  <button
                    onClick={() => setDraftIqamahAutoCalc((v) => !v)}
                    style={{
                      width: 46,
                      height: 24,
                      borderRadius: 12,
                      background: draftIqamahAutoCalc ? 'var(--t-accent)' : '#333',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background .2s',
                      flexShrink: 0,
                    }}
                    aria-pressed={draftIqamahAutoCalc}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: draftIqamahAutoCalc ? 24 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .2s',
                      }}
                    />
                  </button>
                </div>

                {/* Per-prayer buffer inputs — visible only when auto is enabled.
                Each row shows: prayer name, today's adhan time, buffer +
                minutes input, computed iqamah preview (rounded to quarter). */}
                {draftIqamahAutoCalc &&
                  (() => {
                    // Defensive default — if a user upgraded from a build before
                    // iqamahAutoBuffers existed in DEFAULTS, the field may be
                    // briefly undefined on first render. Fall back to sensible
                    // values so the inputs always render.
                    const buffers = draftIqamahAutoBuffers || {
                      fajr: 30,
                      dhuhr: 15,
                      asr: 15,
                      maghrib: 0,
                      isha: 10,
                    };
                    return (
                      <div style={{ marginTop: 8 }}>
                        <label className="slbl">{t('settings.iqamahAuto.buffer')}</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((key) => {
                            const adhanTime = todayTimes[key];
                            const buf = Math.min(60, Math.max(0, Number(buffers[key]) || 0));
                            // Preview — MUST match App.jsx's effective-iqamah memo
                            // logic exactly. Rule: nearest quarter-hour, floored at
                            // adhan (iqamah can never be before adhan). Special case
                            // buf=0 → iqamah=adhan exactly.
                            let previewIqamah = null;
                            if (adhanTime) {
                              if (buf === 0) {
                                previewIqamah = adhanTime;
                              } else {
                                const target = new Date(adhanTime.getTime() + buf * 60 * 1000);
                                target.setSeconds(0, 0);
                                const totalMin = target.getHours() * 60 + target.getMinutes();
                                let roundedMin = Math.round(totalMin / 15) * 15;
                                const rounded = new Date(target);
                                rounded.setHours(0, 0, 0, 0);
                                rounded.setMinutes(roundedMin);
                                // Floor: if nearest-rounding put iqamah before adhan,
                                // bump forward to next quarter-hour ≥ adhan.
                                while (rounded < adhanTime) {
                                  roundedMin += 15;
                                  rounded.setHours(0, 0, 0, 0);
                                  rounded.setMinutes(roundedMin);
                                }
                                previewIqamah = rounded;
                              }
                            }
                            return (
                              <div
                                key={key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  background: '#111',
                                  border: '1px solid rgba(201,168,76,.15)',
                                  borderRadius: 4,
                                  padding: '7px 12px',
                                }}
                              >
                                <span
                                  style={{
                                    width: 62,
                                    fontSize: 13,
                                    color: '#9A8B6E',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                    flexShrink: 0,
                                  }}
                                >
                                  {t(`prayer.${key}`)}
                                </span>
                                <span
                                  style={{
                                    width: 72,
                                    fontSize: 14,
                                    color: '#F5EDD8',
                                    fontVariantNumeric: 'tabular-nums',
                                    flexShrink: 0,
                                  }}
                                >
                                  {adhanTime ? fmt12(adhanTime, cityTz) : '--:--'}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'rgba(201,168,76,.4)',
                                    flexShrink: 0,
                                  }}
                                >
                                  +
                                </span>
                                <NumberStepper
                                  value={buffers[key] ?? 0}
                                  onChange={(v) =>
                                    setDraftIqamahAutoBuffers((prev) => ({
                                      ...(prev || {}),
                                      [key]: v,
                                    }))
                                  }
                                  min={0}
                                  max={60}
                                  step={5}
                                  width={40}
                                />
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'rgba(201,168,76,.4)',
                                    flexShrink: 0,
                                  }}
                                >
                                  {t('unit.min')}
                                </span>
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: 'rgba(201,168,76,.3)',
                                    flexShrink: 0,
                                  }}
                                >
                                  →
                                </span>
                                <span
                                  style={{
                                    flex: 1,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: '#C9A84C',
                                    fontVariantNumeric: 'tabular-nums',
                                    textAlign: 'right',
                                  }}
                                >
                                  {previewIqamah ? fmt12(previewIqamah, cityTz) : '--:--'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </>
          )}

          {activeTab === 'iqamah' && !draftIqamahAutoCalc && (
            <>
              {/* Iqamah offsets — manual mode. Hidden when auto is on. */}
              <div className="sgrp">
                <label className="slbl">{t('settings.iqamahOffset')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((key) => {
                    const label = t(`prayer.${key}`);
                    const adhanTime = todayTimes[key];
                    const offsetMins = Math.min(60, Math.max(0, Number(draftIqamah[key]) || 0));
                    const iqamahTime = adhanTime ? addMins(adhanTime, offsetMins) : null;
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#111',
                          border: '1px solid rgba(201,168,76,.15)',
                          borderRadius: 4,
                          padding: '7px 12px',
                        }}
                      >
                        {/* Prayer name */}
                        <span
                          style={{
                            width: 62,
                            fontSize: 13,
                            color: '#9A8B6E',
                            letterSpacing: '.08em',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}
                        >
                          {label}
                        </span>
                        {/* Adhan time */}
                        <span
                          style={{
                            width: 72,
                            fontSize: 14,
                            color: '#F5EDD8',
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0,
                          }}
                        >
                          {adhanTime ? fmt12(adhanTime, cityTz) : '--:--'}
                        </span>
                        {/* Offset input — step=1 so admins can dial in exact
                        minutes (e.g. 18 to go from 4:12 → 4:30). Auto mode
                        uses larger steps + rounding; manual mode is for
                        precision. */}
                        <span style={{ fontSize: 11, color: 'rgba(201,168,76,.4)', flexShrink: 0 }}>
                          +
                        </span>
                        <NumberStepper
                          value={draftIqamah[key]}
                          onChange={(v) => setDraftIqamah((prev) => ({ ...prev, [key]: v }))}
                          min={0}
                          max={60}
                          step={1}
                          width={40}
                        />
                        <span style={{ fontSize: 11, color: 'rgba(201,168,76,.4)', flexShrink: 0 }}>
                          {t('unit.min')}
                        </span>
                        {/* Arrow + resulting iqamah time */}
                        <span style={{ fontSize: 13, color: 'rgba(201,168,76,.3)', flexShrink: 0 }}>
                          →
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 15,
                            fontWeight: 700,
                            color: '#C9A84C',
                            fontVariantNumeric: 'tabular-nums',
                            textAlign: 'right',
                          }}
                        >
                          {iqamahTime ? fmt12(iqamahTime, cityTz) : '--:--'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'iqamah' && (
            <>
              {/* Jumu'ah congregations (single time per slot) */}
              <div className="sgrp">
                <label className="slbl">{t('settings.jumuah')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {draftJumuah.map((j, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#111',
                        border: `1px solid ${j.enabled ? 'rgba(61,200,120,.3)' : 'rgba(201,168,76,.1)'}`,
                        borderRadius: 4,
                        padding: '8px 10px',
                      }}
                    >
                      {/* Enable toggle */}
                      <button
                        onClick={() =>
                          setDraftJumuah((prev) =>
                            prev.map((x, xi) => (xi === i ? { ...x, enabled: !x.enabled } : x))
                          )
                        }
                        style={{
                          width: 28,
                          height: 16,
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          background: j.enabled ? '#3DC878' : '#333',
                          position: 'relative',
                          flexShrink: 0,
                          transition: 'background .2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: j.enabled ? 14 : 2,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#fff',
                            transition: 'left .2s',
                          }}
                        />
                      </button>
                      <span
                        style={{
                          fontSize: 12,
                          color: j.enabled ? '#3DC878' : '#9A8B6E',
                          letterSpacing: '.1em',
                          textTransform: 'uppercase',
                          width: 28,
                        }}
                      >
                        {['1st', '2nd', '3rd', '4th'][i] || i + 1 + 'th'}
                      </span>
                      {/* Time picker */}
                      <input
                        type="time"
                        value={j.time}
                        disabled={!j.enabled}
                        onChange={(e) =>
                          setDraftJumuah((prev) =>
                            prev.map((x, xi) => (xi === i ? { ...x, time: e.target.value } : x))
                          )
                        }
                        style={{
                          background: '#0A0A0A',
                          border: '1px solid rgba(201,168,76,.25)',
                          borderRadius: 3,
                          padding: '4px 8px',
                          color: j.enabled ? '#F0C96A' : '#555',
                          fontFamily: 'Rajdhani,sans-serif',
                          fontSize: 15,
                          fontWeight: 700,
                          outline: 'none',
                          flex: 1,
                          opacity: j.enabled ? 1 : 0.4,
                          colorScheme: 'dark',
                        }}
                      />
                    </div>
                  ))}
                </div>
                {validationErrors.jumuah && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#ff7c7c', lineHeight: 1.4 }}>
                    {validationErrors.jumuah}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'iqamah' && (
            <>
              {/* Eid prayers — separate Fitr / Adha schedules.
              Auto-detection via Hijri calendar picks which one's active
              when Eid approaches; no manual toggle needed. Each schedule
              has 3 slot rows — leave `time` blank to skip that slot. */}
              <div className="sgrp">
                <label className="slbl">{t('settings.eid')}</label>

                {/* Days-before-Eid banner setting */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                    background: '#111',
                    border: '1px solid rgba(201,168,76,.12)',
                    borderRadius: 4,
                    padding: '8px 12px',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13, color: '#9A8B6E', letterSpacing: '.06em' }}>
                    {t('settings.eid.banner')}
                  </span>
                  <NumberStepper
                    value={draftEidDays}
                    onChange={(v) => setDraftEidDays(v)}
                    min={0}
                    max={30}
                    step={1}
                    width={44}
                  />
                  <span style={{ fontSize: 11, color: '#9A8B6E', flexShrink: 0 }}>
                    {t('unit.days')}
                  </span>
                </div>

                {/* Optional Eid venue/address — e.g. when Eid prayer is held
                    at a community center rather than the masjid. Shown in the
                    Eid banner and auto-announcements when set. */}
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: '#9A8B6E',
                      letterSpacing: '.06em',
                      marginBottom: 6,
                    }}
                  >
                    {t('settings.eid.location')}
                  </label>
                  <input
                    type="text"
                    value={draftEidLocation}
                    onChange={(e) => setDraftEidLocation(e.target.value)}
                    placeholder={t('settings.eid.location.placeholder')}
                    maxLength={120}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#111',
                      border: '1px solid rgba(201,168,76,.12)',
                      borderRadius: 4,
                      padding: '8px 12px',
                      color: '#E8E0CC',
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Two side-by-side schedule sections — Fitr on the left,
                Adha on the right. Each slot stores one congregation time. */}
                {[
                  {
                    key: 'fitr',
                    label: 'Eid ul-Fitr',
                    draft: draftEidFitr,
                    setter: setDraftEidFitr,
                  },
                  {
                    key: 'adha',
                    label: 'Eid ul-Adha',
                    draft: draftEidAdha,
                    setter: setDraftEidAdha,
                  },
                ].map(({ key, label, draft, setter }) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#c49eff',
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {draft.map((slot, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: '#111',
                            border: `1px solid ${slot.enabled ? 'rgba(180,120,255,.3)' : 'rgba(201,168,76,.08)'}`,
                            borderRadius: 4,
                            padding: '7px 10px',
                          }}
                        >
                          {/* Enable toggle — matches Jumu'ah pattern. Disabled
                          slots are hidden in the banner regardless of time. */}
                          <button
                            onClick={() =>
                              setter((prev) =>
                                prev.map((x, xi) => (xi === i ? { ...x, enabled: !x.enabled } : x))
                              )
                            }
                            style={{
                              width: 28,
                              height: 16,
                              borderRadius: 8,
                              border: 'none',
                              cursor: 'pointer',
                              background: slot.enabled ? '#b47cff' : '#333',
                              position: 'relative',
                              flexShrink: 0,
                              transition: 'background .2s',
                            }}
                            aria-label={slot.enabled ? 'Disable slot' : 'Enable slot'}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 2,
                                left: slot.enabled ? 14 : 2,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left .2s',
                              }}
                            />
                          </button>
                          <span
                            style={{
                              fontSize: 12,
                              color: slot.enabled ? '#c49eff' : '#9A8B6E',
                              letterSpacing: '.1em',
                              textTransform: 'uppercase',
                              width: 28,
                              flexShrink: 0,
                            }}
                          >
                            {['1st', '2nd', '3rd', '4th'][i] || i + 1 + 'th'}
                          </span>
                          <input
                            type="time"
                            value={slot.time}
                            disabled={!slot.enabled}
                            onChange={(ev) =>
                              setter((prev) =>
                                prev.map((x, xi) =>
                                  xi === i ? { ...x, time: ev.target.value } : x
                                )
                              )
                            }
                            style={{
                              background: '#0A0A0A',
                              border: '1px solid rgba(180,120,255,.25)',
                              borderRadius: 3,
                              padding: '4px 8px',
                              color: slot.enabled ? '#c49eff' : '#555',
                              fontFamily: 'Rajdhani,sans-serif',
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              flex: 1,
                              opacity: slot.enabled ? 1 : 0.4,
                              colorScheme: 'dark',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {((key === 'fitr' && validationErrors.eidFitr) ||
                      (key === 'adha' && validationErrors.eidAdha)) && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#ff7c7c', lineHeight: 1.4 }}>
                          {key === 'fitr' ? validationErrors.eidFitr : validationErrors.eidAdha}
                        </div>
                      )}
                  </div>
                ))}
                <p style={{ fontSize: 11, color: '#9A8B6E', marginTop: 6, lineHeight: 1.4 }}>
                  {t('settings.eid.note')}
                </p>
              </div>
            </>
          )}
        </div>
        {/* end sbox-body */}

        {/* Sticky data-actions footer — Export / Import / Reset.
              Sits at the very bottom of the panel, always visible regardless
              of which tab is active or how far the user has scrolled within
              a tab. Less prominent than Cancel/Apply (different button class)
              since these are meta-operations on the WHOLE config, not part
              of the regular edit flow. */}
        <div className="sbox-data-footer">
          <button className="sbtn-meta" onClick={onExportSettings} title={t('settings.export')}>
            ⬇ {t('settings.export')}
          </button>
          <button
            className="sbtn-meta"
            onClick={() => fileInputRef.current?.click()}
            title={t('settings.import')}
          >
            ⬆ {t('settings.import')}
          </button>
          <button
            className={'sbtn-meta sbtn-meta-danger' + (resetConfirming ? ' confirming' : '')}
            onClick={handleResetClick}
            title={t('settings.reset')}
          >
            ↺ {resetConfirming ? t('settings.reset.confirm') : t('settings.reset')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleFilePick}
          />
          {/* Import feedback message — appears briefly after a load.
                Green for success, red for parse error. */}
          {importMsg && (
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              style={{
                fontSize: 11,
                color: importMsg.ok ? '#3DC878' : '#ff6b6b',
                letterSpacing: '.04em',
                marginLeft: 'auto',
                alignSelf: 'center',
              }}
            >
              {importMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PIN Overlay ──────────────────────────────────────────────────────────────
// Modal-style overlay shown when the user clicks the ⚙ Settings button and
// a PIN is configured (VITE_SETTINGS_PIN env var). Settings won't open until
// the correct PIN is entered. Failed attempts show an inline error message
// and clear the input.
//
// The PIN is verified by the parent — this component is purely presentational:
// it tracks its own input state and emits `onSubmit(input)` for verification.

import { useT } from '../i18n/I18nContext.jsx';

export default function PinOverlay({ visible, input, error, onChange, onSubmit, onCancel }) {
  const { t } = useT();
  if (!visible) return null;
  return (
    <div className="overlay">
      <div className="pin-box">
        <div className="pin-title">{t('pin.title')}</div>
        <input
          type="password"
          value={input}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder={t('pin.placeholder')}
          autoFocus
          className={`pin-input${error ? ' pin-input--error' : ''}`}
        />
        {error && <div className="pin-error">{t('pin.error')}</div>}
        <div className="pin-actions">
          <button className="sbtn" onClick={onCancel}>{t('pin.cancel')}</button>
          <button className="sbtn pri" onClick={onSubmit}>{t('pin.unlock')}</button>
        </div>
      </div>
    </div>
  );
}

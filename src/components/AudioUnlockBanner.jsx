// ── Audio unlock banner ──────────────────────────────────────────────────────
// A small pill at the bottom-centre of the viewport, shown only when:
//   - chimes are enabled in settings, AND
//   - the browser hasn't yet received a user gesture (so audio.play() is blocked)
//
// On first tap/click, calls primeAudio() to unlock the audio singleton.
// After a 100ms grace period to let the play() promise resolve, sets
// audioReady = true and the banner disappears on next render.

import { primeAudio, isAudioUnlocked } from '../lib/audio.js';
import { useT } from '../i18n/I18nContext.jsx';

export default function AudioUnlockBanner({ visible, onUnlock }) {
  const { t } = useT();
  if (!visible) return null;
  return (
    <div
      onClick={() => {
        primeAudio();
        setTimeout(() => { if (isAudioUnlocked()) onUnlock(); }, 100);
      }}
      style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 90, background: 'rgba(0,0,0,.78)',
        border: '1px solid var(--t-border-hi, rgba(201,168,76,.4))',
        color: 'var(--t-text, #F5EDD8)',
        fontFamily: 'Rajdhani,sans-serif',
        fontSize: 'clamp(11px, 1.4vw, 14px)',
        letterSpacing: '.06em',
        padding: '8px 16px', borderRadius: 999,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        maxWidth: 'min(90vw, 360px)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
        boxShadow: '0 4px 16px rgba(0,0,0,.4)',
      }}
    >
      {t('audio.unlock')}
    </div>
  );
}

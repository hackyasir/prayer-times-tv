// ── HeaderQibla — Qibla compass in the header centre ──────
//
// Wraps the existing <QiblaCompass/> SVG component (src/components/QiblaCompass.jsx)
// so it can sit in the header's centre zone alongside a small "QIBLA · 54° NE"
// label. Sits in the header centre alongside the masjid name, replacing the
// decorative Arabic title "مواقيت الصلاة" at the centre of the header — that
// decoration is purely ornamental, while Qibla bearing is useful info, so the
// swap is a net win.
//
// Doesn't recreate the compass — reuses the existing component verbatim.

import QiblaCompass from '../QiblaCompass.jsx';
import { bearingToCompass } from '../../lib/formatters.js';
import { useT } from '../../i18n/I18nContext.jsx';

export default function HeaderQibla({ qibla }) {
  const { t } = useT();
  if (qibla == null) return null;

  return (
    <div className="header-qibla" aria-label="Qibla direction">
      <QiblaCompass bearing={qibla}/>
      <div className="header-qibla-text">
        <div className="header-qibla-lbl">{t('widget.qibla.label')}</div>
        <div className="header-qibla-val">
          {qibla.toFixed(0)}°&nbsp;{bearingToCompass(qibla)}
        </div>
      </div>
    </div>
  );
}

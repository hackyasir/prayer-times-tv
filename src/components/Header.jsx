// ── Header ───────────────────────────────────────────────────────────────────
// Top strip across the dashboard with three sections:
//   LEFT:    Mosque icon + Masjid name + subtitle
//   CENTRE:  Arabic decorative title "مواقيت الصلاة" (Times of Prayer)
//   RIGHT:   Location pin · Hijri date · Method badge
//
// The Arabic centre title is INTENTIONALLY NOT translated — it's the
// standard calligraphic identifier shown on mosques worldwide regardless
// of local language, equivalent to a logo.
//
// The mosque icon reflects the active prayer's colour palette and current
// lunar phase via its activePrayer + lunarPhase props.

import MosqueIcon from './MosqueIcon.jsx';
import { METHOD_LABELS } from '../lib/constants.js';
import { useT } from '../i18n/I18nContext.jsx';

export default function Header({
  masjidName,
  locName,
  hijri,
  method,
  activePrayerKey,
  lunarPhase,
}) {
  const { t } = useT();
  return (
    <div className="hdr">
      <div className="hdr-left">
        <MosqueIcon activePrayer={activePrayerKey} lunarPhase={lunarPhase}/>
        <div>
          {masjidName ? (
            <>
              <div className="app-title">{masjidName}</div>
              <div className="app-sub">{t('app.subtitle.named')}</div>
            </>
          ) : (
            <>
              <div className="app-title">{t('app.title')}</div>
              <div className="app-sub">{t('app.subtitle')}</div>
            </>
          )}
        </div>
      </div>
      <div className="arabic-title">مواقيت الصلاة</div>
      <div className="hdr-right">
        <div className="loc"><span className="loc-dot"/>{locName}</div>
        <div className="hijri">{hijri}</div>
        <div className="method-badge">{METHOD_LABELS[method]}</div>
      </div>
    </div>
  );
}

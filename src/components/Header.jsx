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
  logoDataUrl, // optional: base64 PNG/JPG/SVG; if set, replaces MosqueIcon
  locName,
  hijri,
  method,
  activePrayerKey,
  lunarPhase,
  centerSlot, // optional: replaces the decorative Arabic title
}) {
  const { t } = useT();
  return (
    <div className="hdr">
      <div className="hdr-left">
        {logoDataUrl ? (
          // Custom mosque logo uploaded via Settings. Sized to match the
          // MosqueIcon footprint so layout doesn't shift between modes.
          // object-fit: contain (set in CSS) keeps the user's logo aspect
          // ratio intact regardless of source dimensions.
          <img src={logoDataUrl} alt={masjidName || 'Mosque logo'} className="mosque-logo-custom" />
        ) : (
          <MosqueIcon activePrayer={activePrayerKey} lunarPhase={lunarPhase} />
        )}
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
      {/* Centre slot — defaults to the decorative Arabic title "مواقيت الصلاة"
          but can be overridden via the centerSlot prop. The embedded
          layout variant passes <HeaderQibla/> here so a useful compass
          + bearing replaces the purely-ornamental title. */}
      {centerSlot ?? <div className="arabic-title">مواقيت الصلاة</div>}
      <div className="hdr-right">
        <div className="loc">
          {/* Location pin SVG — replaces the previous pulsating green dot.
              Uses currentColor so it inherits .loc's text-dim colour. */}
          <svg
            className="loc-pin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {locName}
        </div>
        <div className="hijri">{hijri}</div>
        <div className="method-badge">{METHOD_LABELS[method]}</div>
      </div>
    </div>
  );
}

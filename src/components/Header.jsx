// ── Header ───────────────────────────────────────────────────────────────────
// Top strip across the dashboard with three sections:
//   LEFT:    Mosque icon + Masjid name + subtitle
//   CENTRE:  Arabic title "مواقيت الصلاة" (Times of Prayer)
//   RIGHT:   Location pin · Hijri date · Method badge
//
// The mosque icon reflects the active prayer's colour palette and current
// lunar phase via its activePrayer + lunarPhase props.

import MosqueIcon from './MosqueIcon.jsx';
import { METHOD_LABELS } from '../lib/constants.js';

export default function Header({
  masjidName,
  locName,
  hijri,
  method,
  activePrayerKey,
  lunarPhase,
}) {
  return (
    <div className="hdr">
      <div className="hdr-left">
        <MosqueIcon activePrayer={activePrayerKey} lunarPhase={lunarPhase}/>
        <div>
          {masjidName ? (
            <>
              <div className="app-title">{masjidName}</div>
              <div className="app-sub">Prayer Times · Digital Display</div>
            </>
          ) : (
            <>
              <div className="app-title">Prayer Times</div>
              <div className="app-sub">Digital Masjid Display</div>
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

// ── Today's Fast + Qibla merged widget ──────────────────────────────────────
//
// Two halves separated by a vertical accent line:
//   LEFT  — Today's fasting window (Fajr → Maghrib), total duration,
//           live progress bar visible only when actively fasting, plus
//           the remaining-to-iftar countdown.
//   RIGHT — Qibla compass at 1.45× scale, degrees, and dynamic direction
//           label (e.g. "Northeast", "West-Northwest") matching the bearing.
//
// The Asr method line was previously here but was removed for visual
// cleanliness — it's available in the prayer list at the top of the dashboard.

import { fmt12, bearingToCompassLong } from '../../lib/formatters.js';
import { useT, fmtStr } from '../../i18n/I18nContext.jsx';
import QiblaCompass from '../QiblaCompass.jsx';

export default function FastQiblaCard({ todayTimes, now, cityTz, qibla }) {
  const { t } = useT();
  return (
    <div className="icard">
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1px 0.85fr',
        gap:'.9vw', alignItems:'stretch',
      }}>

        {/* LEFT half: Today's Fast */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.4vh', minWidth:0 }}>
          <div className="ilbl">{t('widget.fast.title')}</div>
          {todayTimes.fajr && todayTimes.maghrib ? (() => {
            const total      = todayTimes.maghrib - todayTimes.fajr;
            const elapsed    = Math.max(0, Math.min(total, now - todayTimes.fajr));
            const pct        = total > 0 ? (elapsed / total) * 100 : 0;
            const isActive   = now >= todayTimes.fajr && now < todayTimes.maghrib;
            const remainMins = isActive ? Math.round((todayTimes.maghrib - now) / 60000) : 0;
            const totalMins  = Math.round(total / 60000);
            return (
              <>
                <div style={{ display:'flex', alignItems:'baseline', gap:'.4vw', flexWrap:'wrap' }}>
                  <div className="ival" style={{ fontSize: 'clamp(0.938rem,1.55vw,1.75rem)' }}>
                    {fmt12(todayTimes.fajr, cityTz)}
                  </div>
                  <span style={{ fontSize:'clamp(0.5rem,.85vw,0.875rem)', color:'#9A8B6E' }}>→</span>
                  <div className="ival" style={{ fontSize: 'clamp(0.938rem,1.55vw,1.75rem)' }}>
                    {fmt12(todayTimes.maghrib, cityTz)}
                  </div>
                </div>
                <div style={{ fontSize:'clamp(0.563rem,.95vw,0.938rem)', color:'#9A8B6E', letterSpacing:'.06em' }}>
                  {fmtStr(t('widget.fast.total'), { hours: Math.floor(totalMins/60), mins: totalMins%60 })}
                </div>
                {isActive && (
                  <>
                    <div style={{
                      height:3, background:'rgba(var(--t-accent-rgb),.1)',
                      borderRadius:2, overflow:'hidden', marginTop:'.2vh',
                    }}>
                      <div style={{
                        width:`${pct}%`, height:'100%',
                        background:'var(--t-accent)',
                        transition:'width 60s linear',
                      }}/>
                    </div>
                    <div style={{
                      fontSize:'clamp(0.5rem,.85vw,0.875rem)',
                      color:'var(--t-accent)', letterSpacing:'.08em',
                    }}>
                      {fmtStr(t('widget.fast.toIftar'), { hours: Math.floor(remainMins/60), mins: remainMins%60 })}
                    </div>
                  </>
                )}
              </>
            );
          })() : <div className="ival">--</div>}
        </div>

        {/* Vertical divider */}
        <div style={{ background:'rgba(var(--t-accent-rgb),.12)' }}/>

        {/* RIGHT half: Qibla compass with degrees + direction label */}
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:'.2vh', minWidth:0,
        }}>
          <div style={{ transform:'scale(1.45)', transformOrigin:'center', margin:'.6vh 0 .4vh' }}>
            <QiblaCompass bearing={qibla}/>
          </div>
          <div style={{ textAlign:'center', lineHeight:1.05 }}>
            <div style={{
              fontSize:'clamp(1.125rem,1.85vw,2.25rem)', fontWeight:700,
              color:'var(--t-text)', fontVariantNumeric:'tabular-nums',
            }}>
              {qibla}°
            </div>
            <div style={{
              fontSize: 'clamp(0.5rem,.85vw,0.875rem)', color:'#9A8B6E',
              letterSpacing:'.14em', textTransform:'uppercase', marginTop:'.15vh',
            }}>
              {bearingToCompassLong(qibla)}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

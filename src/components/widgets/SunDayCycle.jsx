// ── Sun Day Cycle widget ─────────────────────────────────────────────────────
//
// Three columns (Sunrise / Noon / Sunset), each showing the city's wall-clock
// time. Below: a gradient progress bar reflecting % of daylight elapsed,
// with status text on the left ("Pre-dawn" / "47% of day" / "Night") and
// total daylight duration on the right.
//
// Noon = solar noon = Dhuhr (sun is at its highest). We reuse todayTimes.dhuhr.

import { fmt12 } from '../../lib/formatters.js';
import { useT, fmtStr } from '../../i18n/I18nContext.jsx';

export default function SunDayCycle({ todayTimes, now, cityTz, dayMins }) {
  const { t } = useT();
  return (
    <div className="icard">
      {/* Three sun events laid out as a 3-col grid with separators */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1px 1fr 1px 1fr',
        alignItems:'center',
      }}>
        <div className="sun-item">
          <div className="sun-lbl">{t('widget.sun.sunrise')}</div>
          <div className="sun-val">{fmt12(todayTimes.sunrise, cityTz)}</div>
        </div>
        <div className="sun-sep"/>
        <div className="sun-item">
          <div className="sun-lbl">{t('widget.sun.noon')}</div>
          <div className="sun-val">{fmt12(todayTimes.dhuhr, cityTz)}</div>
        </div>
        <div className="sun-sep"/>
        <div className="sun-item">
          <div className="sun-lbl">{t('widget.sun.sunset')}</div>
          <div className="sun-val">{fmt12(todayTimes.maghrib, cityTz)}</div>
        </div>
      </div>

      {/* Daylight progress bar — shows where we are in the daylight window */}
      {todayTimes.sunrise && todayTimes.maghrib && (() => {
        const total   = todayTimes.maghrib - todayTimes.sunrise;
        const elapsed = Math.max(0, Math.min(total, now - todayTimes.sunrise));
        const pct     = total > 0 ? (elapsed / total) * 100 : 0;
        const isDay   = pct > 0 && pct < 100;
        return (
          <div style={{ marginTop:'.6vh' }}>
            <div style={{
              height:4, background:'rgba(var(--t-accent-rgb),.1)',
              borderRadius:2, overflow:'hidden', position:'relative',
            }}>
              <div style={{
                width: `${pct}%`, height:'100%',
                background:'linear-gradient(90deg, var(--t-accent-dim) 0%, var(--t-accent-hi) 50%, var(--t-accent-dim) 100%)',
                transition:'width 60s linear',
              }}/>
            </div>
            <div style={{
              display:'flex', justifyContent:'space-between',
              fontSize:'calc(clamp(0.375rem,.65vw,0.625rem) * var(--t-fs, 1))',
              color:'#9A8B6E', letterSpacing:'.08em', marginTop:'.3vh',
            }}>
              <span>{
                isDay
                  ? fmtStr(t('widget.sun.pctOfDay'), { pct: Math.round(pct) })
                  : (pct === 0 ? t('widget.sun.preDawn') : t('widget.sun.night'))
              }</span>
              {dayMins !== null && (
                <span>☀️ {fmtStr(t('widget.sun.daylight'), { hours: Math.floor(dayMins/60), mins: dayMins%60 })}</span>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

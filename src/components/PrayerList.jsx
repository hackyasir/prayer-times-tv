// ── Prayer List (left column) ────────────────────────────────────────────────
// Header row (Adhan / Iqamah column titles) + 5 prayer rows. On Fridays
// with active Jumu'ah slots, Dhuhr is REPLACED by a Jumu'ah banner (single
// slot uses the standard PrayerCard styling; multi-slot uses a custom banner).
// On non-Fridays, the Jumu'ah preview block appears below the regular list
// so staff can verify weekly Jumu'ah times. Eid banner appears between the
// regular prayers and the Jumu'ah preview when active.
//
// Sunrise is computed but never displayed in this list — it's observational,
// not a congregational prayer. It appears in the Sun Day Cycle widget.

import { PRAYERS } from '../lib/constants.js';
import { fmt12, addMins } from '../lib/formatters.js';
import PrayerCard from './PrayerCard.jsx';

export default function PrayerList({
  todayTimes,
  iqamah,             // map of {fajr,dhuhr,...} → minutes offset for iqamah
  active,             // current active prayer object | null
  now,                // current Date
  cityTz,             // IANA timezone for fmt12 display
  isFriday,           // boolean
  activeJumuahSlots,  // [{time:'HH:MM', iqamah:Number}, ...]
  nextJumuah,         // next upcoming Jumu'ah Date | null
  jumuahDate,         // (timeStr) → Date helper from parent
  activeEidSlots,     // [{time, iqamah, label}, ...]
  nextEid,            // next upcoming Eid Date | null
  eidDate,            // (timeStr) → Date helper from parent
  showEidBanner,      // boolean — show the eid block at all
}) {
  return (
    <div className="pcol">
      {/* Column headers */}
      <div className="pheader">
        <div className="pheader-name"/>
        <div className="pheader-col">Adhan</div>
        <div className="pheader-col">Iqamah</div>
      </div>

      {/* 5 daily prayers (Sunrise filtered out — observational only) */}
      {PRAYERS.filter(p => p.key !== 'sunrise').map(p => {
        const t        = todayTimes[p.key];
        const iqamahT  = addMins(t, iqamah[p.key]);
        const isActive = active?.key === p.key;
        const isPassed = t && t < now && !isActive;

        // On Fridays with active slots, replace Dhuhr with the Jumu'ah block.
        if (p.key === 'dhuhr' && isFriday && activeJumuahSlots.length > 0) {
          const single = activeJumuahSlots.length === 1;
          if (single) {
            const j   = activeJumuahSlots[0];
            const jt  = jumuahDate(j.time);
            const jiq = addMins(jt, j.iqamah);
            const isPast = jt < now;
            return (
              <div key="jumuah-friday" className="pcard" style={{
                borderColor:'rgba(61,200,120,.4)',
                background: isPast ? 'transparent' : 'rgba(61,200,120,.06)',
                opacity: isPast ? .4 : 1,
              }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#3DC878', borderRadius:'4px 0 0 4px' }}/>
                <div className="pcard-name">
                  <div className="pen" style={{color:'#3DC878'}}>Jumu'ah</div>
                  <div className="par" style={{color:'rgba(61,200,120,.7)'}}>صلاة الجمعة</div>
                </div>
                <div className="pcard-times">
                  <div className="ptime" style={{color: isPast ? '#9A8B6E' : '#3DC878'}}>{fmt12(jt, cityTz)}</div>
                  <div className="ptime-iqamah" style={{color:'rgba(61,200,120,.8)'}}>{fmt12(jiq, cityTz)}</div>
                </div>
              </div>
            );
          }
          // Multi-slot Jumu'ah: large banner with up to 3 slots
          return (
            <div key="jumuah-friday" className="jumuah-banner">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div className="jumuah-title">Jumu'ah <span className="jumuah-arabic">صلاة الجمعة</span></div>
                {nextJumuah ? (
                  <div className="jumuah-next">Next in {Math.ceil((nextJumuah - now) / 60000)} min</div>
                ) : (
                  <div className="jumuah-next" style={{color:'rgba(61,200,120,.35)'}}>Complete</div>
                )}
              </div>
              <div className="jumuah-slots">
                {activeJumuahSlots.map((j, i) => {
                  const jt  = jumuahDate(j.time);
                  const jiq = addMins(jt, j.iqamah);
                  const isPast = jt < now;
                  return (
                    <div key={i} className="jumuah-slot" style={{ opacity: isPast ? .35 : 1 }}>
                      <div className="jumuah-slot-lbl">{i===0?'1st':i===1?'2nd':'3rd'}</div>
                      <div className="jumuah-slot-time">{fmt12(jt, cityTz)}</div>
                      <div className="jumuah-slot-iqamah">↪ {fmt12(jiq, cityTz)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Standard prayer card
        return (
          <PrayerCard
            key={p.key}
            enName={p.en}
            arName={p.ar}
            time={t}
            iqamahTime={iqamahT}
            cityTz={cityTz}
            isActive={isActive}
            isPassed={isPassed}
          />
        );
      })}

      {/* Eid prayer banner — shown all day until last iqamah ends */}
      {showEidBanner && (() => {
        const eidLabel = activeEidSlots[0]?.label || 'Eid Prayer';
        if (activeEidSlots.length === 1) {
          const e   = activeEidSlots[0];
          const et  = eidDate(e.time);
          const eiq = addMins(et, e.iqamah);
          const isPast = et < now;
          return (
            <div className="pcard" style={{
              borderColor:'rgba(180,120,255,.4)',
              background: isPast ? 'transparent' : 'rgba(180,120,255,.06)',
              opacity: isPast ? .4 : 1,
            }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#b47cff', borderRadius:'4px 0 0 4px' }}/>
              <div className="pcard-name">
                <div className="pen" style={{color:'#c49eff'}}>{eidLabel}</div>
                <div className="par" style={{color:'rgba(196,158,255,.7)'}}>صلاة العيد</div>
              </div>
              <div className="pcard-times">
                <div className="ptime" style={{color: isPast ? '#9A8B6E' : '#c49eff'}}>{fmt12(et, cityTz)}</div>
                <div className="ptime-iqamah" style={{color:'rgba(196,158,255,.8)'}}>{fmt12(eiq, cityTz)}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="eid-banner">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div className="eid-title">{eidLabel} <span className="eid-arabic">صلاة العيد</span></div>
              {(() => {
                const firstEidTime = eidDate(activeEidSlots[0].time);
                const msBefore = firstEidTime - now;
                const daysUntil = Math.ceil(msBefore / (1000*60*60*24));
                if (daysUntil > 0) {
                  return <div className="eid-next">{daysUntil} day{daysUntil!==1?'s':''} away</div>;
                }
                return nextEid
                  ? <div className="eid-next">Next in {Math.ceil((nextEid - now) / 60000)} min</div>
                  : <div className="eid-next" style={{color:'rgba(196,158,255,.35)'}}>Complete</div>;
              })()}
            </div>
            <div className="eid-slots">
              {activeEidSlots.map((e, i) => {
                const et  = eidDate(e.time);
                const eiq = addMins(et, e.iqamah);
                const isPast = et < now;
                return (
                  <div key={i} className="eid-slot" style={{ opacity: isPast ? .35 : 1 }}>
                    <div className="eid-slot-lbl">{i===0?'1st':i===1?'2nd':'3rd'}</div>
                    <div className="eid-slot-time">{fmt12(et, cityTz)}</div>
                    <div className="eid-slot-iqamah">↪ {fmt12(eiq, cityTz)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Jumu'ah preview block — shown on non-Fridays so staff can verify times */}
      {activeJumuahSlots.length > 0 && !isFriday && (() => {
        if (activeJumuahSlots.length === 1) {
          const j   = activeJumuahSlots[0];
          const jt  = jumuahDate(j.time);
          const jiq = addMins(jt, j.iqamah);
          return (
            <div className="pcard jumuah-dim" style={{ borderColor:'rgba(61,200,120,.25)' }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#3DC878', borderRadius:'4px 0 0 4px' }}/>
              <div className="pcard-name">
                <div className="pen" style={{color:'rgba(61,200,120,.7)'}}>Jumu'ah</div>
                <div className="par" style={{color:'rgba(61,200,120,.45)'}}>الجمعة</div>
              </div>
              <div className="pcard-times">
                <div className="ptime" style={{color:'rgba(61,200,120,.7)'}}>{fmt12(jt, cityTz)}</div>
                <div className="ptime-iqamah" style={{color:'rgba(61,200,120,.5)'}}>{fmt12(jiq, cityTz)}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="jumuah-banner jumuah-dim">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div className="jumuah-title">Jumu'ah <span className="jumuah-arabic">الجمعة</span></div>
            </div>
            <div className="jumuah-slots">
              {activeJumuahSlots.map((j, i) => {
                const jt  = jumuahDate(j.time);
                const jiq = addMins(jt, j.iqamah);
                return (
                  <div key={i} className="jumuah-slot">
                    <div className="jumuah-slot-lbl">{i===0?'1st':i===1?'2nd':'3rd'}</div>
                    <div className="jumuah-slot-time">{fmt12(jt, cityTz)}</div>
                    <div className="jumuah-slot-iqamah">↪ {fmt12(jiq, cityTz)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

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
import { useT, fmtStr } from '../i18n/I18nContext.jsx';
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
  footerSlot,         // optional: rendered below all prayer cards (embedded
                      //   layout uses this for the compact WeatherStrip)
}) {
  const { t, lang } = useT();

  // Bilingual name pair per prayer, language-aware:
  //   - English UI: primary = English name,  secondary = Arabic name
  //   - Arabic UI:  primary = Arabic name,   secondary = (no secondary — same as primary)
  //                 We render the English transliteration as secondary for visual variety.
  //   - Urdu UI:    primary = Urdu name,     secondary = Arabic name
  // The English fallback ensures we always render two distinct lines so the
  // visual rhythm of the prayer list (big + small) is preserved.
  function namesFor(prayerKey) {
    const arabicName = PRAYERS.find(p => p.key === prayerKey)?.ar || '';
    const localized  = t(`prayer.${prayerKey}`);          // localized primary
    const englishKey = PRAYERS.find(p => p.key === prayerKey)?.en || ''; // english fallback secondary
    if (lang === 'ar') return { primary: arabicName, secondary: englishKey };
    if (lang === 'ur') return { primary: localized,  secondary: arabicName };
    return                    { primary: localized,  secondary: arabicName };
  }

  return (
    <div className="pcol-wrap">
    <div className="pcol">
      {/* Column headers */}
      <div className="pheader">
        <div className="pheader-name"/>
        <div className="pheader-col">{t('label.adhan')}</div>
        <div className="pheader-col">{t('label.iqamah')}</div>
      </div>

      {/* 5 daily prayers (Sunrise filtered out — observational only) */}
      {PRAYERS.filter(p => p.key !== 'sunrise').map(p => {
        const adhanT   = todayTimes[p.key];
        const iqamahT  = addMins(adhanT, iqamah[p.key]);
        const isActive = active?.key === p.key;
        const isPassed = adhanT && adhanT < now && !isActive;

        // On Fridays with active slots, replace Dhuhr with the Jumu'ah banner.
        // Unified design — same banner used for 1, 2, or 3 slots. The grid's
        // column count adapts via inline style, and single-slot is just a
        // 1-column banner. Keeps Jumu'ah visually consistent regardless of
        // how many jamaats the mosque holds.
        if (p.key === 'dhuhr' && isFriday && activeJumuahSlots.length > 0) {
          // Multi-slot Jumu'ah banner — each slot is a card with:
          //   - Big background numeral (1, 2, 3) at low opacity
          //   - Adhan + Iqamah times side-by-side
          //   - Status badge (✓ done / ● next / later) top-right
          //   - Active "next" slot gets gold border + larger times + pulse
          // Header shows which slot's countdown it refers to ("2nd jamaat · 2h 15m").
          const nextSlotIdx = activeJumuahSlots.findIndex(j => jumuahDate(j.time) > now);
          const ordWord = (i) => i === 0 ? '1st' : i === 1 ? '2nd' : '3rd';
          return (
            <div key="jumuah-friday" className="jumuah-banner">
              <div className="jumuah-banner-head">
                <div className="jumuah-title">{t('prayer.jumuah')} <span className="jumuah-arabic">صلاة الجمعة</span></div>
                {nextJumuah && nextSlotIdx >= 0 ? (
                  <div className="jumuah-next">{(() => {
                    const m = Math.ceil((nextJumuah - now) / 60000);
                    return fmtStr(t('label.nthJamaatIn'), {
                      ord: t(`ord.${ordWord(nextSlotIdx)}`),
                      h: Math.floor(m/60),
                      m: m%60,
                    });
                  })()}</div>
                ) : (
                  <div className="jumuah-next jumuah-next-complete">{t('label.complete')}</div>
                )}
              </div>
              <div className="jumuah-slots" style={{ gridTemplateColumns: `repeat(${activeJumuahSlots.length}, 1fr)` }}>
                {activeJumuahSlots.map((j, i) => {
                  const jt  = jumuahDate(j.time);
                  const jiq = addMins(jt, j.iqamah);
                  const isPast = jt < now;
                  const isNext = i === nextSlotIdx;
                  const statusKey = isPast ? 'done' : isNext ? 'next' : 'later';
                  return (
                    <div key={i} className={`jumuah-slot jumuah-slot-${statusKey}`}>
                      {/* Big background numeral — decorative, centered, low-opacity */}
                      <span className="jumuah-slot-bg-num" aria-hidden="true">{i + 1}</span>
                      {/* Status badge top-right */}
                      <span className="jumuah-slot-status">
                        {isNext && <span className="jumuah-slot-pulse"/>}
                        {t(`jumuah.status.${statusKey}`)}
                      </span>
                      {/* Adhan + Iqamah times side-by-side */}
                      <div className="jumuah-slot-times">
                        <div className="jumuah-slot-col">
                          <div className="jumuah-slot-col-lbl">{t('jumuah.adhan')}</div>
                          <div className="jumuah-slot-col-time">{fmt12(jt, cityTz)}</div>
                        </div>
                        <div className="jumuah-slot-col jumuah-slot-col-right">
                          <div className="jumuah-slot-col-lbl">{t('jumuah.iqamah')}</div>
                          <div className="jumuah-slot-col-time">{fmt12(jiq, cityTz)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Standard prayer card
        const names = namesFor(p.key);
        return (
          <PrayerCard
            key={p.key}
            prayerKey={p.key}
            enName={names.primary}
            arName={names.secondary}
            time={adhanT}
            iqamahTime={iqamahT}
            cityTz={cityTz}
            isActive={isActive}
            isPassed={isPassed}
          />
        );
      })}

      {/* Eid prayer banner — shown all day until last iqamah ends.
       * Unified design — same banner used for 1, 2, or 3 slots. */}
      {showEidBanner && (() => {
        const eidLabel = activeEidSlots[0]?.label || t('prayer.eid');
        // Multi-slot Eid banner — mirrors Jumu'ah design: big background
        // numeral, Adhan/Iqamah side-by-side, status badges, active highlight.
        const nextEidSlotIdx = activeEidSlots.findIndex(e => eidDate(e.time) > now);
        const eidOrdWord = (i) => i === 0 ? '1st' : i === 1 ? '2nd' : '3rd';
        return (
          <div className="eid-banner">
            <div className="eid-banner-head">
              <div className="eid-title">{eidLabel} <span className="eid-arabic">صلاة العيد</span></div>
              {(() => {
                const firstEidTime = eidDate(activeEidSlots[0].time);
                const msBefore = firstEidTime - now;
                const daysUntil = Math.ceil(msBefore / (1000*60*60*24));
                if (daysUntil > 0) {
                  return <div className="eid-next">{fmtStr(t('label.daysAway'), { days: daysUntil, plural: daysUntil!==1?'s':'' })}</div>;
                }
                if (nextEid && nextEidSlotIdx >= 0) {
                  const m = Math.ceil((nextEid - now) / 60000);
                  return <div className="eid-next">{fmtStr(t('label.nthJamaatIn'), {
                    ord: t(`ord.${eidOrdWord(nextEidSlotIdx)}`),
                    h: Math.floor(m/60),
                    m: m%60,
                  })}</div>;
                }
                return <div className="eid-next eid-next-complete">{t('label.complete')}</div>;
              })()}
            </div>
            <div className="eid-slots" style={{ gridTemplateColumns: `repeat(${activeEidSlots.length}, 1fr)` }}>
              {activeEidSlots.map((e, i) => {
                const et  = eidDate(e.time);
                const eiq = addMins(et, e.iqamah);
                const isPast = et < now;
                const isNext = i === nextEidSlotIdx;
                const statusKey = isPast ? 'done' : isNext ? 'next' : 'later';
                return (
                  <div key={i} className={`eid-slot eid-slot-${statusKey}`}>
                    <span className="eid-slot-bg-num" aria-hidden="true">{i + 1}</span>
                    <span className="eid-slot-status">
                      {isNext && <span className="eid-slot-pulse"/>}
                      {t(`jumuah.status.${statusKey}`)}
                    </span>
                    <div className="eid-slot-times">
                      <div className="eid-slot-col">
                        <div className="eid-slot-col-lbl">{t('jumuah.adhan')}</div>
                        <div className="eid-slot-col-time">{fmt12(et, cityTz)}</div>
                      </div>
                      <div className="eid-slot-col eid-slot-col-right">
                        <div className="eid-slot-col-lbl">{t('jumuah.iqamah')}</div>
                        <div className="eid-slot-col-time">{fmt12(eiq, cityTz)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Jumu'ah preview block — shown on non-Fridays so staff can verify
       * times. Same banner design as Friday — unified for 1/2/3 slots. */}
      {activeJumuahSlots.length > 0 && !isFriday && (() => {
        return (
          <div className="jumuah-banner jumuah-dim">
            <div className="jumuah-banner-head">
              <div className="jumuah-title">{t('prayer.jumuah')} <span className="jumuah-arabic">الجمعة</span></div>
            </div>
            <div className="jumuah-slots" style={{ gridTemplateColumns: `repeat(${activeJumuahSlots.length}, 1fr)` }}>
              {activeJumuahSlots.map((j, i) => {
                const jt  = jumuahDate(j.time);
                const jiq = addMins(jt, j.iqamah);
                // Preview: all slots styled as "later" (no active highlight,
                // no status badge — this is just a verification block on
                // non-Fridays).
                return (
                  <div key={i} className="jumuah-slot jumuah-slot-later">
                    <span className="jumuah-slot-bg-num" aria-hidden="true">{i + 1}</span>
                    <div className="jumuah-slot-times">
                      <div className="jumuah-slot-col">
                        <div className="jumuah-slot-col-lbl">{t('jumuah.adhan')}</div>
                        <div className="jumuah-slot-col-time">{fmt12(jt, cityTz)}</div>
                      </div>
                      <div className="jumuah-slot-col jumuah-slot-col-right">
                        <div className="jumuah-slot-col-lbl">{t('jumuah.iqamah')}</div>
                        <div className="jumuah-slot-col-time">{fmt12(jiq, cityTz)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>{/* end .pcol */}
    {/* Optional embedded-variant slot — compact WeatherStrip etc. Rendered
        OUTSIDE .pcol so it isn't clipped by .pcol's overflow:hidden. Sits
        as a sibling under the prayer cards within .pcol-wrap. */}
    {footerSlot}
    </div>
  );
}

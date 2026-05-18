// ── Footer (status strip) ────────────────────────────────────────────────────
// Slim status bar sitting below the widget cards (inside the bottom band).
// Three sections:
//   LEFT:   ⚙ Settings button + "Offline · All times local · {Method}"
//   CENTRE: five small dots (decorative)
//   RIGHT:  Test buttons (gated by SHOW_TEST_BTNS) + "Updated every second"
//
// The test buttons (Test Jumu'ah, Test Pattern, Test Blackout) help previewing
// edge cases during setup and can be hidden in production via
// VITE_SHOW_TEST_BUTTONS=false.

import { useT } from '../i18n/I18nContext.jsx';

/** Short label for a moon phase test value. null = real-phase (auto from
 * suncalc); 0..1 = forced phase. Used by the Test Phase footer button. */
function phaseLabel(phaseValue) {
  if (phaseValue == null)       return 'Phase: Auto';
  if (phaseValue === 0)         return 'New';
  if (phaseValue === .125)      return 'Wax. Cres.';
  if (phaseValue === .25)       return '1st Qtr';
  if (phaseValue === .375)      return 'Wax. Gibb.';
  if (phaseValue === .5)        return 'Full';
  if (phaseValue === .625)      return 'Wan. Gibb.';
  if (phaseValue === .75)       return 'Last Qtr';
  if (phaseValue === .875)      return 'Wan. Cres.';
  return `${(phaseValue * 100).toFixed(0)}%`;
}

export default function Footer({
  showTestBtns,
  testFriday,
  testPrayer,
  testBlackoutActive,
  testCountdownActive,
  testMoonActive,
  testMoonPhaseValue,
  testEidKind,
  activeKey,
  onToggleFriday,
  onCyclePrayer,
  onClearPrayer,
  onTestBlackout,
  onTestCountdown,
  onToggleMoon,
  onCyclePhase,
  onToggleTestFitr,
  onToggleTestAdha,
}) {
  const { t } = useT();
  return (
    <div className="ftr">
      <div style={{ display:'flex', alignItems:'center', gap:'1vw' }}>
        {/* Settings button moved to floating top-right corner of the app
            (rendered in App.jsx). Footer left section now shows only the
            status text. */}
        <div className="ftr-txt">{t('footer.offline')}</div>
      </div>
      <div className="ftr-dots">{[0,1,2,3,4].map(i => <div key={i} className="ftr-dot"/>)}</div>
      <div style={{ display:'flex', alignItems:'center', gap:'1vw' }}>
        {showTestBtns && (
          <>
            <button
              onClick={onToggleFriday}
              style={{
                background:'transparent',
                border:`1px solid ${testFriday ? 'rgba(61,200,120,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testFriday ? '#3DC878' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer',
              }}
            >{testFriday ? t('footer.jumuahOn') : t('footer.testJumuah')}</button>
            <button
              onClick={() => onCyclePrayer(activeKey)}
              style={{
                background:'transparent',
                border:`1px solid ${testPrayer ? 'rgba(180,120,255,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testPrayer ? '#c49eff' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer',
              }}
            >🎨 {testPrayer ? testPrayer.toUpperCase() : t('footer.testPattern')}</button>
            {testPrayer && (
              <button
                onClick={onClearPrayer}
                style={{
                  background:'transparent',
                  border:'1px solid rgba(201,168,76,.15)',
                  borderRadius:3, padding:'2px 6px',
                  color:'#9A8B6E',
                  fontFamily:'Rajdhani,sans-serif',
                  fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                  cursor:'pointer',
                }}
              >✕</button>
            )}
            {/* Test Blackout — fires a 60-second blackout overlay right now,
                ignoring real iqamah times. Lets staff verify the dismiss
                gesture works, the Bismillah renders correctly, and the
                countdown ticks down properly without waiting for an actual
                prayer time. Auto-clears after 60s. */}
            <button
              onClick={onTestBlackout}
              disabled={testBlackoutActive}
              style={{
                background:'transparent',
                border:`1px solid ${testBlackoutActive ? 'rgba(255,255,255,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testBlackoutActive ? '#fff' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase',
                cursor: testBlackoutActive ? 'default' : 'pointer',
                opacity: testBlackoutActive ? 0.7 : 1,
              }}
            >⬛ {testBlackoutActive ? 'Active' : 'Test Blackout'}</button>
            {/* Test Countdown — forces a 60-second window so Clock renders
                the giant pulsing seconds digit (.countdown-big mode auto-
                activates when secsToNext <= 60). Lets staff verify the
                "final minute" visual without waiting for an actual prayer. */}
            <button
              onClick={onTestCountdown}
              disabled={testCountdownActive}
              style={{
                background:'transparent',
                border:`1px solid ${testCountdownActive ? 'rgba(255,255,255,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testCountdownActive ? '#fff' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase',
                cursor: testCountdownActive ? 'default' : 'pointer',
                opacity: testCountdownActive ? 0.7 : 1,
              }}
            >⏱ {testCountdownActive ? 'Active' : t('test.countdown')}</button>
            {/* Test Moon — forces the centre arc to render MoonArc with
                phase visualization regardless of whether the sun is up.
                Useful for verifying night-mode visuals during the day. */}
            <button
              onClick={onToggleMoon}
              style={{
                background:'transparent',
                border:`1px solid ${testMoonActive ? 'rgba(180,200,230,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testMoonActive ? '#c5d4e6' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer',
              }}
            >🌙 {t('test.moon')}{testMoonActive ? ' ✓' : ''}</button>
            {/* Test Phase — cycle through 9 phase stops (real → new →
                waxing crescent → first quarter → ... → waning crescent
                → real). Each click advances one stop; label shows the
                CURRENT phase name. Only meaningful while Test Moon is
                active so the moon arc is visible. */}
            <button
              onClick={onCyclePhase}
              style={{
                background:'transparent',
                border:`1px solid ${testMoonPhaseValue != null ? 'rgba(180,200,230,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testMoonPhaseValue != null ? '#c5d4e6' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer',
              }}
            >☾ {phaseLabel(testMoonPhaseValue)}</button>
            {/* Test Fitr — force-show Eid ul-Fitr banner regardless of
                whether the Hijri calendar has detected an upcoming Eid. */}
            <button
              onClick={onToggleTestFitr}
              style={{
                background:'transparent',
                border:`1px solid ${testEidKind === 'fitr' ? 'rgba(196,158,255,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testEidKind === 'fitr' ? '#c49eff' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer',
              }}
            >🕌 Fitr{testEidKind === 'fitr' ? ' ✓' : ''}</button>
            {/* Test Adha — force-show Eid ul-Adha banner. */}
            <button
              onClick={onToggleTestAdha}
              style={{
                background:'transparent',
                border:`1px solid ${testEidKind === 'adha' ? 'rgba(196,158,255,.5)' : 'rgba(201,168,76,.15)'}`,
                borderRadius:3, padding:'2px 8px',
                color: testEidKind === 'adha' ? '#c49eff' : '#9A8B6E',
                fontFamily:'Rajdhani,sans-serif',
                fontSize: 'calc(clamp(0.438rem,.72vw,0.688rem) * var(--t-fs, 1))',
                letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer',
              }}
            >🕋 Adha{testEidKind === 'adha' ? ' ✓' : ''}</button>
          </>
        )}
        <div className="ftr-txt">{t('footer.updated')}</div>
      </div>
    </div>
  );
}

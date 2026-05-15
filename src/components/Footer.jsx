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

export default function Footer({
  showTestBtns,
  testFriday,
  testPrayer,
  testBlackoutActive,
  activeKey,
  onOpenSettings,
  onToggleFriday,
  onCyclePrayer,
  onClearPrayer,
  onTestBlackout,
}) {
  const { t } = useT();
  return (
    <div className="ftr">
      <div style={{ display:'flex', alignItems:'center', gap:'1vw' }}>
        <button className="strig" onClick={onOpenSettings}>{t('footer.settings')}</button>
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
                fontSize: 'clamp(0.438rem,.72vw,0.688rem)',
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
                fontSize: 'clamp(0.438rem,.72vw,0.688rem)',
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
                  fontSize: 'clamp(0.438rem,.72vw,0.688rem)',
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
                fontSize: 'clamp(0.438rem,.72vw,0.688rem)',
                letterSpacing:'.1em', textTransform:'uppercase',
                cursor: testBlackoutActive ? 'default' : 'pointer',
                opacity: testBlackoutActive ? 0.7 : 1,
              }}
            >⬛ {testBlackoutActive ? 'Active' : 'Test Blackout'}</button>
          </>
        )}
        <div className="ftr-txt">{t('footer.updated')}</div>
      </div>
    </div>
  );
}

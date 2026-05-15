// ── Footer (status strip) ────────────────────────────────────────────────────
// Slim status bar sitting below the widget cards (inside the bottom band).
// Three sections:
//   LEFT:   ⚙ Settings button + "Offline · All times local · {Method}"
//   CENTRE: five small dots (decorative)
//   RIGHT:  Test buttons (gated by SHOW_TEST_BTNS) + "Updated every second"
//
// The test buttons (Test Jumu'ah, Test Pattern) help previewing edge cases
// during setup and can be hidden in production via VITE_SHOW_TEST_BUTTONS=false.

import { METHOD_LABELS } from '../lib/constants.js';

export default function Footer({
  method,
  showTestBtns,
  testFriday,
  testPrayer,
  activeKey,
  onOpenSettings,
  onToggleFriday,
  onCyclePrayer,
  onClearPrayer,
}) {
  return (
    <div className="ftr">
      <div style={{ display:'flex', alignItems:'center', gap:'1vw' }}>
        <button className="strig" onClick={onOpenSettings}>⚙ Settings</button>
        <div className="ftr-txt">Offline · All times local · {METHOD_LABELS[method]}</div>
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
            >{testFriday ? "✓ Jumu'ah ON" : "Test Jumu'ah"}</button>
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
            >🎨 {testPrayer ? testPrayer.toUpperCase() : 'Test Pattern'}</button>
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
          </>
        )}
        <div className="ftr-txt">Updated every second</div>
      </div>
    </div>
  );
}

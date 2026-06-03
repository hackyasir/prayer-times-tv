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
  if (phaseValue == null) return 'phase.auto';
  if (phaseValue === 0) return 'phase.new';
  if (phaseValue === 0.125) return 'phase.waxingCrescent';
  if (phaseValue === 0.25) return 'phase.firstQuarter';
  if (phaseValue === 0.375) return 'phase.waxingGibbous';
  if (phaseValue === 0.5) return 'phase.full';
  if (phaseValue === 0.625) return 'phase.waningGibbous';
  if (phaseValue === 0.75) return 'phase.lastQuarter';
  if (phaseValue === 0.875) return 'phase.waningCrescent';
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
      <div className="ftr-section">
        <div className="ftr-txt">{t('footer.offline')}</div>
      </div>
      <div className="ftr-dots">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ftr-dot" />
        ))}
      </div>
      <div className="ftr-section">
        {showTestBtns && (
          <>
            <button
              onClick={onToggleFriday}
              className={`test-btn test-btn--jumuah${testFriday ? ' is-active' : ''}`}
            >
              {testFriday ? t('footer.jumuahOn') : t('footer.testJumuah')}
            </button>
            <button
              onClick={() => onCyclePrayer(activeKey)}
              className={`test-btn test-btn--eid${testPrayer ? ' is-active' : ''}`}
            >
              🎨 {testPrayer ? testPrayer.toUpperCase() : t('footer.testPattern')}
            </button>
            {testPrayer && (
              <button onClick={onClearPrayer} className="test-btn test-btn--compact">
                ✕
              </button>
            )}
            {/* Test Blackout — fires a 60-second blackout overlay right now,
                ignoring real iqamah times. Lets staff verify the dismiss
                gesture works, the Bismillah renders correctly, and the
                countdown ticks down properly without waiting for an actual
                prayer time. Auto-clears after 60s. */}
            <button
              onClick={onTestBlackout}
              disabled={testBlackoutActive}
              className={`test-btn test-btn--neutral${testBlackoutActive ? ' is-active is-disabled' : ''}`}
            >
              ⬛ {testBlackoutActive ? t('test.active') : t('test.blackout')}
            </button>
            {/* Test Countdown — forces a 60-second window so Clock renders
                the giant pulsing seconds digit (.countdown-big mode auto-
                activates when secsToNext <= 60). Lets staff verify the
                "final minute" visual without waiting for an actual prayer. */}
            <button
              onClick={onTestCountdown}
              disabled={testCountdownActive}
              className={`test-btn test-btn--neutral${testCountdownActive ? ' is-active is-disabled' : ''}`}
            >
              ⏱ {testCountdownActive ? t('test.active') : t('test.countdown')}
            </button>
            {/* Test Moon — forces the centre arc to render MoonArc with
                phase visualization regardless of whether the sun is up.
                Useful for verifying night-mode visuals during the day. */}
            <button
              onClick={onToggleMoon}
              className={`test-btn test-btn--moon${testMoonActive ? ' is-active' : ''}`}
            >
              🌙 {t('test.moon')}
              {testMoonActive ? ' ✓' : ''}
            </button>
            {/* Test Phase — cycle through 9 phase stops (real → new →
                waxing crescent → first quarter → ... → waning crescent
                → real). Each click advances one stop; label shows the
                CURRENT phase name. Only meaningful while Test Moon is
                active so the moon arc is visible. */}
            <button
              onClick={onCyclePhase}
              className={`test-btn test-btn--moon${testMoonPhaseValue != null ? ' is-active' : ''}`}
            >
              ☾ {t(phaseLabel(testMoonPhaseValue))}
            </button>
            {/* Test Fitr — force-show Eid ul-Fitr banner regardless of
                whether the Hijri calendar has detected an upcoming Eid. */}
            <button
              onClick={onToggleTestFitr}
              className={`test-btn test-btn--eid${testEidKind === 'fitr' ? ' is-active' : ''}`}
            >
              🕌 {t('test.fitr')}
              {testEidKind === 'fitr' ? ' ✓' : ''}
            </button>
            {/* Test Adha — force-show Eid ul-Adha banner. */}
            <button
              onClick={onToggleTestAdha}
              className={`test-btn test-btn--eid${testEidKind === 'adha' ? ' is-active' : ''}`}
            >
              🕋 {t('test.adha')}
              {testEidKind === 'adha' ? ' ✓' : ''}
            </button>
          </>
        )}
        <div className="ftr-txt">{t('footer.updated')}</div>
      </div>
    </div>
  );
}

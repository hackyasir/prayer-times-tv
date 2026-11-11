/* @vitest-environment jsdom */
// ── Clock.test.jsx ───────────────────────────────────────────────────────
//
// The hero countdown has two targets:
//   - 'adhan'  (default): "Next Prayer" → HH:MM:SS until the next adhan
//   - 'iqamah': between a prayer's adhan and iqamah → "Iqamah" → MM:SS
// These tests pin the labels and formats so the mode switch stays visible.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Clock from '../Clock.jsx';
import { SettingsProvider } from '../../context/SettingsContext.jsx';
import { I18nProvider } from '../../i18n/I18nContext.jsx';

const at = (hh, mm) => new Date(Date.UTC(2026, 10, 13, hh, mm));
const todayTimes = {
  fajr: at(10, 0),
  sunrise: at(11, 30),
  dhuhr: at(17, 0),
  asr: at(19, 30),
  maghrib: at(21, 45),
  isha: at(23, 0),
};

function renderClock(props) {
  return render(
    <SettingsProvider>
      <I18nProvider>
        <Clock
          timeStr="2:37"
          secStr=":48 PM"
          dateStr="Friday, November 13, 2026"
          progressStyle="hero"
          ringProgress={0.5}
          todayTimes={todayTimes}
          tomorrowTimes={todayTimes}
          now={at(19, 37)}
          cityTz="UTC"
          activeKey="asr"
          hadiths={[{ ar: 'ar', en: 'en' }]}
          {...props}
        />
      </I18nProvider>
    </SettingsProvider>
  );
}

describe('Clock countdown', () => {
  it('wraps each ticking digit in a fixed-width cell so the time does not shift', () => {
    renderClock({
      next: { key: 'maghrib', en: 'Maghrib', ar: 'المغرب', time: todayTimes.maghrib },
      secsToNext: 7_692,
    });
    // 2:37 + :48 + 02:08:12 = 3 + 2 + 6 digit cells
    expect(document.querySelectorAll('.clock-main .sd')).toHaveLength(3);
    expect(document.querySelectorAll('.clock-sec .sd')).toHaveLength(2);
    expect(document.querySelectorAll('.countdown .sd')).toHaveLength(6);
    expect(document.querySelector('.clock-sec').textContent).toBe(':48 PM');
  });

  it('counts down to the next adhan by default', () => {
    renderClock({
      next: { key: 'maghrib', en: 'Maghrib', ar: 'المغرب', time: todayTimes.maghrib },
      secsToNext: 7_692,
    });
    expect(screen.getByText('Next Prayer')).toBeInTheDocument();
    expect(document.querySelector('.countdown').textContent).toBe('02:08:12');
    expect(screen.getByText('Until Maghrib · 9:45 PM')).toBeInTheDocument();
  });

  it('counts down to the iqamah between adhan and iqamah', () => {
    renderClock({
      next: { key: 'asr', en: 'Asr', ar: 'العصر', time: at(19, 45) },
      secsToNext: 492,
      countdownMode: 'iqamah',
    });
    expect(screen.getByText('Iqamah')).toBeInTheDocument();
    expect(screen.queryByText('Next Prayer')).not.toBeInTheDocument();
    expect(document.querySelector('.countdown').textContent).toBe('08:12');
    expect(screen.getByText('Asr iqamah · 7:45 PM')).toBeInTheDocument();
    expect(document.querySelector('.next-sec--iqamah')).not.toBeNull();
  });

  it('uses the iqamah wording in the final minute', () => {
    renderClock({
      next: { key: 'asr', en: 'Asr', ar: 'العصر', time: at(19, 45) },
      secsToNext: 30,
      countdownMode: 'iqamah',
    });
    expect(document.querySelector('.countdown-big').textContent).toBe('30');
    expect(screen.getByText('seconds until Asr iqamah')).toBeInTheDocument();
  });
});

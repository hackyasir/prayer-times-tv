/* @vitest-environment jsdom */
// ── PrayerCard.test.jsx ──────────────────────────────────────────────────
//
// Times render as large digits with a smaller AM/PM suffix (.ptime-ampm) so
// they fit their columns at TV sizes.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PrayerCard from '../PrayerCard.jsx';

describe('PrayerCard times', () => {
  it('splits the AM/PM suffix into its own element', () => {
    const { container } = render(
      <PrayerCard
        prayerKey="fajr"
        enName="Fajr"
        arName="الفجر"
        time={new Date(Date.UTC(2026, 10, 13, 5, 27))}
        iqamahTime={new Date(Date.UTC(2026, 10, 13, 18, 0))}
        cityTz="UTC"
      />
    );
    const adhan = container.querySelector('.ptime');
    const iqamah = container.querySelector('.ptime-iqamah');
    expect(adhan.textContent).toBe('5:27AM');
    expect(adhan.querySelector('.ptime-ampm').textContent).toBe('AM');
    expect(iqamah.querySelector('.ptime-ampm').textContent).toBe('PM');
  });

  it('shows the placeholder when a time is missing', () => {
    const { container } = render(
      <PrayerCard enName="Fajr" arName="الفجر" time={null} iqamahTime={null} cityTz="UTC" />
    );
    expect(container.querySelector('.ptime').textContent).toBe('--:--');
    expect(container.querySelector('.ptime-ampm')).toBeNull();
  });
});

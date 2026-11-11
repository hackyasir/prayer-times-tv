/* @vitest-environment jsdom */
// ── RegionHint.test.jsx ──────────────────────────────────────────────────
//
// The "Usual in {country}" note in Settings: it reports whether the draft
// method and Asr match the location's usual convention, and "Use these"
// changes only the drafts — nothing is applied or saved until Apply.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegionHint from '../settings/RegionHint.jsx';
import { SettingsProvider, useSettings } from '../../context/SettingsContext.jsx';
import { I18nProvider } from '../../i18n/I18nContext.jsx';

function Probe() {
  const { drafts, applied } = useSettings();
  return (
    <output data-testid="probe">
      {`${drafts.method}/${drafts.shadow} applied ${applied.method}/${applied.shadow}`}
    </output>
  );
}

function renderHint(props) {
  return render(
    <SettingsProvider>
      <I18nProvider>
        <RegionHint {...props} />
        <Probe />
      </I18nProvider>
    </SettingsProvider>
  );
}

describe('RegionHint', () => {
  it('offers the usual method when the draft differs, and changes only the drafts', () => {
    // Defaults are Muslim World League + Standard Asr; Canada usually uses ISNA.
    renderHint({ where: { countryCode: 'CA', timeZone: 'America/Toronto' }, place: 'Canada' });
    expect(
      screen.getByText('Usual in Canada: ISNA – North America, Standard Asr.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use these' }));

    expect(
      screen.getByText("✓ Matches what's usual in Canada: ISNA – North America, Standard Asr.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use these' })).toBeNull();
    expect(screen.getByTestId('probe').textContent).toBe('ISNA/1 applied MWL/1');
  });

  it('sets the Asr convention too (Hanafi in Pakistan)', () => {
    renderHint({ where: { countryCode: 'PK' }, place: 'Pakistan' });
    expect(
      screen.getByText('Usual in Pakistan: University of Karachi, Hanafi Asr.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use these' }));
    expect(screen.getByTestId('probe').textContent).toBe('Karachi/2 applied MWL/1');
  });

  it('says "this area" when only the timezone is known', () => {
    renderHint({ where: { timeZone: 'Asia/Dubai' } });
    expect(screen.getByText(/^Usual in this area: Dubai/)).toBeInTheDocument();
  });

  it('suggests checking the mosque timetable where there is no usual method', () => {
    renderHint({
      where: { countryCode: 'GB', timeZone: 'Europe/London' },
      place: 'United Kingdom',
    });
    expect(
      screen.getByText(
        "No usual method on file for United Kingdom — check the method against your mosque's timetable."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

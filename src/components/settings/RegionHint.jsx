// ── RegionHint — "Usual in {country}" note ─────────────────────────────────
//
// Shown under the location card (Masjid tab) and the calculation method
// (Prayer Times tab). Picking a city only pre-selects the method and Asr
// during first-time setup; after that a saved choice is never changed
// silently. This note makes that visible: it says whether the draft method
// and Asr match what's usual for the location and, if not, offers a
// one-click "Use these". The click only changes the drafts; nothing is saved
// until Apply.

import { METHOD_LABELS } from '../../lib/constants.js';
import { regionCalcStatus } from '../../lib/regionDefaults.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT, fmtStr } from '../../i18n/I18nContext.jsx';

/**
 * @param {object} props
 * @param {{ countryCode?: string, timeZone?: string }} props.where  location to compare with
 * @param {string} [props.place]  country name to show; omitted = "this area"
 */
export default function RegionHint({ where, place }) {
  const { t } = useT();
  const { drafts, updateDrafts } = useSettings();
  const result = regionCalcStatus(where, drafts);
  const placeName = place || t('settings.region.here');

  if (result.status === 'none') {
    return (
      <div className="region-hint" data-state="none">
        {fmtStr(t('settings.region.none'), { place: placeName })}
      </div>
    );
  }

  const vars = {
    place: placeName,
    method: METHOD_LABELS[result.method] || result.method,
    asr: t(result.shadow === 2 ? 'settings.region.asr.hanafi' : 'settings.region.asr.standard'),
  };

  if (result.status === 'matches') {
    return (
      <div className="region-hint" data-state="matches">
        ✓ {fmtStr(t('settings.region.matches'), vars)}
      </div>
    );
  }

  return (
    <div className="region-hint" data-state="differs">
      <span>{fmtStr(t('settings.region.differs'), vars)}</span>
      <button
        type="button"
        className="sbtn-meta"
        onClick={() =>
          updateDrafts((prev) => ({ ...prev, method: result.method, shadow: result.shadow }))
        }
      >
        {t('settings.region.apply')}
      </button>
    </div>
  );
}

// ── WeatherStrip — compact weather strip below prayer list ──────────────────
//
// One-row strip showing:
//   [temp]°  [emoji]   Feels like [temp]°   ····   H 21° · L 7°
//
// Sits below the prayer list cards. A glance-level summary of weather
// without a full card. Hides itself when weather data is unavailable
// (offline / fetch error).
//
// Visual goals:
//   - Slim — single line, no card chrome
//   - Decorative: gold-accent temp, dim text for everything else
//   - Hi/Lo aligned to the RIGHT edge (auto-margin via flex)
//   - Feels-like fills middle (more useful than "Overcast" or "Clear Sky")

import { wmoEmoji } from '../../lib/weather.js';
import { useT } from '../../i18n/I18nContext.jsx';

export default function WeatherStrip({ weather, weatherState }) {
  const { t } = useT();

  // Hide entirely when no weather data — empty space is better than
  // showing an error state in this glance-context strip.
  if (weatherState === 'error' && weather === null) return null;
  if (weatherState === 'loading' && weather === null) return null;
  if (!weather) return null;

  const emoji = wmoEmoji(weather.code);
  const hasHiLo = weather.tempMax != null && weather.tempMin != null;

  return (
    <div className="weather-strip" aria-label="Current weather">
      <span className="weather-strip-temp">
        {weather.temp}{weather.unit}
      </span>
      <span className="weather-strip-emoji" aria-hidden="true">
        {emoji}
      </span>
      {/* Feels-like — replaces the previous WMO condition description.
          More relevant than just "Overcast" / "Clear Sky". */}
      {weather.feelsLike != null && (
        <span className="weather-strip-desc">
          {t('widget.weather.feelsLike')} {weather.feelsLike}{weather.unit}
        </span>
      )}
      {/* Hi/Lo — pushed to the right edge via flex auto-margin on this span.
          Hidden when daily forecast values aren't available. */}
      {hasHiLo && (
        <span className="weather-strip-hilo">
          H {weather.tempMax}° · L {weather.tempMin}°
        </span>
      )}
    </div>
  );
}

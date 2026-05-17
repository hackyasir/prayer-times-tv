// ── WeatherStrip — compact weather, embedded below prayer list ──────────────
//
// One-row strip showing current temp + emoji + condition description.
// Designed to sit BELOW the prayer list cards in layoutVariant='embedded',
// where the full WeatherCard widget would be excessive but a glance at
// the weather is still nice context for mosque-goers.
//
// Visual goals:
//   - Slim — single line, no card chrome
//   - Decorative: gold-accent temp, dim text for condition
//   - Hides when weather is unavailable (offline / fetch error)
//   - Same data source as WeatherCard, so no extra fetch

import { wmoEmoji, wmoText } from '../../lib/weather.js';
import { useT } from '../../i18n/I18nContext.jsx';

export default function WeatherStrip({ weather, weatherState }) {
  const { t } = useT();

  // Hide entirely when no weather data — empty space is better than
  // showing an error state in this glance-context strip.
  if (weatherState === 'error' && weather === null) return null;
  if (weatherState === 'loading' && weather === null) return null;
  if (!weather) return null;

  const emoji = wmoEmoji(weather.code, weather.isDay);
  const desc = wmoText(weather.code, t);

  return (
    <div className="weather-strip" aria-label="Current weather">
      <span className="weather-strip-temp">
        {weather.temp}{weather.unit}
      </span>
      <span className="weather-strip-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="weather-strip-desc">
        {desc}
      </span>
      {/* Feels-like — replaces the previous WMO condition description. */}
      {weather.feelsLike != null && (
        <span className="weather-strip-desc">
          {t('widget.weather.feelsLike')} {weather.feelsLike}{weather.unit}
        </span>
      )}
      {/* Hi/Lo — appears after description if both values are available */}
      {weather.tempMax != null && weather.tempMin != null && (
        <span className="weather-strip-hilo">
          H {weather.tempMax}° · L {weather.tempMin}°
        </span>
      )}
    </div>
  );
}

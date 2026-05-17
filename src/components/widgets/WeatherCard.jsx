// ── Weather card — horizontal 4-section strip ───────────────────────────────
//
// Layout: temperature + emoji and description on the left, Hi/Lo column in
// the middle, humidity/wind/rain row pushed to the right. Vertical dividers
// (border-left) separate the sections. No card title — the temp value is
// the visual identifier.
//
// Data shape (the `weather` prop):
//   {
//     temp, feelsLike, tempMax, tempMin   // numbers (rounded)
//     unit                                // '°C' | '°F'
//     code                                // WMO weather code (int)
//     humidity, wind, precip              // numbers
//   }
// or null while loading.

import { wmoEmoji, wmoText } from '../../lib/weather.js';
import { useT } from '../../i18n/I18nContext.jsx';

export default function WeatherCard({ weather, weatherState }) {
  const { t } = useT();
  return (
    <div className="weather-card">
      {weatherState === 'loading' && weather === null && (
        <div className="weather-loading">{t('widget.weather.fetching')}</div>
      )}
      {weatherState === 'error' && weather === null && (
        <div className="weather-loading">{t('widget.weather.unavailable')}</div>
      )}
      {weather && (
        <div style={{ display:'flex', alignItems:'center', gap:'1vw', height:'100%' }}>

          {/* Temperature + emoji, with description + feels-like below */}
          <div style={{ display:'flex', flexDirection:'column', minWidth:0, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.5vw' }}>
              <div className="weather-temp">{weather.temp}{weather.unit}</div>
              <div className="weather-emoji" style={{ fontSize:'calc(clamp(1.5rem, 2.8vw, 3rem) * var(--t-fs, 1))', lineHeight:1 }}>
                {wmoEmoji(weather.code)}
              </div>
            </div>
            <div className="weather-desc" style={{ marginTop:'.15vh' }}>{wmoText(weather.code)}</div>
            <div style={{ fontSize: 'calc(clamp(0.5rem,.85vw,0.812rem) * var(--t-fs, 1))', color:'#9A8B6E', marginTop:'.1vh' }}>
              {t('widget.weather.feelsLike')} {weather.feelsLike}{weather.unit}
            </div>
          </div>

          {/* Hi/Lo vertical stack with left divider */}
          {(weather.tempMax != null && weather.tempMin != null) && (
            <div style={{
              display:'flex', flexDirection:'column', justifyContent:'center',
              gap:'.3vh',
              paddingLeft:'.8vw',
              borderLeft:'1px solid rgba(var(--t-accent-rgb),.10)',
              fontVariantNumeric:'tabular-nums',
              flexShrink:0,
            }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:'calc(clamp(0.563rem,.9vw,0.875rem) * var(--t-fs, 1))', color:'#9A8B6E', letterSpacing:'.1em' }}>{t('widget.weather.hi')}</span>
                <span style={{ fontSize:'calc(clamp(1.125rem,1.85vw,2rem) * var(--t-fs, 1))', fontWeight:700, color:'var(--t-text)', lineHeight:1 }}>{weather.tempMax}°</span>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:'calc(clamp(0.563rem,.9vw,0.875rem) * var(--t-fs, 1))', color:'#9A8B6E', letterSpacing:'.1em' }}>{t('widget.weather.lo')}</span>
                <span style={{ fontSize:'calc(clamp(1.125rem,1.85vw,2rem) * var(--t-fs, 1))', fontWeight:700, color:'var(--t-text-dim)', lineHeight:1 }}>{weather.tempMin}°</span>
              </div>
            </div>
          )}

          {/* Humidity / Wind / Rain row removed — temp + Hi/Lo is enough info
              for a glance widget. Kept here in case it needs to be restored
              behind a setting in the future:
              { humidity: NN%, wind: NN km/h, rain: NN mm } */}
        </div>
      )}
    </div>
  );
}

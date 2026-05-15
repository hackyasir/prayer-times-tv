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

export default function WeatherCard({ weather, weatherState }) {
  return (
    <div className="weather-card">
      {weatherState === 'loading' && weather === null && (
        <div className="weather-loading">Fetching…</div>
      )}
      {weatherState === 'error' && weather === null && (
        <div className="weather-loading">Unavailable</div>
      )}
      {weather && (
        <div style={{ display:'flex', alignItems:'center', gap:'1vw', height:'100%' }}>

          {/* Temperature + emoji, with description + feels-like below */}
          <div style={{ display:'flex', flexDirection:'column', minWidth:0, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.5vw' }}>
              <div className="weather-temp">{weather.temp}{weather.unit}</div>
              <div className="weather-emoji" style={{ fontSize:'clamp(1.5rem, 2.8vw, 3rem)', lineHeight:1 }}>
                {wmoEmoji(weather.code)}
              </div>
            </div>
            <div className="weather-desc" style={{ marginTop:'.15vh' }}>{wmoText(weather.code)}</div>
            <div style={{ fontSize: 'clamp(0.5rem,.85vw,0.812rem)', color:'#9A8B6E', marginTop:'.1vh' }}>
              Feels like {weather.feelsLike}{weather.unit}
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
                <span style={{ fontSize:'clamp(0.563rem,.9vw,0.875rem)', color:'#9A8B6E', letterSpacing:'.1em' }}>HI</span>
                <span style={{ fontSize:'clamp(1.125rem,1.85vw,2rem)', fontWeight:700, color:'var(--t-text)', lineHeight:1 }}>{weather.tempMax}°</span>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontSize:'clamp(0.563rem,.9vw,0.875rem)', color:'#9A8B6E', letterSpacing:'.1em' }}>LO</span>
                <span style={{ fontSize:'clamp(1.125rem,1.85vw,2rem)', fontWeight:700, color:'var(--t-text-dim)', lineHeight:1 }}>{weather.tempMin}°</span>
              </div>
            </div>
          )}

          {/* Humidity / Wind / Rain pushed to right edge */}
          <div style={{
            display:'flex', gap:'1vw', flex:1, justifyContent:'flex-end',
            paddingLeft:'.8vw',
            borderLeft:'1px solid rgba(var(--t-accent-rgb),.10)',
          }}>
            <div className="weather-stat" style={{ alignItems:'flex-start' }}>
              <span className="weather-stat-lbl">Humidity</span>
              <span className="weather-stat-val">{weather.humidity}%</span>
            </div>
            <div className="weather-stat" style={{ alignItems:'flex-start' }}>
              <span className="weather-stat-lbl">Wind</span>
              <span className="weather-stat-val">{weather.wind} km/h</span>
            </div>
            <div className="weather-stat" style={{ alignItems:'flex-start' }}>
              <span className="weather-stat-lbl">Rain</span>
              <span className="weather-stat-val">{weather.precip} mm</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

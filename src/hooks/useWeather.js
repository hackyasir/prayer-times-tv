// ── useWeather — Open-Meteo fetch with auto-refresh ─────────────────────────
//
// Fetches current weather + today's high/low from Open-Meteo whenever
// lat/lng changes. Refreshes every 10 minutes thereafter. No API key needed.
//
// Returns:
//   weather       — shape: { temp, feelsLike, humidity, wind, windDir, precip,
//                            code, unit, tempMax, tempMin } | null
//   weatherState  — 'idle' | 'loading' | 'ok' | 'error'
//
// The weather object is null while loading or on error — components should
// check `weatherState` and handle each state visually.

import { useState, useEffect, useRef } from 'react';
import { WEATHER_API } from '../lib/constants.js';

export default function useWeather(lat, lng) {
  const [weather, setWeather] = useState(null);
  const [weatherState, setWeatherState] = useState('idle'); // idle|loading|ok|error
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather() {
      setWeatherState('loading');
      try {
        const url =
          `${WEATHER_API}?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
          `weather_code,wind_speed_10m,wind_direction_10m,precipitation` +
          `&daily=temperature_2m_max,temperature_2m_min` +
          `&forecast_days=1` +
          `&wind_speed_unit=kmh&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        const c = data.current;
        const d = data.daily;
        setWeather({
          temp: Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          wind: Math.round(c.wind_speed_10m),
          windDir: c.wind_direction_10m,
          precip: c.precipitation,
          code: c.weather_code,
          unit: data.current_units?.temperature_2m ?? '°C',
          tempMax: d?.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null,
          tempMin: d?.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null,
        });
        setWeatherState('ok');
      } catch {
        if (!cancelled) setWeatherState('error');
      }
    }
    fetchWeather();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [lat, lng]);

  return { weather, weatherState };
}

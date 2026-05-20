// ── Weather code interpretation ──────────────────────────────────────────────
//
// Open-Meteo returns WMO (World Meteorological Organization) weather codes —
// integers in a defined set representing conditions like clear sky, drizzle,
// thunderstorm, etc. We map them to human-readable text + a suitable emoji
// for inline display in the weather widget.
//
// Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes)

const WMO = {
  0:'Clear Sky☀️',     1:'Mainly Clear🌤️',  2:'Partly Cloudy⛅',  3:'Overcast☁️',
  45:'Foggy🌫️',        48:'Icy Fog🌫️',
  51:'Light Drizzle🌦️', 53:'Drizzle🌦️',     55:'Heavy Drizzle🌧️',
  61:'Light Rain🌧️',    63:'Rain🌧️',        65:'Heavy Rain🌧️',
  71:'Light Snow🌨️',    73:'Snow🌨️',        75:'Heavy Snow❄️',   77:'Snow Grains🌨️',
  80:'Light Showers🌦️', 81:'Showers🌦️',     82:'Heavy Showers⛈️',
  85:'Snow Showers🌨️',  86:'Heavy Snow Showers❄️',
  95:'Thunderstorm⛈️',  96:'Thunderstorm+Hail⛈️', 99:'Thunderstorm+Hail⛈️',
};

/**
 * Extract the emoji character from the WMO entry, or fall back to 🌡️
 * if the code is unknown. Uses a regex over the higher Unicode ranges
 * where weather emoji live.
 */
export function wmoEmoji(code) {
  const s = WMO[code] ?? '🌡️';
  const m = s.match(/[\u{1F300}-\u{1FFFF}]|[\u2600-\u27BF]/u);
  return m ? m[0] : '🌡️';
}

/**
 * Extract the human-readable label (without the emoji) from the WMO entry.
 *   wmoText(0)  → "Clear Sky"
 *   wmoText(95) → "Thunderstorm"
 *   wmoText(?)  → "Unknown"
 */
export function wmoText(code) {
  const s = WMO[code] ?? 'Unknown';
  // Strip any non-ASCII characters (e.g. icons embedded in dictionary
  // entries by older code). The \x00 in the regex range is intentional
  // — we mean "everything outside ASCII printable".
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x00-\x7F]+/g, '').trim();
}

// ── Prayer Icons ─────────────────────────────────────────────────────────────
// Inline SVG icons for each daily prayer, drawn to match the dashboard's
// gold-accent aesthetic. All icons sit on a 24×24 viewBox, use currentColor
// for stroke so they inherit the parent's text colour, and have rounded
// linecaps for a soft modern look.
//
// Why inline SVG (not icon font, not external library)?
//   - Zero dependencies — bundle stays lean
//   - currentColor inheritance — icons auto-match prayer-card colours
//     (passed=dim, active=bright, etc.) without per-state code
//   - Easy to tweak — each prayer's icon is just a small JSX block below

import React from 'react';

const COMMON = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// Fajr — sun rising from the horizon. Half-disc with rays + horizon line.
function FajrIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <path d="M3 18h18"/>                       {/* horizon */}
      <path d="M7 18a5 5 0 0 1 10 0"/>           {/* half-sun above horizon */}
      <path d="M12 4v2"/>                        {/* top ray */}
      <path d="M4.93 9.93l1.41 1.41"/>           {/* upper-left ray */}
      <path d="M19.07 9.93l-1.41 1.41"/>         {/* upper-right ray */}
      <path d="M2 14h2"/>                        {/* side ray L */}
      <path d="M22 14h-2"/>                      {/* side ray R */}
    </svg>
  );
}

// Sunrise (observational, between Fajr and Dhuhr) — full sun rising,
// slightly higher than Fajr. Distinguishable from Fajr by the angle.
function SunriseIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 3v1.5"/>
      <path d="M12 19.5V21"/>
      <path d="M3 12h1.5"/>
      <path d="M19.5 12H21"/>
      <path d="M5.6 5.6l1.1 1.1"/>
      <path d="M17.3 17.3l1.1 1.1"/>
      <path d="M5.6 18.4l1.1-1.1"/>
      <path d="M17.3 6.7l1.1-1.1"/>
    </svg>
  );
}

// Dhuhr — sun directly overhead. Full sun with 8 rays (max brightness).
function DhuhrIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <circle cx="12" cy="12" r="3.5"/>
      <path d="M12 2v2"/>
      <path d="M12 20v2"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
      <path d="M4.9 4.9l1.4 1.4"/>
      <path d="M17.7 17.7l1.4 1.4"/>
      <path d="M4.9 19.1l1.4-1.4"/>
      <path d="M17.7 6.3l1.4-1.4"/>
    </svg>
  );
}

// Asr — afternoon sun lower in the sky with a long shadow cue (small line
// extending down-right from the sun). Diagonal stroke gives the "tilted"
// late-afternoon feeling.
function AsrIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <circle cx="10" cy="10" r="3.5"/>
      <path d="M10 4v1.5"/>
      <path d="M4 10h1.5"/>
      <path d="M5.8 5.8l1.1 1.1"/>
      <path d="M14.2 5.8l-1.1 1.1"/>
      <path d="M16 10h-1.5"/>
      <path d="M13 18l5 4"/>                     {/* shadow line trailing */}
    </svg>
  );
}

// Maghrib — sun setting below horizon. Mirror of Fajr but visually inverted
// (sun's larger half is BELOW the line and dipping — sunset).
function MaghribIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <path d="M3 17h18"/>                       {/* horizon */}
      <path d="M7 17a5 5 0 0 0 10 0"/>           {/* upper half of sun above */}
      <path d="M2 21l3-2"/>                      {/* sun sinking — diagonal */}
      <path d="M22 21l-3-2"/>
      <path d="M12 6v2"/>
      <path d="M5.5 9.5l1.4 1.4"/>
      <path d="M18.5 9.5l-1.4 1.4"/>
    </svg>
  );
}

// Isha — night. Crescent moon with a small star nearby.
function IshaIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>  {/* crescent */}
      <path d="M5 7l.3.9.9.3-.9.3-.3.9-.3-.9L3.8 8.2l.9-.3z"/>       {/* small star */}
    </svg>
  );
}

const ICON_MAP = {
  fajr:    FajrIcon,
  sunrise: SunriseIcon,
  dhuhr:   DhuhrIcon,
  asr:     AsrIcon,
  maghrib: MaghribIcon,
  isha:    IshaIcon,
};

/** Render the SVG icon for a given prayer key. Returns null for unknown
 *  keys (e.g. 'jumuah', 'eid') — those have their own visual identity. */
export default function PrayerIcon({ prayerKey }) {
  const Icon = ICON_MAP[prayerKey];
  if (!Icon) return null;
  return <Icon/>;
}

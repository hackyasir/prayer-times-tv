// ── Prayer Icons ─────────────────────────────────────────────────────────────
// Inline SVG icons for the 5 daily prayers + sunrise. Designed for small
// sizes (typically 1em ≈ 16-32px), so each icon is a BOLD SILHOUETTE built
// from a small number of primitive shapes — readable at thumbnail scale.
//
// Design language
// ───────────────
// Inspired by Muslim Pro / Athan / Apple Weather icon systems:
//   - Each icon = ONE recognisable silhouette, not a story
//   - Mix of filled and stroked primitives (strokes alone disappear small)
//   - Symbolic distinctiveness: each prayer has its own visual identity
//   - Horizon line consistency across Fajr / Sunrise / Maghrib so the
//     viewer can read "where the sun is" at a glance
//
// Visual identity per prayer
// ──────────────────────────
//   Fajr     waning crescent + small star = pre-dawn moonlight
//   Sunrise  filled half-sun ABOVE horizon line = sun emerging
//   Dhuhr    full filled disk + minimal rays = sun overhead, peak
//   Asr      filled disk in upper-right + cloud below = afternoon sun + cloud
//   Maghrib  filled half-sun BELOW horizon line = sun setting
//   Isha     full filled crescent + star = full night
//
// The Fajr-Isha pair (both crescents) bookends the day. Sunrise-Maghrib
// pair (filled half-suns) frames daylight. Dhuhr and Asr are the unique
// daylight states between.

// (No React default-import needed — Vite's @vitejs/plugin-react handles
// the JSX transform automatically. Was a leftover from React 16-style.)


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

// Fajr — pre-dawn. Small waning crescent moon (lower-left) + a small star
// in the upper-RIGHT corner (clear space where the crescent doesn't reach).
// Crescent is FILLED so it reads as a moon; star is also filled but sits
// at a distance from the crescent so neither shape eats the other.
function FajrIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      {/* Waning crescent — lit edge on the LEFT (sun rises on right side,
       * so the moon's bright side faces the upcoming sunrise direction).
       * Positioned in the lower-left of the icon. */}
      <path d="M14 17a6 6 0 1 1-4-10 5 5 0 0 0 4 10z"
            fill="currentColor"/>
      {/* 4-pointed star — upper-RIGHT, well clear of the crescent.
       * Drawn larger (full burst) so it's visible at icon size. No stroke
       * at all — pure filled shape using currentColor, same as the crescent. */}
      <path d="M19 2l1 3.5L23.5 6.5l-3.5 1L19 11l-1-3.5L14.5 6.5l3.5-1z"
            fill="currentColor" stroke="none"/>
    </svg>
  );
}

// Sunrise (observational, between Fajr and Dhuhr) — filled half-disc
// sitting ON the horizon line, rising upward.
// Uses a filled half-sun (semi-circle) so it reads decisively as "sun is
// here, not yet a moon". Mirror of Maghrib but the disc is above the line.
function SunriseIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      {/* Horizon */}
      <path d="M2 17h20" strokeWidth="1.6"/>
      {/* Filled half-disc above horizon */}
      <path d="M6 17a6 6 0 0 1 12 0z"
            fill="currentColor" stroke="none"/>
      {/* Up-arrow indicator above the sun */}
      <path d="M12 8V4"/>
      <path d="M9.5 6.5L12 4l2.5 2.5"/>
    </svg>
  );
}

// Dhuhr — sun overhead at peak. Single bold filled disk + minimal rays
// (4 cardinal only — adding 4 more would clutter at icon size). The
// FILLED disk is the headline element; rays are secondary.
function DhuhrIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      {/* Filled sun disc */}
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
      {/* 4 cardinal rays — kept short and bold */}
      <path d="M12 2v3"/>
      <path d="M12 19v3"/>
      <path d="M2 12h3"/>
      <path d="M19 12h3"/>
      {/* 4 diagonal short rays for fullness without clutter */}
      <path d="M5 5l1.8 1.8"/>
      <path d="M17.2 17.2l1.8 1.8"/>
      <path d="M5 19l1.8-1.8"/>
      <path d="M17.2 6.8l1.8-1.8"/>
    </svg>
  );
}

// Asr — afternoon. Sun + cloud combo: filled sun in upper-right is
// PARTIALLY OCCLUDED by a stroked cloud in lower-left. The cloud-with-sun
// motif is universal shorthand for "afternoon" in weather UIs (Apple
// Weather, OpenWeatherMap, etc.) and instantly distinguishes Asr from
// Dhuhr at icon size.
function AsrIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      {/* Filled sun in upper-right, slightly behind the cloud */}
      <circle cx="16" cy="8" r="3" fill="currentColor" stroke="none"/>
      {/* Short rays around the visible portion */}
      <path d="M16 2v2"/>
      <path d="M21 8h-1.5"/>
      <path d="M19.5 4.5l-1.1 1.1"/>
      <path d="M19.5 11.5l-1.1-1.1"/>
      {/* Cloud — stroked outline, overlaps the lower-left of the sun */}
      <path d="M5 17a3 3 0 0 1 1.5-5.6 4 4 0 0 1 7.5 1.6A2.5 2.5 0 0 1 14 17z"
            fill="var(--t-bg, #000)"
            stroke="currentColor"/>
    </svg>
  );
}

// Maghrib — sun setting. Filled half-disc sitting ON the horizon, but
// the lower half is BELOW the line — sun is sinking. Plus a down arrow.
// Mirror of Sunrise.
function MaghribIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      {/* Horizon */}
      <path d="M2 12h20" strokeWidth="1.6"/>
      {/* Filled half-disc — upper portion above line, the part that's
       * still visible as the sun sets */}
      <path d="M6 12a6 6 0 0 1 12 0z"
            fill="currentColor" stroke="none"/>
      {/* Down-arrow indicator below the horizon */}
      <path d="M12 16v4"/>
      <path d="M9.5 17.5L12 20l2.5-2.5"/>
    </svg>
  );
}

// Isha — full night. Waxing crescent (lit edge on the RIGHT, mirror of
// Fajr) + a star in the upper-LEFT corner where the crescent doesn't reach.
// Both crescents bookend the day visually but face opposite directions:
// Fajr's lit side faces left (toward the just-departed sun), Isha's lit
// side faces right (toward the soon-to-rise sun).
function IshaIcon() {
  return (
    <svg {...COMMON} aria-hidden="true">
      {/* Waxing crescent — lit edge on the RIGHT */}
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"
            fill="currentColor"/>
      {/* 4-pointed star — nestled in the crescent's hollow (concave side).
       * The waxing crescent's lit edge curves around the right, leaving an
       * empty space at roughly (13, 9) where a star tucks in naturally.
       * Same fill color so star + crescent read as a single "moon and star"
       * Islamic motif (☪). */}
      <path d="M14 7l.7 2.3L17 10l-2.3.7L14 13l-.7-2.3L11 10l2.3-.7z"
            fill="currentColor" stroke="none"/>
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

// ── Qibla Compass — small SVG with rotating needle ──────────────────────────
//
// Visual: 50×50 viewBox circle with cardinal points (N/S/E/W) and a needle
// that rotates to point toward Mecca. The needle's bright half points to
// Qibla (the bearing prop in degrees); the dim half is the tail.
//
// Colors pull from theme via CSS variables. Falls back to gold (#C9A84C)
// if no theme is applied (e.g. when rendered outside an App context).

export default function QiblaCompass({ bearing }) {
  return (
    <svg viewBox="0 0 50 50" className="qibla-compass-svg">
      {/* Outer ring */}
      <circle
        cx="25"
        cy="25"
        r="23"
        fill="none"
        stroke="rgba(var(--t-accent-rgb, 201,168,76), .2)"
        strokeWidth="1"
      />
      {/* Center dot */}
      <circle cx="25" cy="25" r="1.5" fill="var(--t-accent, #C9A84C)" />

      {/* The rotating needle. SVG rotation centred on (25,25). The bright
          arrow points to Qibla; the dim triangle is the opposite tail. */}
      <g transform={`rotate(${bearing} 25 25)`}>
        <path d="M25 5L28 22L25 20L22 22Z" fill="var(--t-accent, #C9A84C)" opacity=".9" />
        <path d="M25 45L28 28L25 30L22 28Z" fill="rgba(var(--t-accent-rgb, 201,168,76), .25)" />
      </g>

      {/* Cardinal direction letters (N/S/E/W) */}
      {[
        ['N', 25, 4],
        ['S', 25, 49],
        ['E', 47, 26.5],
        ['W', 3, 26.5],
      ].map(([l, x, y]) => (
        <text
          key={l}
          x={x}
          y={y}
          textAnchor="middle"
          fontSize="4"
          fill="rgba(var(--t-accent-rgb, 201,168,76), .5)"
          fontFamily="Rajdhani"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

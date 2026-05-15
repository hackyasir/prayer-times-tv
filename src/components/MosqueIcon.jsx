// ── Persian Mandala icon ─────────────────────────────────────────────────────
// Theme-aware, prayer-aware animated SVG header icon.
//
//   - Background disc:  prayer-context radial gradient (Fajr indigo,
//                       Asr amber, Isha deep-blue night, etc.)
//   - Mandala lines:    theme accent gradient (gold/emerald/blue per theme)
//   - Crescent moon:    opacity reflects current lunar phase (0..1)
//   - Five-point star:  pulses subtly, opacity also moon-phase-aware
//   - Outer dashed ring: counter-rotates over 25s
//   - Breathing pulse:   outer circle expands/contracts over 5s
//
// All SVG defs use useId() suffixes so multiple instances on a page never
// collide on gradient/filter IDs.

import { useId } from 'react';

export default function MosqueIcon({ activePrayer = 'dhuhr', lunarPhase = 0.5 }) {
  // Unique IDs per mount so SVG <defs> don't share/collide
  const uid    = useId().replace(/[^a-z0-9]/gi, '');
  const bgId   = `mq_bg_${uid}`;
  const goldId = `mq_gold_${uid}`;
  const glowId = `mq_glow_${uid}`;

  // Prayer-context background palette — radial gradient (centre → edge).
  // Tuned to evoke each time of day: indigo dawn, ember sunrise, blue noon, etc.
  const PRAYER_BG = {
    fajr:    { bg1: '#1f1450', bg2: '#04020f' }, // pre-dawn indigo
    sunrise: { bg1: '#5a1f08', bg2: '#1a0500' }, // ember sunrise
    dhuhr:   { bg1: '#0e3a52', bg2: '#02101d' }, // noon sky
    asr:     { bg1: '#4a2808', bg2: '#1a0c00' }, // amber afternoon
    maghrib: { bg1: '#3a0820', bg2: '#0d0006' }, // crimson sunset
    isha:    { bg1: '#0b2235', bg2: '#03050d' }, // deep night
  };
  const bg = PRAYER_BG[activePrayer] || PRAYER_BG.dhuhr;

  // Crescent + star opacity react to lunar phase:
  // Full moon → bright; new moon → near-invisible.
  const moonOp = (0.35 + lunarPhase * 0.55).toFixed(2); // 0.35 .. 0.90
  const starOp = (0.55 + lunarPhase * 0.35).toFixed(2); // 0.55 .. 0.90

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      style={{
        width:  'clamp(40px, 4vw, 80px)',
        height: 'clamp(40px, 4vw, 80px)',
        flexShrink: 0,
      }}>
      <defs>
        {/* Radial backdrop — prayer-context colour */}
        <radialGradient id={bgId} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor={bg.bg1} />
          <stop offset="100%" stopColor={bg.bg2} />
        </radialGradient>
        {/* Theme accent gradient for mandala/crescent/star */}
        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--t-accent-hi, #f5d27a)" />
          <stop offset="50%"  stopColor="var(--t-accent, #d4af37)" />
          <stop offset="100%" stopColor="var(--t-accent-dim, #8c6b1f)" />
        </linearGradient>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2"/>
        </filter>
      </defs>

      {/* Backdrop disc */}
      <circle cx="50" cy="50" r="48" fill={`url(#${bgId})`} />

      {/* Persian mandala: decagram + tear-drop loop + rotating dashed ring */}
      <g transform="translate(50,50)" stroke={`url(#${goldId})`} fill="none">
        {/* Outer 8-point star */}
        <polygon points="0,-30 10,-10 30,0 10,10 0,30 -10,10 -30,0 -10,-10"
          strokeWidth="1.2"/>
        {/* Inner vesica/tear-drop loop */}
        <path d="M0 -20 C10 -10 10 10 0 20 C-10 10 -10 -10 0 -20 Z"
          strokeWidth="0.8" opacity="0.8"/>
        {/* Counter-rotating dashed ring — 25s */}
        <g>
          <circle r="18" strokeWidth="0.6" strokeDasharray="2 4"/>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="25s"
            repeatCount="indefinite"/>
        </g>
      </g>

      {/* Crescent moon — opacity reflects lunar phase */}
      <path d="M58 35 A15 15 0 1 0 58 65 A12 12 0 1 1 58 35 Z"
        fill={`url(#${goldId})`}
        opacity={moonOp}
        filter={`url(#${glowId})`}/>

      {/* Five-point star — pulses 2.5s */}
      <polygon points="65,45 67,50 72,50 68,53 70,58 65,55 60,58 62,53 58,50 63,50"
        fill={`url(#${goldId})`}
        opacity={starOp}>
        <animate attributeName="opacity"
          values={`${(Number(starOp) * 0.7).toFixed(2)};${starOp};${(Number(starOp) * 0.7).toFixed(2)}`}
          dur="2.5s"
          repeatCount="indefinite"/>
      </polygon>

      {/* Breathing outer pulse — 5s */}
      <circle cx="50" cy="50" r="40"
        stroke={`url(#${goldId})`}
        strokeWidth="0.8"
        opacity="0.2"
        fill="none">
        <animate attributeName="r"
          values="38;42;38"
          dur="5s"
          repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

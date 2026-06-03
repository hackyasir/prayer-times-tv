// ── viewingScale.js — distance-based legibility scaling ──────────────────────
//
// Legibility at distance is governed by ANGULAR size on the viewer's retina:
//
//     angular size (arc-min) = (cap_height / viewing_distance) × 3438
//
// The industry rule of thumb (ADA / signage consensus) is ~1 inch of cap
// height per 10 ft of distance for legibility, and ~1 inch per 15 ft
// (Extron) for COMFORTABLE extended reading. Screen size alone can't tell us
// this — the missing variable is distance to the furthest viewer — so we let
// the admin express distance in plain terms and convert it to a multiplier.
//
// The multipliers below are calibrated so the default app type (already tuned
// for a ~15 ft "close" room) scales up proportionally as distance grows. They
// are intentionally rounded to sensible steps; the calibrate mode exists for
// anyone who wants to fine-tune by eye from the actual far point.

export const DISTANCE_PRESETS = {
  close: { feet: 15, scale: 1.0 }, // small room / musalla / office
  medium: { feet: 30, scale: 1.4 }, // medium hall
  large: { feet: 50, scale: 1.9 }, // large hall, corner-mounted TV
  grand: { feet: 80, scale: 2.5 }, // grand hall / far corner
};

export const DISTANCE_ORDER = ['close', 'medium', 'large', 'grand'];

const CAL_MIN = 0.8;
const CAL_MAX = 3.0;

export function clampCalibration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1.0;
  return Math.min(CAL_MAX, Math.max(CAL_MIN, n));
}

/**
 * Resolve the viewing-distance multiplier for the chosen mode.
 *   manual    → 1 (only the fontScale slider applies)
 *   distance  → preset multiplier for the chosen distance bucket
 *   calibrate → the user's by-eye custom multiplier (clamped)
 */
export function resolveViewingScale({ mode, distance, calibrated } = {}) {
  if (mode === 'distance') {
    return DISTANCE_PRESETS[distance]?.scale ?? DISTANCE_PRESETS.medium.scale;
  }
  if (mode === 'calibrate') {
    return clampCalibration(calibrated);
  }
  return 1.0; // manual (or unknown) → no distance scaling
}

/**
 * Final global type multiplier fed to --t-fs.
 * Combines the manual fontScale (%) with the distance/calibration scale.
 */
export function resolveTypeScale({ fontScale, mode, distance, calibrated } = {}) {
  const base = (Number(fontScale) || 100) / 100;
  return base * resolveViewingScale({ mode, distance, calibrated });
}

// ── lib/moonPhase.js — drawing the moon's lit part ───────────────────────────
//
// The lit part of the moon is bounded by half of the limb (a semicircle) and
// the terminator, which seen from Earth is half an ellipse with the same
// height as the disc and a width that depends on the illuminated fraction k:
// it crosses the moon's equator at x = r·(1 − 2k) from the centre, measured
// toward the bright limb. So:
//   k = 0      new moon        nothing lit
//   k < ½      crescent        terminator bulges toward the bright limb
//   k = ½      quarter         terminator is a straight line (half lit)
//   k > ½      gibbous         terminator bulges away from the bright limb
//   k = 1      full moon       whole disc
//
// The shape is built with the bright limb on the right (+x) and then rotated
// to where the bright limb really points (toward the sun), so the same code
// covers waxing and waning, the tilt of the crescent, and the southern
// hemisphere.

const r1 = (n) => Math.round(n * 100) / 100;

/**
 * SVG path of the lit part, bright limb toward +x.
 * @param {number} fraction  illuminated fraction 0..1
 * @returns {string} '' when nothing is lit
 */
export function moonLitPath(cx, cy, r, fraction) {
  const k = Math.min(1, Math.max(0, Number(fraction) || 0));
  const top = `${r1(cx)} ${r1(cy - r)}`;
  const bottom = `${r1(cx)} ${r1(cy + r)}`;
  if (k < 0.002) return '';
  if (k > 0.998) {
    return `M${top}A${r1(r)} ${r1(r)} 0 1 1 ${bottom}A${r1(r)} ${r1(r)} 0 1 1 ${top}Z`;
  }
  const limb = `M${top}A${r1(r)} ${r1(r)} 0 0 1 ${bottom}`;
  const t = r * (1 - 2 * k); // terminator crossing, + toward the bright limb
  if (Math.abs(t) < 0.005 * r) return `${limb}Z`; // quarter: straight edge
  // Bottom → top: through +x (sweep 0) for a crescent, −x (sweep 1) for gibbous.
  return `${limb}A${r1(Math.abs(t))} ${r1(r)} 0 0 ${t > 0 ? 0 : 1} ${top}Z`;
}

/**
 * Screen rotation (degrees, clockwise) that turns the +x bright limb toward
 * the sun, from the bright limb's angle measured from the zenith toward the
 * east — suncalc's `illumination.angle − position.parallacticAngle`.
 * Seen in the sky, that angle runs from straight up toward the left (east),
 * so 0 → up (−90°), −π/2 → right (0°), +π/2 → left (180°).
 */
export function brightLimbRotation(zenithAngle) {
  return (Math.atan2(-Math.cos(zenithAngle), -Math.sin(zenithAngle)) * 180) / Math.PI;
}

/**
 * Fraction and rotation for a point in the lunar cycle (0 = new, 0.5 = full),
 * without a location: waxing lit on the right, waning on the left, as seen
 * from the northern hemisphere. Used for previews.
 */
export function phaseShape(phase) {
  const p = ((Number(phase) % 1) + 1) % 1;
  return { fraction: (1 - Math.cos(2 * Math.PI * p)) / 2, rotation: p < 0.5 ? 0 : 180 };
}

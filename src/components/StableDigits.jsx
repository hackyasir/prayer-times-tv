// ── StableDigits — ticking numbers that don't shift ─────────────────────────
//
// Rajdhani has no tabular (fixed-width) figures — font-variant-numeric:
// tabular-nums has no effect, and a "1" is about 60% as wide as a "0". A
// centred clock or countdown therefore changes width every second and slides
// left and right. Giving every digit its own fixed-width cell (.sd, 1ch = the
// width of "0") keeps the overall width constant, whatever the font.
//
// Non-digit characters (":", spaces, "AM"/"PM") render as plain text.

export default function StableDigits({ text }) {
  return Array.from(String(text ?? '')).map((ch, i) =>
    ch >= '0' && ch <= '9' ? (
      <span key={i} className="sd">
        {ch}
      </span>
    ) : (
      ch
    )
  );
}

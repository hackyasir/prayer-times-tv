// ── NumberStepper — touch-friendly number input with explicit +/- buttons ───
//
// WHY THIS EXISTS
// ─────────────────
// `<input type="number">` shows browser-native spinner buttons on desktop,
// but iOS Safari renders NO spinners at all. Users on iPhone can only type
// values via the keyboard — there's no way to nudge a value up or down by
// tapping. This makes settings like iqamah offsets nearly unusable on
// mobile devices (the primary admin device for many mosques).
//
// This component wraps a number input with explicit −/+ buttons that work
// the same on every platform. The input remains keyboard-editable for
// power users.
//
// USAGE
// ─────
//   <NumberStepper value={mins} onChange={setMins} min={0} max={60} step={5} />
//
// PROPS
//   value     current numeric value (number or numeric string)
//   onChange  callback(newValue) — receives a number
//   min/max   bounds (clamped automatically)
//   step      increment per +/- click (default 1)
//   width     input field width in px (default 44, matches existing inputs)
//   disabled  if true, both buttons + input are inert

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  width = 44,
  disabled = false,
}) {
  const clamp = v => Math.min(max, Math.max(min, v));
  const current = Number(value) || 0;

  // The increment/decrement handlers clamp to min/max so values never
  // escape bounds even if the user mashes the buttons.
  const decrement = () => { if (!disabled) onChange(clamp(current - step)); };
  const increment = () => { if (!disabled) onChange(clamp(current + step)); };

  const btnStyle = {
    background: 'rgba(201,168,76,.08)',
    border: '1px solid rgba(201,168,76,.3)',
    borderRadius: 3,
    width: 28,
    height: 28,
    color: '#C9A84C',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    // Touch-friendly tap behavior — disable browser's text-selection on
    // rapid tapping (otherwise iOS highlights the "-" character)
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || current <= min}
        aria-label="Decrease"
        style={{ ...btnStyle, opacity: (disabled || current <= min) ? 0.3 : 1 }}
      >−</button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={current}
        onChange={e => {
          // Strip non-digits, clamp to bounds. Empty input → 0.
          const cleaned = e.target.value.replace(/[^0-9]/g, '');
          onChange(clamp(Number(cleaned) || 0));
        }}
        disabled={disabled}
        style={{
          width, background: '#0A0A0A', border: '1px solid rgba(201,168,76,.3)',
          borderRadius: 3, padding: '4px 6px', color: '#F0C96A',
          fontFamily: 'Rajdhani,sans-serif', fontSize: 15, fontWeight: 700,
          textAlign: 'center', outline: 'none',
          // Belt-and-suspenders: hide any browser-native number spinner that
          // might leak through (iOS Safari, some Android browsers). With
          // type="text" these rules are normally moot but cost nothing.
          appearance: 'textfield',
          WebkitAppearance: 'textfield',
          MozAppearance: 'textfield',
        }}
      />
      <button
        type="button"
        onClick={increment}
        disabled={disabled || current >= max}
        aria-label="Increase"
        style={{ ...btnStyle, opacity: (disabled || current >= max) ? 0.3 : 1 }}
      >+</button>
    </div>
  );
}

/* @vitest-environment jsdom */
// ── NumberStepper.test.jsx ───────────────────────────────────────────────
//
// Component tests for src/components/NumberStepper.jsx — the touch-friendly
// number input with explicit +/- buttons (built specifically because iOS
// Safari renders zero spinner UI for type="number").
//
// Coverage focus:
//   - +/- button increments/decrements by `step`
//   - min/max clamping (cannot exceed bounds even on rapid clicks)
//   - Disabled state (component-level and button-level for at-min/at-max)
//   - Text-input fallback strips non-digits (iOS-specific behavior)
//   - onChange receives a NUMBER, not a string (regression — auto-iqamah
//     buffer math broke when this returned strings)

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumberStepper from '../NumberStepper.jsx';

// Helper — locates the − and + buttons by aria-label. Using aria-labels
// instead of text matching keeps tests resilient to icon/text changes.
const getMinus = () => screen.getByRole('button', { name: /decrease/i });
const getPlus  = () => screen.getByRole('button', { name: /increase/i });
const getInput = () => screen.getByRole('textbox');

describe('NumberStepper — rendering', () => {
  it('renders the +/- buttons and value input', () => {
    render(<NumberStepper value={5} onChange={() => {}} />);
    expect(getMinus()).toBeInTheDocument();
    expect(getPlus()).toBeInTheDocument();
    expect(getInput()).toBeInTheDocument();
  });

  it('displays the current value in the input', () => {
    render(<NumberStepper value={15} onChange={() => {}} />);
    expect(getInput()).toHaveValue('15');
  });

  it('coerces non-numeric value props to 0', () => {
    render(<NumberStepper value={null} onChange={() => {}} />);
    expect(getInput()).toHaveValue('0');
  });
});

describe('NumberStepper — increment / decrement', () => {
  it('+ button calls onChange with value + step', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={10} step={5} onChange={handleChange} />);
    await user.click(getPlus());
    expect(handleChange).toHaveBeenCalledWith(15);
  });

  it('- button calls onChange with value - step', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={10} step={5} onChange={handleChange} />);
    await user.click(getMinus());
    expect(handleChange).toHaveBeenCalledWith(5);
  });

  it('default step is 1', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={10} onChange={handleChange} />);
    await user.click(getPlus());
    expect(handleChange).toHaveBeenCalledWith(11);
  });

  it('onChange always receives a number (regression: auto-iqamah math)', async () => {
    // Old version passed strings from the input event; downstream Number()
    // coercion absorbed it. This test asserts the contract directly.
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={10} onChange={handleChange} />);
    await user.click(getPlus());
    const passedValue = handleChange.mock.calls[0][0];
    expect(typeof passedValue).toBe('number');
  });
});

describe('NumberStepper — clamping', () => {
  it('+ does not exceed max', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={60} max={60} step={5} onChange={handleChange} />);
    await user.click(getPlus());
    // At max, the button is disabled — onChange should not fire.
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('- does not go below min', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={0} min={0} step={5} onChange={handleChange} />);
    await user.click(getMinus());
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('+ near max clamps to max instead of overshooting', async () => {
    // value=58, step=5, max=60 → clicking + should land on 60, not 63.
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={58} max={60} step={5} onChange={handleChange} />);
    await user.click(getPlus());
    expect(handleChange).toHaveBeenCalledWith(60);
  });

  it('- near min clamps to min instead of undershooting', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={2} min={0} step={5} onChange={handleChange} />);
    await user.click(getMinus());
    expect(handleChange).toHaveBeenCalledWith(0);
  });
});

describe('NumberStepper — button enabled/disabled states', () => {
  it('disables - button when value is at min', () => {
    render(<NumberStepper value={0} min={0} onChange={() => {}} />);
    expect(getMinus()).toBeDisabled();
    expect(getPlus()).not.toBeDisabled();
  });

  it('disables + button when value is at max', () => {
    render(<NumberStepper value={60} max={60} onChange={() => {}} />);
    expect(getPlus()).toBeDisabled();
    expect(getMinus()).not.toBeDisabled();
  });

  it('enables both buttons when value is in the middle', () => {
    render(<NumberStepper value={30} min={0} max={60} onChange={() => {}} />);
    expect(getMinus()).not.toBeDisabled();
    expect(getPlus()).not.toBeDisabled();
  });
});

describe('NumberStepper — disabled prop', () => {
  it('disables both buttons when disabled=true', () => {
    render(<NumberStepper value={30} disabled onChange={() => {}} />);
    expect(getMinus()).toBeDisabled();
    expect(getPlus()).toBeDisabled();
  });

  it('disables the input when disabled=true', () => {
    render(<NumberStepper value={30} disabled onChange={() => {}} />);
    expect(getInput()).toBeDisabled();
  });

  it('does not call onChange when disabled and + is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={30} disabled onChange={handleChange} />);
    // userEvent doesn't fire click on disabled buttons; ensure no onChange.
    await user.click(getPlus()).catch(() => {});
    expect(handleChange).not.toHaveBeenCalled();
  });
});

describe('NumberStepper — text input behavior (iOS fallback)', () => {
  // Helper — a tiny controlled wrapper that mirrors how real parents use
  // NumberStepper. Without this, typing into a fixed-value prop has no
  // observable effect: the input snaps back each render. Real-world
  // callsites (Settings panel) ALWAYS update value via state, so this
  // wrapper matches production behavior more faithfully than passing a
  // raw spy with a static value.
  function Controlled({ initial = 0, spy, ...rest }) {
    const [v, setV] = useState(initial);
    return (
      <NumberStepper
        value={v}
        onChange={(n) => { setV(n); spy?.(n); }}
        {...rest}
      />
    );
  }

  it('input is type="text" with inputMode="numeric" (iOS spinner fix)', () => {
    render(<NumberStepper value={30} onChange={() => {}} />);
    const input = getInput();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'numeric');
  });

  it('typing a digit updates the value via onChange', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled initial={30} spy={spy} />);
    await user.clear(getInput());
    await user.type(getInput(), '42');
    // Multiple onChange calls happen during typing; final value is 42.
    expect(spy).toHaveBeenLastCalledWith(42);
  });

  it('typing letters is stripped (only digits accepted)', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled initial={0} spy={spy} />);
    await user.type(getInput(), 'a5b7c');
    // All non-digit chars stripped; final onChange has 57 (digits only).
    expect(spy).toHaveBeenLastCalledWith(57);
  });

  it('empty input becomes 0 via onChange', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled initial={30} spy={spy} />);
    await user.clear(getInput());
    expect(spy).toHaveBeenLastCalledWith(0);
  });
});

/* @vitest-environment jsdom */
// ── StableDigits.test.jsx ────────────────────────────────────────────────
// Digits get fixed-width cells; everything else stays plain text.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StableDigits from '../StableDigits.jsx';

describe('StableDigits', () => {
  it('wraps only digits in .sd cells and keeps the text intact', () => {
    const { container } = render(
      <span>
        <StableDigits text="12:05 PM" />
      </span>
    );
    const cells = container.querySelectorAll('.sd');
    expect([...cells].map((c) => c.textContent)).toEqual(['1', '2', '0', '5']);
    expect(container.textContent).toBe('12:05 PM');
  });

  it('accepts numbers and empty values', () => {
    const { container } = render(
      <span>
        <StableDigits text={45} />|<StableDigits text={null} />
      </span>
    );
    expect(container.textContent).toBe('45|');
    expect(container.querySelectorAll('.sd')).toHaveLength(2);
  });
});

// ── cssMathFallback.test.js ──────────────────────────────────────────────
// The build step that gives clamp()/min()/max() rules a plain fallback for
// TV browsers older than Chromium 79.

import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { mathFallback, cssMathFallback } from '../cssMathFallback.js';

describe('mathFallback', () => {
  it('uses the preferred value of clamp()', () => {
    expect(mathFallback('clamp(34px, 3.8vw, 66px)')).toBe('3.8vw');
    expect(mathFallback('calc(clamp(2rem, 6vw, 5rem) * var(--t-fs, 1))')).toBe(
      'calc(6vw * var(--t-fs, 1))'
    );
  });

  it('uses the fixed cap of min() and the relative value of max()', () => {
    expect(mathFallback('min(92%, 700px)')).toBe('700px');
    expect(mathFallback('min(520px, 92vw)')).toBe('520px');
    expect(mathFallback('max(1rem, 3vw)')).toBe('3vw');
  });

  it('resolves nested functions and keeps the rest of the value', () => {
    expect(mathFallback('0 clamp(8px, 1vw, 16px) clamp(4px, 0.5vw, 8px)')).toBe('0 1vw 0.5vw');
    expect(mathFallback('clamp(1rem, min(2vw, 40px), 3rem)')).toBe('40px');
  });

  it('leaves values alone that need no fallback', () => {
    expect(mathFallback('12px')).toBeNull();
    expect(mathFallback('repeat(2, minmax(0, 1fr))')).toBeNull(); // minmax() is not min()
    // Container-query values only apply where container queries work.
    expect(mathFallback('max(0.75rem, min(calc(2.4cqi * 2), 4.5cqi))')).toBeNull();
  });
});

describe('cssMathFallback plugin', () => {
  const run = (css) => postcss([cssMathFallback()]).process(css, { from: undefined }).css;

  it('adds an @supports-not block after the rule, so new browsers ignore it', () => {
    const out = run('.a { font-size: clamp(1rem, 2vw, 3rem); color: red; }');
    expect(out).toContain('@supports not (width: clamp(1px, 1px, 1px))');
    expect(out).toMatch(/@supports not[^{]*\{\s*\.a\s*\{\s*font-size: 2vw;?\s*\}\s*\}/);
    expect(out.indexOf('clamp(1rem')).toBeLessThan(out.indexOf('@supports'));
  });

  it('covers custom properties, keeps media nesting and !important', () => {
    const out = run('@media (min-width: 1px) { :root { --w: min(92%, 600px) !important; } }');
    expect(out).toMatch(/@media[^{]*\{[^@]*@supports not/);
    expect(out).toMatch(/--w: 600px !important/);
  });

  it('skips keyframes and rules without math', () => {
    const out = run('@keyframes k { from { width: clamp(1px, 2px, 3px); } } .b { color: red; }');
    expect(out).not.toContain('@supports');
  });
});

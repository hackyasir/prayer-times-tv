// ── fmtStr.test.js ───────────────────────────────────────────────────────
// Filling {placeholders} in translated strings: values are used exactly as
// they are, even with $ in them (a masjid's name, a place from the city search).

import { describe, it, expect } from 'vitest';
import { fmtStr } from '../I18nContext.jsx';

describe('fmtStr', () => {
  it('fills every placeholder', () => {
    expect(fmtStr('{a} and {b}, {a}', { a: 'x', b: 'y' })).toBe('x and y, x');
  });

  it('uses values with $ in them as they are', () => {
    expect(fmtStr('From {name}', { name: "Masjid $& $` $' $1" })).toBe("From Masjid $& $` $' $1");
  });
});

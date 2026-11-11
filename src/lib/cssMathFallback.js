// ── cssMathFallback — CSS fallbacks for older TV browsers (build time) ─────────
//
// Used by vite.config.js as a PostCSS plugin; not part of the app bundle.
//
// clamp(), min() and max() need Chromium 79+. Samsung TVs up to the 2021
// models (Chromium 63–76) and LG's 2020 models (Chromium 68) drop every
// declaration that uses them, so sizes and spacing fall back to browser
// defaults. For each such rule this adds, right after it,
//
//   @supports not (width: clamp(1px, 1px, 1px)) { <same selector> { … } }
//
// holding a plain value — so newer browsers ignore it and the cascade order
// is unchanged. (A plain fallback declaration placed before the original
// would not work for custom properties, which are never invalid at parse
// time.)
//
// The plain value is chosen for a TV's fixed viewport — 1920 × 1080 or
// 1280 × 720 CSS pixels, where viewport-relative sizes are large:
//   clamp(min, preferred, max)  → preferred
//   min(a, b, …)                → the first fixed length (px / rem / em),
//                                 which is the cap on a big screen
//   max(a, b, …)                → the first relative value (%, vw, vh, …),
//                                 which is above the floor on a big screen
// Values still needing container-query units (cq*) get no fallback: those
// rules only apply inside @supports blocks that old engines skip anyway.

const MATH = /(^|[^\w-])(clamp|min|max)\(/i;
const RELATIVE = /(%|\b\d*\.?\d+(vw|vh|vmin|vmax)\b)/i;
const FIXED = /^-?\d*\.?\d+(px|rem|em)$/i;
const CONTAINER_UNITS = /\d(cqw|cqh|cqi|cqb|cqmin|cqmax)\b/i;

/** Split "a, f(b, c), d" on top-level commas. */
function splitArgs(s) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(s.slice(start).trim());
  return out;
}

function pick(name, args) {
  if (name === 'clamp') return args.length === 3 ? args[1] : args[0];
  if (name === 'min') return args.find((a) => FIXED.test(a)) ?? args[0];
  return args.find((a) => RELATIVE.test(a)) ?? args[args.length - 1]; // max
}

/**
 * The value with every clamp()/min()/max() replaced by a plain choice, or
 * null when there is nothing to replace or the result still needs
 * container-query units.
 */
export function mathFallback(value) {
  if (!MATH.test(value)) return null;
  const resolve = (s) => {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const m = /(^|[^\w-])(clamp|min|max)\(/i.exec(s.slice(i));
      if (!m) {
        out += s.slice(i);
        break;
      }
      const fnStart = i + m.index + m[1].length;
      out += s.slice(i, fnStart);
      // Find the matching closing parenthesis.
      const open = fnStart + m[2].length;
      let depth = 0;
      let close = open;
      for (; close < s.length; close++) {
        if (s[close] === '(') depth++;
        else if (s[close] === ')' && --depth === 0) break;
      }
      const args = splitArgs(s.slice(open + 1, close)).map(resolve);
      out += pick(m[2].toLowerCase(), args);
      i = close + 1;
    }
    return out;
  };
  const result = resolve(value);
  return CONTAINER_UNITS.test(result) ? null : result;
}

/** The PostCSS plugin. */
export function cssMathFallback() {
  return {
    postcssPlugin: 'css-math-fallback',
    OnceExit(root, { AtRule }) {
      root.walkRules((rule) => {
        // Keyframe steps can't hold @supports; skip them.
        if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
        const fallbacks = [];
        rule.each((node) => {
          if (node.type !== 'decl') return;
          const value = mathFallback(node.value);
          if (value !== null) {
            fallbacks.push(node.clone({ value, important: node.important }));
          }
        });
        if (!fallbacks.length) return;
        const copy = rule.clone();
        copy.removeAll();
        copy.append(fallbacks);
        const block = new AtRule({ name: 'supports', params: 'not (width: clamp(1px, 1px, 1px))' });
        block.append(copy);
        rule.after(block);
      });
    },
  };
}
cssMathFallback.postcss = true;

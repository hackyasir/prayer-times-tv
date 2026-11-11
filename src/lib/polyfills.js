// ── polyfills — small gaps in older TV browsers ─────────────────────────────
//
// The build rewrites newer syntax for older engines (vite.config.js), but it
// can't add missing built-in functions. Imported first in main.jsx.

// Object.fromEntries — Chromium 73+ (Samsung's 2019–2021 TVs are 63–76).
if (typeof Object.fromEntries !== 'function') {
  Object.fromEntries = (entries) => {
    const obj = {};
    for (const [key, value] of entries) obj[key] = value;
    return obj;
  };
}

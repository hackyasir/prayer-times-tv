// ── Themes — colour palettes injected as CSS custom properties ───────────────
//
// Each theme defines values for ~20 CSS vars that the static stylesheet
// references throughout via var(--t-*). To change the entire dashboard's
// look, the user picks a theme key — its vars get re-injected on :root
// and every component re-themes automatically.
//
// Adding a new theme: define a key here with the same set of vars.
// The `preview` field gives three colours used to show a swatch in Settings.

export const THEMES = {
  'Classic Gold': {
    label: 'Classic Gold',
    preview: ['#000', '#C9A84C', '#F5EDD8'],
    vars: {
      '--t-bg': '#000000',
      '--t-surface': '#0A0A0A',
      '--t-surface2': '#111111',
      '--t-border': 'rgba(201,168,76,.2)',
      '--t-border-hi': 'rgba(201,168,76,.5)',
      '--t-accent': '#C9A84C',
      '--t-accent-dim': '#7A6230',
      '--t-accent-hi': '#F0C96A',
      '--t-accent-rgb': '201,168,76',
      '--t-text': '#F5EDD8',
      '--t-text-dim': '#9A8B6E',
      '--t-active-bg': 'rgba(201,168,76,.08)',
      '--t-active-glow': 'rgba(201,168,76,.18)',
      '--t-dot-color': '#F0C96A',
      '--t-dot-glow': 'rgba(240,201,106,.25)',
      '--t-card-pulse': 'rgba(201,168,76,.18)',
      '--t-clock-color': '#F5EDD8',
      '--t-countdown': '#F0C96A',
    },
  },
  'Emerald Night': {
    label: 'Emerald Night',
    preview: ['#030f07', '#2ecc71', '#e8f8ee'],
    vars: {
      '--t-bg': '#030f07',
      '--t-surface': '#071a0e',
      '--t-surface2': '#0d2416',
      '--t-border': 'rgba(46,204,113,.2)',
      '--t-border-hi': 'rgba(46,204,113,.5)',
      '--t-accent': '#2ecc71',
      '--t-accent-dim': '#1a7a43',
      '--t-accent-hi': '#5dde94',
      '--t-accent-rgb': '46,204,113',
      '--t-text': '#e8f8ee',
      '--t-text-dim': '#6aab82',
      '--t-active-bg': 'rgba(46,204,113,.1)',
      '--t-active-glow': 'rgba(46,204,113,.2)',
      '--t-dot-color': '#5dde94',
      '--t-dot-glow': 'rgba(93,222,148,.3)',
      '--t-card-pulse': 'rgba(46,204,113,.2)',
      '--t-clock-color': '#e8f8ee',
      '--t-countdown': '#5dde94',
    },
  },
  'Royal Blue': {
    label: 'Royal Blue',
    preview: ['#020816', '#4A90E2', '#e8f0ff'],
    vars: {
      '--t-bg': '#020816',
      '--t-surface': '#071228',
      '--t-surface2': '#0e1e3d',
      '--t-border': 'rgba(74,144,226,.2)',
      '--t-border-hi': 'rgba(74,144,226,.5)',
      '--t-accent': '#4A90E2',
      '--t-accent-dim': '#2a5490',
      '--t-accent-hi': '#7ab3f0',
      '--t-accent-rgb': '74,144,226',
      '--t-text': '#e8f0ff',
      '--t-text-dim': '#6a8ab0',
      '--t-active-bg': 'rgba(74,144,226,.1)',
      '--t-active-glow': 'rgba(74,144,226,.2)',
      '--t-dot-color': '#7ab3f0',
      '--t-dot-glow': 'rgba(122,179,240,.3)',
      '--t-card-pulse': 'rgba(74,144,226,.2)',
      '--t-clock-color': '#e8f0ff',
      '--t-countdown': '#7ab3f0',
    },
  },
  'Midnight Teal': {
    label: 'Midnight Teal',
    preview: ['#010d0f', '#00BCD4', '#e0f8fb'],
    vars: {
      '--t-bg': '#010d0f',
      '--t-surface': '#041a1e',
      '--t-surface2': '#072830',
      '--t-border': 'rgba(0,188,212,.2)',
      '--t-border-hi': 'rgba(0,188,212,.5)',
      '--t-accent': '#00BCD4',
      '--t-accent-dim': '#006070',
      '--t-accent-hi': '#4dd6e8',
      '--t-accent-rgb': '0,188,212',
      '--t-text': '#e0f8fb',
      '--t-text-dim': '#5a9aab',
      '--t-active-bg': 'rgba(0,188,212,.1)',
      '--t-active-glow': 'rgba(0,188,212,.2)',
      '--t-dot-color': '#4dd6e8',
      '--t-dot-glow': 'rgba(77,214,232,.3)',
      '--t-card-pulse': 'rgba(0,188,212,.2)',
      '--t-clock-color': '#e0f8fb',
      '--t-countdown': '#4dd6e8',
    },
  },
  'Warm Sand': {
    label: 'Warm Sand',
    preview: ['#0f0b06', '#D4956A', '#fff4e6'],
    vars: {
      '--t-bg': '#0f0b06',
      '--t-surface': '#1a1208',
      '--t-surface2': '#261b0d',
      '--t-border': 'rgba(212,149,106,.2)',
      '--t-border-hi': 'rgba(212,149,106,.5)',
      '--t-accent': '#D4956A',
      '--t-accent-dim': '#7a5530',
      '--t-accent-hi': '#e8b898',
      '--t-accent-rgb': '212,149,106',
      '--t-text': '#fff4e6',
      '--t-text-dim': '#a0836a',
      '--t-active-bg': 'rgba(212,149,106,.1)',
      '--t-active-glow': 'rgba(212,149,106,.2)',
      '--t-dot-color': '#e8b898',
      '--t-dot-glow': 'rgba(232,184,152,.3)',
      '--t-card-pulse': 'rgba(212,149,106,.2)',
      '--t-clock-color': '#fff4e6',
      '--t-countdown': '#e8b898',
    },
  },
  'Pure White': {
    label: 'Pure White',
    preview: ['#f5f5f5', '#1a1a2e', '#2d2d2d'],
    vars: {
      '--t-bg': '#f0f0f0',
      '--t-surface': '#ffffff',
      '--t-surface2': '#f8f8f8',
      '--t-border': 'rgba(26,26,46,.15)',
      '--t-border-hi': 'rgba(26,26,46,.4)',
      '--t-accent': '#1a1a2e',
      '--t-accent-dim': '#555577',
      '--t-accent-hi': '#2d2d4e',
      '--t-accent-rgb': '26,26,46',
      '--t-text': '#1a1a2e',
      '--t-text-dim': '#667799',
      '--t-active-bg': 'rgba(26,26,46,.06)',
      '--t-active-glow': 'rgba(26,26,46,.12)',
      '--t-dot-color': '#2d2d4e',
      '--t-dot-glow': 'rgba(45,45,78,.2)',
      '--t-card-pulse': 'rgba(26,26,46,.12)',
      '--t-clock-color': '#1a1a2e',
      '--t-countdown': '#2d2d4e',
    },
  },
};

/**
 * Render a theme's CSS variables as a :root { ... } block string,
 * suitable for injecting via a <style> tag.
 */
export function buildThemeVars(themeKey) {
  const t = THEMES[themeKey] || THEMES['Classic Gold'];
  return (
    ':root{' +
    Object.entries(t.vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';') +
    '}'
  );
}

// ── ESLint configuration (flat config, ESLint 9+) ───────────────────────
//
// Flat config replaces the legacy .eslintrc.* + .eslintignore pair.
// Everything lives in this one file: which files to lint, parser options,
// plugins, rules, and ignores.
//
// To run:  npm run lint
//
// To autofix what's fixable:  npx eslint src --fix
//
// Why these specific rules?
//   - eslint:recommended       — the official safety net (no-undef, etc.)
//   - react/recommended        — JSX hygiene, key warnings, no-unknown-prop
//   - react-hooks rules-of-hooks — the most important React lint rule:
//     catches conditional hook calls that would corrupt state
//   - react-hooks exhaustive-deps — flags missing deps in useEffect/useMemo,
//     a common source of stale-closure bugs
//
// We do NOT enforce stylistic rules (semicolons, quotes, trailing commas)
// here — those are personal preference and Prettier territory.

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Apply the official "recommended" baseline to all JS/JSX.
  js.configs.recommended,

  // ── Files to lint + parser options ──────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser globals — window, document, fetch, localStorage, etc.
        ...globals.browser,
        // Service worker globals (used by public/sw.js if linted).
        ...globals.serviceworker,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── React recommended rules ──────────────────────────────────────
      ...react.configs.recommended.rules,
      // ── React Hooks rules ────────────────────────────────────────────
      'react-hooks/rules-of-hooks':   'error',
      'react-hooks/exhaustive-deps':  'warn',

      // ── Project-specific overrides ───────────────────────────────────
      // React 17+ JSX transform — no need to `import React from 'react'`
      // just to use JSX. Disables the legacy rule that would warn about it.
      'react/react-in-jsx-scope':    'off',
      'react/jsx-uses-react':        'off',

      // We don't use PropTypes (most of the project predates a TS migration);
      // disable the warning rather than add prop-types to every component.
      'react/prop-types':            'off',

      // Unescaped entities like apostrophes inside JSX are intentional in
      // many places (e.g. "Jumu'ah", "Eid ul-Fitr"). Disable rather than
      // litter with &apos;.
      'react/no-unescaped-entities': 'off',

      // Allow unused function args prefixed with _ (common pattern for
      // "this param exists by convention but isn't read").
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  // ── Test files — slightly looser rules ──────────────────────────────
  // Vitest globals (describe, it, expect, vi, beforeEach, afterEach) come
  // from explicit imports in our tests, so we don't need to add them as
  // globals. But test files often use unused-arg patterns and arbitrary
  // assertion structures that the lint rules can flag noisily.
  {
    files: ['src/**/__tests__/**/*.{js,jsx}', 'src/tests/**/*.{js,jsx}'],
    rules: {
      'no-unused-expressions': 'off',
    },
  },

  // ── Vitest config + setup file context ──────────────────────────────
  // These run in Node environment, not the browser.
  {
    files: ['vitest.config.js', 'vite.config.js', 'src/tests/setup.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ── Files to skip entirely ──────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'public/sw.js',          // Hand-crafted service worker; intentionally
                               // skips lint rules that don't apply to SWs.
      '.vite/**',
      '.vitest-cache/**',
    ],
  },
];

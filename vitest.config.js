// ── Vitest configuration ─────────────────────────────────────────────────
//
// Test setup for the prayer-times-tv project. Tests are colocated next to
// their source via __tests__/ folders (e.g. src/lib/__tests__/hijri.test.js).
//
// Notes:
//   - environment: 'node' is the default. Component tests (Phase 2) will
//     opt into 'jsdom' per-file via /* @vitest-environment jsdom */ headers.
//   - setupFiles runs once before each test file — handles localStorage
//     reset, mock cleanup, time-mock teardown.
//   - coverage is V8-based (built into Node, zero install overhead beyond
//     the @vitest/coverage-v8 reporter).

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The React plugin lets Vitest transform JSX in component tests using
  // the same pipeline Vite uses for the app itself — no separate babel
  // config needed.
  plugins: [react()],

  test: {
    // Where to find tests. __tests__ folders keep production source clean
    // while still living next to the file they cover.
    // - .test.js for plain JS (lib/)  → run in Node env (fast)
    // - .test.jsx for components      → opt into jsdom via per-file pragma:
    //     /* @vitest-environment jsdom */
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],

    // Default environment for lib/* tests — pure JS, no DOM needed.
    // Component tests opt in to 'jsdom' with the pragma above.
    environment: 'node',

    // Global hooks for cleanup, mock reset, secret sanitization.
    // The setup file also imports @testing-library/jest-dom so any
    // component test gets toBeInTheDocument() and friends for free.
    setupFiles: ['./src/tests/setup.js'],

    // Parallel execution is on by default. Each test file gets its own
    // worker; tests within a file run sequentially. Our tests are isolated
    // (no shared state, see setup.js) so parallel runs are safe.

    // Auto-cleanup mocks/spies between tests so tests stay independent.
    restoreMocks: true,
    clearMocks: true,

    // No real network calls during tests. Any fetch is mocked explicitly
    // in the test that needs it.
    // (Vitest doesn't have a global "block network" flag; we rely on
    //  reviewer discipline + the setup file's fetch mock.)

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Only measure coverage on the source we actually test. Excludes
      // entry points, config, dev tooling, and CSS-in-JS components that
      // aren't covered by Phase 1.
      include: ['src/lib/**/*.js', 'src/components/**/*.{js,jsx}', 'src/context/**/*.{js,jsx}'],
      exclude: [
        '**/__tests__/**',
        '**/*.test.{js,jsx}',
        'src/tests/**',
        // Components covered by visual inspection rather than unit tests:
        // - SettingsPanel is admin-only, 109 inline styles, low ROI to test
        // - widgets/* are mostly SVG renderers with little logic
        'src/components/settings/**',
        'src/components/widgets/**',
      ],
      // Phase 1 target — adjust upward as we add tests.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});

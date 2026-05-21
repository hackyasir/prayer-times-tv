// ── Global test setup ────────────────────────────────────────────────────
//
// Runs before each test file (configured in vitest.config.js). Sets up:
//   1. Auto-cleanup of localStorage between tests (browser-like state reset)
//   2. Secret sanitization — VITE_* env vars get safe test values
//   3. Network blocking — any test that calls fetch() without mocking it
//      will fail loudly rather than hitting real servers
//   4. Time-mock teardown — tests that mock Date.now() must reset
//   5. React Testing Library cleanup — unmount components between tests
//   6. jest-dom custom matchers — toBeInTheDocument, toHaveClass, etc.
//      available globally for component tests
//
// Tests can override any of these locally if they need to (e.g. a network
// test will install its own fetch mock).

import { afterEach, beforeEach, vi } from 'vitest';
// jest-dom matchers are auto-loaded here so component tests don't need to
// import them per file. The import has side effects only (extends expect).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// ── localStorage shim ──────────────────────────────────────────────────
// `environment: 'node'` doesn't ship a localStorage — install a minimal
// in-memory polyfill so lib code that touches it (none currently, but
// SettingsContext will in Phase 2) doesn't blow up.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  // ── Sanitize secrets ────────────────────────────────────────────────
  // Production reads VITE_SETTINGS_PIN from env. Tests should never see
  // real values. Force a known test value so any code path that reads
  // it gets a predictable result.
  vi.stubEnv('VITE_SETTINGS_PIN', 'TEST_PIN_1234');

  // ── Block real network calls ────────────────────────────────────────
  // If a test calls fetch() without installing its own mock first, fail
  // loudly. Real network would make tests flaky and slow.
  globalThis.fetch = vi.fn(() => {
    throw new Error(
      'fetch() called in test without a mock. Install vi.spyOn(globalThis, "fetch") in your test.'
    );
  });
});

afterEach(() => {
  // ── Auto-cleanup ─────────────────────────────────────────────────────
  // Reset all browser-ish state so the next test starts fresh.
  localStorage.clear();

  // Unmount any components rendered by React Testing Library so DOM
  // assertions in the next test don't see leftover elements. Safe to
  // call even in lib tests that didn't render anything (no-op).
  cleanup();

  // Restore any Date / timer mocks. Tests that use vi.useFakeTimers()
  // must NOT leak fake timers into the next test.
  vi.useRealTimers();

  // Clear env stubs from beforeEach.
  vi.unstubAllEnvs();

  // Clear stub'd globals so e.g. fetch mocks don't leak.
  vi.unstubAllGlobals();
});

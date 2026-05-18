# Testing Guide

Automated test suite for **prayer-times-tv**, built on [Vitest](https://vitest.dev/) and [@testing-library/react](https://testing-library.com/).

[![Tests](https://img.shields.io/badge/tests-115%2B-success)](#whats-covered)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of contents

- [Quick start](#quick-start)
- [Test layout](#test-layout)
- [What's covered](#whats-covered)
- [Running tests](#running-tests)
- [Writing new tests](#writing-new-tests)
- [Mocking patterns](#mocking-patterns)
- [Coverage](#coverage)
- [CI integration](#ci-integration)
- [Troubleshooting](#troubleshooting)
- [Architecture decisions](#architecture-decisions)

---

## Quick start

```bash
npm install              # one-time, installs vitest + testing-library
npm test                 # run all tests once (~115 tests, <2s)
npm run test:watch       # re-run on file changes (dev mode)
npm run test:coverage    # generate ./coverage/ HTML report
```

> **First-time after pulling new deps?** Re-run `npm install` to pick up `vitest`, `jsdom`, and `@testing-library/*` from `devDependencies`.

---

## Test layout

Tests are **colocated** with the code they verify, inside `__tests__/` folders. This convention:

- Keeps production directories clean (no `*.test.js` mixed with source).
- Puts tests adjacent to the file they cover so refactors stay scoped.
- Is discoverable via `src/**/__tests__/**/*.test.{js,jsx}` in `vitest.config.js`.

```
src/
├── lib/
│   ├── hijri.js
│   ├── formatters.js
│   ├── prayerCalc.js
│   └── __tests__/
│       ├── hijri.test.js
│       ├── formatters.test.js
│       └── prayerCalc.test.js
├── components/
│   ├── NumberStepper.jsx
│   └── __tests__/
│       └── NumberStepper.test.jsx
├── context/
│   ├── SettingsContext.jsx
│   └── __tests__/
│       └── SettingsContext.test.jsx
└── tests/
    └── setup.js          ← global test setup (one file)
```

---

## What's covered

| File | Tests | Type | Focus |
|---|---:|---|---|
| `lib/__tests__/hijri.test.js` | 25 | Unit | Gregorian↔Hijri conversion; Eid auto-detection; **Hijri offset bug regression** |
| `lib/__tests__/formatters.test.js` | 30 | Unit | Time formatting, countdown, compass bearings, edge cases |
| `lib/__tests__/prayerCalc.test.js` | 20 | Unit | All 12 calculation methods, prayer ordering invariants, madhab, high-latitude |
| `components/__tests__/NumberStepper.test.jsx` | 20 | Component | iOS spinner replacement, clamping, disabled states, digit-only input |
| `context/__tests__/SettingsContext.test.jsx` | 20 | Component | **Legacy migrations** (eid array → eidFitr/eidAdha, chimeEnabled → split), draft/applied separation, persistence |

**~115 tests total.**

### Regression tests

Each suite includes tests for bugs we've actually encountered:

- **Hijri offset direction** — the "+2 offset, 9-day lookahead from 1 Dhu al-Hijjah" scenario returned `null` until the offset direction was corrected. Test reproduces the exact scenario.
- **NumberStepper numeric contract** — `type="number"` → `type="text"` refactor must preserve `onChange(<number>)` (not string). Test asserts the type.
- **Eid migration preserves `enabled`** — upgrading from the single-array `eid` schema must keep per-slot enable/disable choices.
- **Method fallback to MWL** — unknown calculation method strings must not crash; they fall back silently.

### Not tested (intentional)

| Component | Why skipped |
|---|---|
| `PrayerList` | ~25 props, prop-driven UI — bugs surface visually in seconds. Brittle assertions vs. low real-bug catch rate. |
| `SettingsPanel` | Admin-only UI behind PIN; 109 inline-styled inputs. Low ROI. |
| `Footer` test buttons | Dev-only, manual verification sufficient. |
| `widgets/*` | Mostly SVG renderers with little logic. Visual inspection covers them. |
| End-to-end / Playwright | Offline display app has no user flows worth E2E testing. |
| Visual regression | Out of scope; would need baseline image management. |

---

## Running tests

### Single run

```bash
npm test
```

Runs all tests in parallel, exits non-zero if any fail. Suitable for CI.

### Watch mode

```bash
npm run test:watch
```

Re-runs affected tests when files change. Press `f` to re-run only failed tests, `q` to quit. **Use this during active development.**

### Coverage report

```bash
npm run test:coverage
```

Generates HTML + LCOV reports in `./coverage/`. Open `coverage/index.html` in a browser.

Coverage targets (from `vitest.config.js`):

| Metric | Threshold |
|---|---|
| Lines | 70% |
| Functions | 70% |
| Branches | 60% |
| Statements | 70% |

> Coverage targets are intentionally moderate to avoid pressure to write low-value tests. Adjust in `vitest.config.js` if your team prefers higher.

### Running a single test file

```bash
npx vitest run src/lib/__tests__/hijri.test.js
```

### Running tests matching a name

```bash
npx vitest run -t "Hijri offset"
```

Runs only tests whose `describe`/`it` name contains "Hijri offset".

---

## Writing new tests

### Conventions

- **File name**: `<source>.test.js` (or `.test.jsx` for components).
- **Location**: in an `__tests__/` folder next to the source.
- **Structure**: `describe` per function or behavior group; `it` per scenario.
- **Naming**: write `it()` names as sentences. Reading test output should make the spec obvious.
- **Pattern**: Arrange / Act / Assert (AAA).

### Unit test example (lib)

```js
// src/lib/__tests__/myModule.test.js
import { describe, it, expect } from 'vitest';
import { addMins } from '../formatters.js';

describe('addMins', () => {
  it('adds positive minutes', () => {
    // Arrange
    const start = new Date('2026-05-18T12:00:00Z');
    // Act
    const result = addMins(start, 15);
    // Assert
    expect(result.toISOString()).toBe('2026-05-18T12:15:00.000Z');
  });

  it('returns null for null input', () => {
    expect(addMins(null, 15)).toBeNull();
  });
});
```

### Component test example

```jsx
/* @vitest-environment jsdom */
// src/components/__tests__/MyButton.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyButton from '../MyButton.jsx';

describe('MyButton', () => {
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<MyButton onClick={handleClick}>Click me</MyButton>);
    await user.click(screen.getByRole('button', { name: /click me/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

> The `/* @vitest-environment jsdom */` pragma at the top is required for component tests — it tells Vitest to provide a DOM. Lib tests skip it and run faster in pure Node.

### Best practices

- **Test behavior, not implementation.** Prefer `screen.getByRole('button', { name: 'Submit' })` over `container.querySelector('.btn-submit')`. Refactors are kinder to behavior-based queries.
- **One assertion per concept.** Multiple `expect()` calls per `it()` are fine if they verify the same behavior; split if they test different things.
- **Use the controlled-component pattern** for inputs that propagate state via `onChange`. See `NumberStepper.test.jsx` for an example.
- **Mock at the boundary** — fetch, time, env vars. Don't mock the function under test; mock what it depends on.

---

## Mocking patterns

All mocks are auto-cleaned between tests by `src/tests/setup.js` — `vi.restoreAllMocks()`, `vi.unstubAllEnvs()`, `vi.unstubAllGlobals()` run in `afterEach`.

### Time

```js
import { vi } from 'vitest';

vi.useFakeTimers();
vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));

// ... code that reads Date.now() or new Date()

vi.useRealTimers();  // afterEach also does this automatically
```

### Environment variables

```js
vi.stubEnv('VITE_SETTINGS_PIN', 'test1234');
// ... test ...
// afterEach calls vi.unstubAllEnvs() automatically
```

### fetch / network

```js
// In setup.js, global fetch is replaced with a fail-loud stub:
//   "fetch() called in test without a mock"
// Tests that need fetch must install their own:

vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ temperature: 22 }),
  })
));
```

### localStorage

A minimal in-memory polyfill is installed in `setup.js` (Vitest's Node environment lacks one). `localStorage.clear()` is called in `afterEach`.

### React Testing Library cleanup

`cleanup()` from `@testing-library/react` is called in `afterEach` to unmount rendered components and prevent DOM leakage between tests.

---

## Coverage

The coverage report (`npm run test:coverage`) includes:

- **`src/lib/**/*.js`** — pure functions
- **`src/components/**/*.{js,jsx}`** — React components
- **`src/context/**/*.{js,jsx}`** — context + hooks

Excluded:

- Test files and `__tests__/` folders
- `src/tests/` (setup)
- `src/components/settings/` (admin-only UI, deferred)
- `src/components/widgets/` (SVG-heavy, low logic)

To open the HTML report:

```bash
npm run test:coverage
open coverage/index.html        # macOS
xdg-open coverage/index.html    # Linux
start coverage/index.html       # Windows
```

LCOV output (`coverage/lcov.info`) integrates with Codecov, Coveralls, GitHub Code Annotations, and most IDE extensions.

---

## CI integration

This suite is CI-ready with no extra setup. Example GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
          retention-days: 30
```

No paid services. No API keys. Runs in the GitHub Actions free tier.

---

## Troubleshooting

### "Cannot find module '@testing-library/react'"

Run `npm install`. The testing libraries were added to `devDependencies`; if you cloned before that, your `node_modules/` is missing them.

### "ReferenceError: document is not defined" in a component test

Add the jsdom pragma at the top of your test file:

```js
/* @vitest-environment jsdom */
```

Lib tests run in Node by default (faster); only component tests need a DOM.

### Test passes alone but fails with the full suite

Indicates **leaky state** between tests. Common causes:

- Forgot to clean up a `vi.spyOn` or `vi.stubGlobal` — `setup.js` should handle this automatically; check that `setupFiles: ['./src/tests/setup.js']` is in `vitest.config.js`.
- Module-level state in the code under test (a `let` outside any function). Refactor to encapsulate.
- A timer that's still running. `vi.useRealTimers()` in `afterEach` resets this — confirm it ran.

### "fetch() called in test without a mock"

Your test or the code under test calls real `fetch()`. Either:

1. Mock it explicitly (`vi.stubGlobal('fetch', vi.fn(...))`).
2. Refactor the code so the test doesn't trigger a fetch path.

Real network calls in tests are blocked by design to prevent flakiness and rate-limiting.

### Test times out

Vitest's default per-test timeout is 5 seconds. If you have a legitimate long-running async test:

```js
it('long async work', async () => {
  // ...
}, 10_000);  // 10-second timeout for this test
```

But usually the right fix is to mock the slow dependency.

---

## Architecture decisions

### Why Vitest (not Jest)?

- **Vite-native** — same config, same module resolution as the app. JSX, ESM, path aliases all "just work."
- **~10× faster startup** than Jest in Vite projects.
- **Smaller install** — no `babel-jest` transformer pipeline.
- **API-compatible with Jest** — `describe`/`it`/`expect` work the same. Easy migration if ever needed.

### Why colocated tests?

- Refactors stay in scope — moving `hijri.js` moves its tests with it.
- "Where's the test for X?" has an obvious answer: `<directory>/__tests__/X.test.js`.
- The `__tests__/` folder convention keeps parent directories clean.

### Why @testing-library/react?

- The de-facto standard for testing React components in 2025.
- Encourages testing **user-visible behavior** over implementation details. Tests survive refactors better.
- Activated only by component test files via the `/* @vitest-environment jsdom */` pragma — lib tests stay in fast Node env.

### Why no E2E layer?

This is an offline display app. There are no user flows like signup/checkout to test end-to-end. Visual issues surface immediately when you open the app; integration bugs in render logic get caught by the component tests. Adding Playwright would mean ~150MB of browser binaries + CI complexity for very little additional safety.

If the project ever adds a backend (e.g. cloud sync), an E2E layer would become worth adding.

---

## License

The test suite ships under the same [MIT license](LICENSE) as the rest of the project. All testing dependencies are MIT-licensed:

- [Vitest](https://vitest.dev/) — MIT
- [@vitest/coverage-v8](https://www.npmjs.com/package/@vitest/coverage-v8) — MIT
- [jsdom](https://github.com/jsdom/jsdom) — MIT
- [@testing-library/react](https://testing-library.com/) — MIT
- [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) — MIT
- [@testing-library/user-event](https://github.com/testing-library/user-event) — MIT

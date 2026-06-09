# Contributing to Prayer Times TV

Welcome — this guide covers everything you need to develop, test, and contribute changes to the project. Most of it is also useful for your future self when you return to the codebase after months away.

---

## Project at a glance

- **Stack:** React 19 + Vite 6 + Vitest 4
- **Calculation libs:** [adhan-js](https://github.com/batoulapps/adhan-js), [suncalc](https://github.com/mourner/suncalc)
- **State:** React Context (`SettingsContext`, `I18nContext`) — no Redux/Zustand
- **Tests:** Vitest, 211 unit + component tests across 12 files in `src/**/__tests__/`
- **Deploy:** GitHub Pages via `.github/workflows/deploy.yml`
- **PWA:** vite-plugin-pwa, installable on any device with a modern browser

---

## Prerequisites

- **Node.js 20+** (check with `node --version`)
- **npm 10+** (ships with Node 20)
- A browser (any modern one — Chrome/Edge/Firefox/Safari all work)

If you use Windows, all the helper scripts (`sync.bat`, `upload.bat`, `precheck.bat`) are `.bat` files. On macOS/Linux you can ignore them and run the underlying `npm` commands directly.

---

## First-time setup

```bash
git clone <repo-url>
cd prayer-times-tv
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Hot-reload picks up edits automatically.

---

## Daily development workflow

```bash
npm run dev              # start dev server (keep running)
# ... edit files ...
npm run lint             # check lint (should pass with ≤30 warnings)
npm test                 # run all tests
npm run format           # auto-format with Prettier
```

For an end-to-end check before pushing, see "Pre-push quality gate" below.

---

## Project structure

```
prayer-times-tv/
├── src/
│   ├── App.jsx              Main app shell (large; do not split casually)
│   ├── main.jsx             Entry point
│   ├── components/          Visual components (Header, Footer, PrayerCard, ...)
│   │   ├── settings/        Settings panel + its sub-pieces
│   │   ├── widgets/         Optional dashboard widgets (weather, moon, etc.)
│   │   └── __tests__/       Component tests
│   ├── context/             React Context providers (settings, i18n)
│   ├── hooks/               Custom hooks (usePrayerTimes, useBlackoutMode, ...)
│   ├── lib/                 Pure JS — no React, no DOM
│   │   ├── prayerCalc.js    Adhan + sunrise calculation
│   │   ├── hijri.js         Hijri date conversion
│   │   ├── iqamah.js        Iqamah time computation (shared helper)
│   │   ├── formatters.js    Display formatting (fmt12, fmtCountdown, ...)
│   │   ├── themes.js        Theme palette definitions
│   │   └── __tests__/       Lib tests
│   ├── i18n/                Internationalization (en, ar, ur)
│   ├── styles/              CSS files (per-concern, not per-component)
│   └── tests/               Vitest setup file
├── public/                  Static assets (icons, manifest, sw.js)
├── .github/
│   ├── workflows/
│   │   └── deploy.yml       CI/CD: lint + test + build + deploy
│   └── dependabot.yml       Automated dependency updates
├── .editorconfig            Cross-editor formatting rules
├── .prettierrc.json         Prettier config
├── eslint.config.js         ESLint flat config
├── vite.config.js           Vite (dev server + build)
├── vitest.config.js         Test runner config
├── package.json
├── README.md                User-facing project overview
├── TESTING.md               Detailed testing guide
└── CONTRIBUTING.md          (this file)
```

**Rule of thumb:** if logic is pure (no React, no DOM), it goes in `src/lib/` and gets tests. UI lives in components.

---

## Code standards

### Linting

ESLint must pass with **at most 30 warnings**. Errors block everything.

```bash
npm run lint
```

Most remaining warnings are intentional `react-hooks/exhaustive-deps` cases where adding the missing dep would cause infinite re-renders. New warnings beyond ~30 trigger CI failure — that's a signal to review what changed.

### Formatting

Prettier auto-formats everything. Run before committing:

```bash
npm run format
```

VS Code with the Prettier extension can format on save (recommended). Settings:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

### Tests

See [TESTING.md](TESTING.md) for the full guide. Quick rule:

- **Always test:** lib/\* functions, data migrations, duplicated logic, bug fixes
- **Don't test:** visual layout, trivial prop drilling, conditional rendering with no logic

```bash
npm test                 # one-shot
npm run test:watch       # TDD mode
npm run test:coverage    # with coverage report
```

---

## Pre-push quality gate

Before pushing, run:

```bash
precheck       # Windows .bat
# OR manually:
npm run lint && npm test && npm run build
```

The script runs lint → test → build in sequence and stops at the first failure. The same checks run on GitHub Actions when you push, so a green local precheck almost always means a green CI run.

For a stricter check that also validates dependency lock-file sync (as CI does):

```bash
npm run ci-check    # = npm ci && lint && test && build
```

Run this when:

- You pulled changes that touched `package.json` or `package-lock.json`
- CI failed but local precheck passed (helps diagnose dependency drift)
- You're about to push after a long break

---

## Adding a new feature

1. **Plan it first** — what's the smallest version that delivers value? Most features in this project ship as a single focused commit, not a multi-week branch.

2. **Code path:** lib → component → integration. If the feature needs new computation, write the `lib/` function first with tests, then add UI.

3. **Test what matters** — see "Code standards / Tests" above.

4. **Update docs** — README for user-visible features, TESTING.md if you add a new test file, this file if the workflow changes.

5. **Run precheck before committing.**

---

## Adding a new dependency

```bash
npm install <package-name>           # prod dependency
npm install --save-dev <package>     # dev dependency
```

Then:

- Commit BOTH `package.json` and `package-lock.json` in the same commit
- If the package is large or has a heavy dependency tree, mention in the commit message why it's worth the cost

Dependabot will start tracking it for future updates automatically.

---

## Reporting bugs

Open a GitHub issue with:

- What you expected
- What actually happened
- Steps to reproduce
- Browser + OS + screen size (for visual bugs)
- Screenshots if relevant

---

## Architecture notes

### Why `src/lib/` is pure JS

Pure functions are trivially testable (no React Testing Library setup, no DOM mocking) and reusable across contexts. The `iqamah.js`, `prayerCalc.js`, `hijri.js`, and `formatters.js` are the project's "engine room" — they're stable, well-tested, and don't change often.

### Why settings use Context, not Redux

The project has ~35 settings keys. Redux is overkill for that. React Context with a custom `useSettings()` hook gives us the same separation (state vs UI) at a fraction of the boilerplate.

### Why CSS is hand-written (not Tailwind/styled-components)

The TV dashboard has unusual size requirements (1920×1080 to 4K to portrait phone) and uses CSS custom properties heavily for theming. Hand-written CSS with `clamp()` and CSS vars gives the right level of control without runtime cost.

### Why iqamah computation lives in `lib/`

The same logic is needed in two places: the live dashboard AND the printable monthly schedule. Extracting to a shared lib (`lib/iqamah.js`) ensures both stay in sync — drift between the live display and the printed schedule would be confusing for mosques.

---

## License

MIT — see [LICENSE](LICENSE). By contributing, you agree your contributions are licensed under the same terms.

---

## Questions?

Open a GitHub Discussion, file an issue, or read the inline comments in the source files — they're extensive and explain most architectural decisions in-place.

<!-- markdownlint-disable-next-line MD041 -->
<div align="center">

# 🕌 Prayer Times TV

**A self-contained, offline-first prayer times dashboard for mosque lobby displays, Smart TVs, and kiosks.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-211-success)](TESTING.md)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

## Why this project

Most mosque display software either requires a paid subscription, depends on a vendor server that may disappear, or comes with intrusive tracking. This dashboard does the opposite:

- **Self-hosted** — clone, build, deploy. No accounts, no API keys, no telemetry.
- **Offline-capable** — prayer-time math runs entirely in the browser via `adhan`. Once the page is cached by the service worker, the display keeps working with the internet unplugged.
- **One-screen kiosk friendly** — designed to live on a TV for years. No CTAs, no notifications, no nag.
- **Free** — MIT licensed, all dependencies open-source.

Only two things ever touch the network at runtime, and both fail gracefully: the optional **weather widget** and **city search** during first-time setup. Prayer times, Hijri date, Jumu'ah/Eid logic, blackout, and the clock are all computed locally.

---

## Quick start

```bash
git clone <repo-url> prayer-times-tv
cd prayer-times-tv
npm install
npm run dev          # local dev at http://localhost:5173
```

For production deployment:

```bash
npm run build        # produces ./dist/ — a static site, deploy anywhere
```

Open in a browser, click **Settings** (gear icon, top-right), set your location and preferred calculation method. Settings persist in `localStorage`.

---

## Features

<details>
<summary><strong>Display & layout</strong> (click to expand)</summary>

- **Live clock + countdown** to the next prayer — second-accurate, in the city's wall-clock timezone (not the device's). The final stretch switches to a large countdown.
- **All 5 daily prayers + Sunrise** with bilingual names, SVG icons, and an active-prayer highlight with a pulsing indicator dot.
- **6 progress visuals** (Ring, Day Bar, Moon, Hero, Line, Orbit) — pick by room size and viewing distance.
- **6 themes** (Classic Gold, Emerald Night, Royal Blue, Midnight Teal, Warm Sand, Pure White).
- **Viewing-distance scaling** — three modes (Manual slider 70–130%, By-distance presets, or Calibrate-by-eye) that scale all text so it stays legible from the back of a hall.
- **Eco mode** (on by default) — suppresses non-essential animation to reduce power draw on always-on panels; the functional active-prayer dot keeps pulsing.
- **Pure-black backgrounds** to reduce OLED burn-in, with subtle Islamic-geometry corner decoration.
- **Responsive** — landscape TVs (HD/4K), portrait kiosks, tablets, phones, from a single codebase.

</details>

<details>
<summary><strong>Prayer-time computation</strong></summary>

- **12 calculation methods** — Muslim World League, ISNA, Moonsighting Committee, Egyptian Authority, Umm al-Qura (Makkah), Dubai, Qatar, Kuwait, University of Karachi, MUIS Singapore, Diyanet (Turkey), University of Tehran. Powered by [`adhan`](https://github.com/batoulapps/adhan-js).
- **Two madhabs** (Shafi/Standard, Hanafi) for Asr calculation.
- **High-latitude rules** (Middle of the Night, Seventh of the Night, Twilight Angle) — for cities above ~48° latitude.
- **Manual or auto Iqamah** — auto mode adds a per-prayer buffer and rounds up to the next quarter-hour, with a safety floor so iqamah can never fall before adhan.

</details>

<details>
<summary><strong>Jumu'ah & Eid</strong></summary>

- **Jumu'ah** — on Fridays, replaces Dhuhr with up to **4 configurable congregations**. Each slot has its own time and enable toggle.
- **Eid auto-detection** — banner appears automatically via the Hijri calendar. Distinguishes Eid ul-Fitr (1 Shawwal) from Eid ul-Adha (10 Dhu al-Hijjah), with two separate schedules.
- **Eid venue / address** — optional location line shown in the banner and announcements (e.g. when Eid prayer is at a community center).
- **Test buttons** (dev builds) for staff to preview Friday / Eid / blackout layouts on any day.

</details>

<details>
<summary><strong>Announcements & auto-notices</strong></summary>

- **Announcement ticker** — multi-line input, scrolling marquee **or** static rotation mode, RTL-aware.
- **Per-line markup** — prefix `!` to mark a line urgent; add `@YYYY-MM-DD` to auto-expire it after that date (evaluated in the city's timezone).
- **Auto-announcements** (optional) — computed notices prepended to the ticker: next prayer / congregation, Jumu'ah today, Eid countdown, and Sunnah-fast awareness.
- **Sunnah-fast logic** — recognises Monday/Thursday, White Days (13–15), Arafah, Ashura, Tasu'a, and the six of Shawwal. Coinciding fasts combine into one ranked line, and fasting is never suggested on the forbidden days (the two Eids and the days of Tashreeq).

</details>

<details>
<summary><strong>Other widgets</strong></summary>

- **Hijri date** with a ±day offset for local moon-sighting variance.
- **Qibla compass** — bearing to the Kaaba in degrees plus 16-point cardinal direction.
- **Sun arc** — sunrise / solar noon / sunset with current position.
- **Moon arc** — moonrise / transit / moonset with lunar-phase rendering.
- **Fasting window** — Suhoor → Iftar progress bar with countdown.
- **Weather widget** — current temperature + conditions; hidden automatically when offline.

</details>

<details>
<summary><strong>Reverent mode (Blackout during salah)</strong></summary>

- Optional overlay covers the dashboard from a configurable lead time before iqamah until after the prayer ends.
- Per-prayer durations and overlay opacity are configurable.
- Dismiss early with a 3-second press-and-hold gesture (with on-screen progress feedback) to prevent accidental taps.

</details>

<details>
<summary><strong>Printable monthly calendar</strong></summary>

- A full-month printable schedule (Adhan + Iqamah per prayer, Jumu'ah, Hijri date with year).
- Sunnah-fast markers matching the on-screen logic (White days, highest-reward fasts, six-of-Shawwal), with a legend scoped to whichever markers actually occur that month.
- A subtle ornamental background, print-optimised to a clean white page.

</details>

<details>
<summary><strong>Internationalization</strong></summary>

- 3 languages: **English**, **Arabic** (RTL), **Urdu** (RTL).
- The bilingual prayer-name pair stays visible regardless of the chosen UI language.
- An optional per-screen label (e.g. "Main Hall", "Women's Section") for multi-screen mosques.

</details>

<details>
<summary><strong>Admin & deployment</strong></summary>

- **PIN-locked settings** via the `VITE_SETTINGS_PIN` env var — for public kiosks.
- **Settings export / import / reset** as JSON, with a sanitising validator on import.
- **PWA installable** — add to home screen for a fullscreen, offline-first launch.
- **City search** via [Open-Meteo Geocoding](https://open-meteo.com/) (~600k cities, free, no key).
- **Audio chimes** — optional adhan/iqamah beeps (browser autoplay-unlock handled).

</details>

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│ main.jsx — provider chain + style imports                 │
└───────────────────────────────┬───────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────┐
│ App.jsx — orchestrator                                     │
│   useSettings()    → applied + drafts                      │
│   useT()           → i18n + RTL                            │
│   useCityTime()    → tz-aware "now"                        │
│   usePrayerTimes() → today/tomorrow/yesterday, active      │
│   useWeather, useChime, useLunarPhase, useBlackoutMode     │
└───────────────────────────────┬───────────────────────────┘
                                 │ props
┌───────────────────────────────▼───────────────────────────┐
│ components/                                                │
│   Header · PrayerList · PrayerCard · Clock · Footer        │
│   Ticker · BlackoutOverlay · PinOverlay · ProgressVisual   │
│   QiblaCompass · PrintableSchedule · NumberStepper         │
│   widgets/{SunArc, MoonArc, FastBar, WeatherStrip,         │
│            HeaderQibla}                                     │
│   settings/{SettingsPanel, LogoUploader}                   │
└───────────────────────────────────────────────────────────┘

   ┌──────┐  ┌──────┐  ┌────────┐  ┌──────┐  ┌────────┐
   │ lib/ │  │hooks/│  │context/│  │ i18n/│  │ styles/│
   │ Pure │  │React │  │  Ctx   │  │ Dict │  │  CSS   │
   │ JS   │  │state │  │ + Hook │  │      │  │        │
   └──────┘  └──────┘  └────────┘  └──────┘  └────────┘
```

### Project layout

```
prayer-times-tv/
├── index.html                  # CSP meta, PWA manifest link, fonts
├── package.json
├── vite.config.js              # Vite 6 + vite-plugin-pwa (injectManifest)
├── vitest.config.js            # Test runner config
├── TESTING.md                  # Test suite guide
├── .github/
│   ├── workflows/deploy.yml     # CI: build + GitHub Pages deploy
│   └── dependabot.yml
│
├── public/                     # Static assets (icons, manifest, sw.js,
│                               #   ornament.jpg, sounds/)
│
└── src/
    ├── main.jsx                # Entry — provider chain
    ├── App.jsx                 # Orchestrator
    ├── IslamicGeometryEngine.jsx  # Decorative background geometry
    ├── lib/                    # Pure-JS helpers (no React)
    │   ├── hijri.js            # Gregorian↔Hijri, Eid detection
    │   ├── prayerCalc.js       # adhan wrapper + qibla
    │   ├── iqamah.js           # Manual/auto iqamah computation
    │   ├── sunnahFasts.js      # Recommended-fast rules (shared)
    │   ├── viewingScale.js     # Distance-based type scaling
    │   ├── scheduleValidation.js
    │   ├── settingsImport.js   # Import sanitiser
    │   ├── formatters.js       # fmt12, countdown, compass
    │   ├── audio.js            # Beep playback
    │   ├── weather.js          # WMO code → emoji/text
    │   ├── themes.js           # Theme CSS-var builder
    │   └── constants.js        # PRAYERS, METHODS, STORAGE_KEY...
    ├── hooks/                  # React state hooks
    ├── context/                # SettingsContext, I18nContext
    ├── i18n/                   # en.json, ar.json, ur.json
    ├── components/             # Presentational React components
    │   ├── settings/{SettingsPanel, LogoUploader}
    │   └── widgets/            # SunArc, MoonArc, FastBar, ...
    ├── styles/                 # CSS — bundled into a single sheet via Vite
    └── tests/                  # Test setup (test files live in __tests__/)
```

---

## Configuration

### Environment variables

| Variable            | Default  | Description                                                                     |
| ------------------- | -------- | ------------------------------------------------------------------------------- |
| `VITE_SETTINGS_PIN` | _(none)_ | If set, requires this PIN to open the Settings panel. Useful for public kiosks. |

Create a `.env.local` file at the project root:

```bash
VITE_SETTINGS_PIN=1234
```

### Runtime settings

Everything else is configured at runtime through the **Settings** panel (gear icon, top-right). Settings persist in `localStorage` and can be exported/imported as JSON.

Settings include: location, calculation method, madhab, high-latitude rule, iqamah offsets (manual or auto), Jumu'ah/Eid schedules, Eid venue, theme, font scale, viewing-distance mode, language, screen label, eco mode, blackout durations, announcements (with ticker mode), auto-announcements, and chime preferences.

---

## Development

### Prerequisites

- **Node.js ≥ 20**
- **npm** (lockfile is `package-lock.json`)

### Available scripts

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Start Vite dev server at `http://localhost:5173`   |
| `npm run build`         | Production build → `./dist/`                       |
| `npm run preview`       | Preview the production build locally               |
| `npm run lint`          | Run ESLint on the project **and** Stylelint on CSS |
| `npm run format`        | Format with Prettier                               |
| `npm test`              | Run the full test suite once                       |
| `npm run test:watch`    | Re-run tests on file changes                       |
| `npm run test:coverage` | Generate a coverage report in `./coverage/`        |
| `npm run ci-check`      | `npm ci` + lint + test + build (what CI runs)      |

### Testing

This project has a **211-test suite** across 12 files, built on Vitest. See [TESTING.md](TESTING.md) for the full guide.

```bash
npm test                 # quick: run all tests
npm run test:coverage    # full: HTML report at ./coverage/index.html
```

---

## Deployment

### Static hosting (recommended)

The build output is a static site (`./dist/`). Drop it on any static host:

- **GitHub Pages** — `.github/workflows/deploy.yml` includes an auto-deploy workflow.
- **Netlify / Vercel / Cloudflare Pages** — point at the repo, build command `npm run build`, output dir `dist/`.
- **Self-hosted** — `dist/` is just HTML/CSS/JS. Serve with Nginx, Caddy, Apache, or even `python -m http.server`.

### Smart TV / Fire Stick

1. Build the project (`npm run build`).
2. Deploy to a static host with HTTPS (required for the service worker).
3. Open the URL in the TV's browser, or — for the most reliable result on older panels — run it from an attached media player (see below).
4. Use the browser's "Add to Home Screen" for a fullscreen PWA launch where supported.

### Raspberry Pi / mini-PC kiosk

For an unattended display, running the app in a kiosk browser on an attached player is the most reliable path (and sidesteps the browser limitations of older TVs):

```bash
# On a Pi running Raspberry Pi OS (or any Linux with X)
sudo apt install chromium-browser
# In autostart:
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --start-fullscreen "https://your-deployed-url"
```

---

## Browser support

The layout uses **CSS container queries** (`cqi` units) for its fluid type, so it needs a reasonably modern engine:

| Browser                   | Status                                              |
| ------------------------- | --------------------------------------------------- |
| Chrome / Edge ≥ 105       | ✅ Full support                                     |
| Firefox ≥ 110             | ✅ Full support                                     |
| Safari ≥ 16               | ✅ Full support                                     |
| Android TV (Chrome ≥ 105) | ✅ Supported                                        |
| Older smart TVs (≤ ~2021) | ⚠️ Container queries unsupported — run from an attached media player (Pi / Android box / Chromebox) instead |

The app relies on:

- ES2020+ features
- CSS Grid, custom properties, and **container queries**
- `Intl.DateTimeFormat` with timezone support
- Service Worker (for offline)

---

## Contributing

Pull requests welcome. For larger changes, please open an issue first to discuss.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes — **add tests** for new logic (see [TESTING.md](TESTING.md))
4. Run `npm test` and `npm run lint`
5. Commit and open a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for details, and [BACKLOG.md](BACKLOG.md) for open threads and deferred ideas.

### Code style

- ESLint config in `eslint.config.js`; Stylelint config in `stylelint.config.mjs`
- Two-space indentation, single quotes
- Test files use `*.test.js` / `*.test.jsx` in adjacent `__tests__/` folders

---

## Tech stack

- **[React 19](https://react.dev/)** — UI
- **[Vite 6](https://vitejs.dev/)** — build & dev server
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** — service worker / offline
- **[adhan](https://github.com/batoulapps/adhan-js)** — prayer-time calculation
- **[suncalc](https://github.com/mourner/suncalc)** — sun/moon astronomy
- **[Open-Meteo](https://open-meteo.com/)** — weather & geocoding (free, no key)
- **[Vitest](https://vitest.dev/)** + **[@testing-library/react](https://testing-library.com/)** — testing

---

## License

[MIT](LICENSE) — free for any use, including commercial. Attribution appreciated but not required.

---

## Acknowledgments

- Prayer-time calculation: **[Batoul Apps / adhan-js](https://github.com/batoulapps/adhan-js)**.
- Weather & geocoding: **[Open-Meteo](https://open-meteo.com/)** — high-quality data, keyless API.
- Solar position math: **[Vladimir Agafonkin / suncalc](https://github.com/mourner/suncalc)**.

---

<div align="center">

**Built for the ummah. May Allah accept it.**

</div>

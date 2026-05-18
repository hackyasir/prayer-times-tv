<!-- markdownlint-disable-next-line MD041 -->
<div align="center">

# 🕌 Prayer Times TV

**A self-contained, offline-first prayer times dashboard for mosque lobby displays, Smart TVs, and kiosks.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-115%2B-success)](TESTING.md)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

![Preview](screenshots/tv-dashboard.png)

</div>

---

## Why this project

Most mosque display software either requires a paid subscription, depends on a vendor server that may disappear, or comes with intrusive tracking. This dashboard does the opposite:

- **Self-hosted** — clone, build, deploy. No accounts, no API keys, no telemetry.
- **Offline-capable** — prayer-time math happens in the browser. Once cached, it runs without internet.
- **One-screen kiosk friendly** — designed to live on a TV for years. No CTAs, no notifications, no nag.
- **Free** — MIT licensed, all dependencies open-source.

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

- **Live clock + countdown** to the next prayer — second-accurate, in the city's wall-clock timezone. Last 60 sec switches to a giant pulsing display.
- **All 5 daily prayers + Sunrise** with bilingual names, SVG icons, and active-prayer gold glow.
- **5 progress visuals** (Ring, Day Bar, Moon, Hero, Line) — pick by room size and viewing distance.
- **6 themes** + adjustable font scale (70–130%) for distant TVs.
- **Pure-black backgrounds** to prevent OLED burn-in. Subtle corner decorations.
- **Fully responsive** — landscape TVs (HD/4K), portrait kiosks, tablets, phones. One codebase, 5 breakpoints.

</details>

<details>
<summary><strong>Prayer-time computation</strong></summary>

- **12 calculation methods** (MWL, ISNA, Moonsighting Committee, Egypt, Makkah, Dubai, Qatar, Kuwait, Karachi, Singapore, Turkey, Tehran). Powered by [`adhan-js`](https://github.com/batoulapps/adhan-js).
- **Two madhabs** (Shafi/Standard, Hanafi) for Asr calculation.
- **High-latitude rules** (Middle of Night, Seventh of Night, Twilight Angle) — required above ~48° latitude.
- **Manual or auto Iqamah** — auto mode adds a per-prayer buffer and rounds to the nearest quarter-hour.

</details>

<details>
<summary><strong>Jumu'ah & Eid</strong></summary>

- **Jumu'ah** — On Fridays, replaces Dhuhr with up to **4 configurable congregations**. Each slot has its own time, iqamah offset, and enable toggle.
- **Eid auto-detection** — banner appears automatically via Hijri calendar. Distinguishes Eid ul-Fitr (1 Shawwal) from Eid ul-Adha (10 Dhu al-Hijjah). Two separate schedules.
- **Test buttons** for staff to preview Friday / Eid layouts any day of the year.

</details>

<details>
<summary><strong>Other widgets</strong></summary>

- **Hijri date** with ±3 day offset for local moon-sighting variance.
- **Qibla compass** — live bearing to the Kaaba in degrees + 16-point cardinal.
- **Sun arc** — sunrise / solar noon / sunset with current position.
- **Moon arc** — moonrise / transit / moonset, lunar phase rendering.
- **Fasting window** — Suhoor → Iftar progress bar with countdown.
- **Weather widget** — current temp + conditions, auto-hidden when offline.
- **Announcement ticker** — multi-line input, seamless marquee, RTL-aware.

</details>

<details>
<summary><strong>Reverent mode (Blackout during salah)</strong></summary>

- Optional opacity overlay covers the dashboard from ~30s before iqamah until after the prayer ends.
- Bismillah centred. 3-second hold gesture to dismiss early.
- Per-prayer durations configurable.

</details>

<details>
<summary><strong>Internationalization</strong></summary>

- 3 languages: **English**, **Arabic** (RTL), **Urdu** (RTL).
- Bilingual prayer name pair stays visible regardless of UI language.

</details>

<details>
<summary><strong>Admin & deployment</strong></summary>

- **PIN-locked settings** via `VITE_SETTINGS_PIN` env var — for public kiosks.
- **Settings export / import / reset** as JSON. Backup, restore on another device, or wipe to defaults.
- **PWA installable** — add to home screen for fullscreen launch. Offline-first.
- **City search** across 600k+ cities via [Open-Meteo Geocoding](https://open-meteo.com/) (free, no key).

</details>

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│ main.jsx — provider chain + style imports                 │
└───────────────────────────────┬───────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────┐
│ App.jsx — orchestrator                                    │
│   useSettings()  → applied + drafts                       │
│   useT()         → i18n + RTL                             │
│   useCityTime()  → tz-aware "now"                         │
│   usePrayerTimes() → today/tomorrow/yesterday, active     │
│   useWeather, useChime, useLunarPhase, useBlackoutMode    │
└───────────────────────────────┬───────────────────────────┘
                                │ props
┌───────────────────────────────▼───────────────────────────┐
│ components/                                               │
│   Header · PrayerList · PrayerCard · Clock · Footer       │
│   Ticker · BlackoutOverlay · PinOverlay · NumberStepper   │
│   widgets/{SunArc, MoonArc, FastBar, WeatherStrip,        │
│            HeaderQibla}                                   │
│   settings/SettingsPanel                                  │
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
├── index.html                  # Strict CSP, PWA manifest, fonts
├── package.json
├── vite.config.js              # Vite 6 + vite-plugin-pwa
├── vitest.config.js            # Test runner config
├── TESTING.md                  # Test suite guide
├── .github/workflows/          # CI: GitHub Pages auto-deploy + tests
│
├── public/                     # Static assets (icons, manifest, sw.js)
│
└── src/
    ├── main.jsx                # Entry — provider chain
    ├── App.jsx                 # Orchestrator
    ├── lib/                    # Pure-JS helpers (no React)
    │   ├── hijri.js            # Gregorian↔Hijri, Eid detection
    │   ├── prayerCalc.js       # adhan-js wrapper
    │   ├── formatters.js       # fmt12, fmtCountdown, compass
    │   ├── audio.js            # Beep playback
    │   ├── weather.js          # WMO code → emoji/text
    │   ├── themes.js           # Theme CSS-var builder
    │   └── constants.js        # PRAYERS, METHODS, STORAGE_KEY...
    ├── hooks/                  # React state hooks
    ├── context/                # SettingsContext, I18nContext
    ├── i18n/                   # en.json, ar.json, ur.json
    ├── components/             # Presentational React components
    │   ├── settings/SettingsPanel.jsx
    │   └── widgets/            # SunArc, MoonArc, FastBar, ...
    ├── styles/                 # CSS — bundled into single sheet via Vite
    └── tests/                  # Test setup (test files live in __tests__/)
```

---

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_SETTINGS_PIN` | _(none)_ | If set, requires this PIN to open the Settings panel. Useful for public kiosks. |

Create a `.env.local` file at project root:

```bash
VITE_SETTINGS_PIN=1234
```

### Runtime settings

Everything else is configured at runtime through the **Settings** panel (gear icon, top-right). Settings persist in `localStorage` and can be exported/imported as JSON.

Settings include: location, calculation method, madhab, high-latitude rule, iqamah offsets (manual or auto), Jumu'ah/Eid schedules, theme, font scale, language, blackout durations, announcements, and chime preferences.

---

## Development

### Prerequisites

- **Node.js ≥ 20**
- **npm** (or `pnpm` / `yarn` if you prefer — lockfile is `package-lock.json`)

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server at `http://localhost:5173` |
| `npm run build` | Production build → `./dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint on `src/` |
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run test:coverage` | Generate a coverage report in `./coverage/` |

### Testing

This project has a **115+ test suite** built on Vitest. See [TESTING.md](TESTING.md) for the full guide.

```bash
npm test                 # quick: run all tests
npm run test:coverage    # full: HTML report at ./coverage/index.html
```

---

## Deployment

### Static hosting (recommended)

The build output is a static site (`./dist/`). Drop it on any static host:

- **GitHub Pages** — `.github/workflows/` already includes an auto-deploy workflow.
- **Netlify / Vercel / Cloudflare Pages** — point at the repo, build command `npm run build`, output dir `dist/`.
- **Self-hosted** — `dist/` is just HTML/CSS/JS. Serve with Nginx, Caddy, Apache, or even `python -m http.server`.

### Smart TV / Fire Stick

1. Build the project (`npm run build`).
2. Deploy to a static host with HTTPS (required for the service worker).
3. Open the URL in the TV's browser (Silk on Fire TV, Vewd on Samsung, Chrome on Android TV).
4. Use the browser's "Add to Home Screen" option for fullscreen PWA launch.

### Raspberry Pi kiosk

```bash
# On a Pi running Raspberry Pi OS (or any Linux with X)
sudo apt install chromium-browser
# In autostart:
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --start-fullscreen "https://your-deployed-url"
```

---

## Browser support

| Browser | Status |
|---|---|
| Chrome / Edge ≥ 110 | ✅ Full support |
| Firefox ≥ 110 | ✅ Full support |
| Safari ≥ 16 | ✅ Full support |
| Silk (Fire OS 7+) | ✅ Tested |
| Vewd (Samsung Tizen 5+) | ✅ Tested |
| Older smart TVs (≤ 2018) | ⚠️ May need `npm run build -- --target es2018` |

The app uses:
- ES2020+ features
- CSS Grid + custom properties
- `Intl.DateTimeFormat` with timezone support
- Service Worker (for offline)

---

## Roadmap

- [ ] Cloud sync backend (admin from phone)
- [ ] Printable monthly prayer-time PDF
- [ ] Real adhan audio (multiple reciters)
- [ ] Pre-prayer notification beeps (5/10 min warnings)
- [ ] Day-of-Arafah / Ashura special markers

See [issues](../../issues) for the active list.

---

## Contributing

Pull requests welcome. For larger changes, please open an issue first to discuss.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes — **add tests** for new logic (see [TESTING.md](TESTING.md))
4. Run `npm test` and `npm run lint`
5. Commit and open a PR

### Code style

- ESLint config in `eslint.config.js`
- Two-space indentation, single quotes
- Test files use `*.test.js` / `*.test.jsx` in adjacent `__tests__/` folders

---

## Tech stack

- **[React 19](https://react.dev/)** — UI
- **[Vite 6](https://vitejs.dev/)** — build & dev server
- **[adhan-js](https://github.com/batoulapps/adhan-js)** — prayer-time calculation
- **[suncalc](https://github.com/mourner/suncalc)** — sun/moon astronomy
- **[Open-Meteo](https://open-meteo.com/)** — weather & geocoding (free, no key)
- **[Vitest](https://vitest.dev/)** — testing framework
- **[@testing-library/react](https://testing-library.com/)** — component tests

---

## License

[MIT](LICENSE) — free for any use, including commercial. Attribution appreciated but not required.

---

## Acknowledgments

- Prayer-time calculation: **[Batoul Apps / adhan-js](https://github.com/batoulapps/adhan-js)** — the gold standard for Islamic prayer time computation.
- Weather & geocoding: **[Open-Meteo](https://open-meteo.com/)** — high-quality data, keyless API.
- Solar position math: **[Vladimir Agafonkin / suncalc](https://github.com/mourner/suncalc)**.

---

<div align="center">

**Built for the ummah. May Allah accept it.**

</div>

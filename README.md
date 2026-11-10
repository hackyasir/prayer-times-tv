<!-- markdownlint-disable-next-line MD041 -->
<div align="center">

# 🕌 Prayer Times TV

**A self-hosted, offline-first prayer times display for mosque halls, lobby TVs and kiosks.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-251-success)](TESTING.md)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

## Why this project

Most mosque display software needs a paid subscription, depends on a vendor server that may disappear, or tracks its users. This display does the opposite:

- **Self-hosted** — clone, build, deploy. No accounts, no API keys, no telemetry.
- **Works offline** — prayer times are calculated in the browser with [`adhan`](https://github.com/batoulapps/adhan-js). After the first visit, the service worker keeps the whole app (code, fonts, sound, images) cached, so the display keeps running with the internet unplugged.
- **Built to stay on a TV for years** — readable from the back of the hall, light on weak TV hardware, no pop-ups or nags.
- **Free** — MIT licensed; every dependency is open source.

Only two features use the network, and both fail gracefully:

- **Weather** (optional) — sends the display's latitude and longitude to [Open-Meteo](https://open-meteo.com/) every 10 minutes.
- **City search** in Settings — sends the search text to Open-Meteo's geocoding service.

Prayer times, Hijri date, Jumu'ah and Eid logic, blackout and the clock are all computed locally. Fonts are bundled with the app (no Google Fonts requests).

---

## Quick start

```bash
git clone <repo-url> prayer-times-tv
cd prayer-times-tv
npm install
npm run dev          # http://localhost:5173
```

For a production build:

```bash
npm run build        # static site in ./dist/ — deploy anywhere
```

On first open the display asks for the device's location; if you allow it, it uses that position and the device's timezone. After that the saved location is always kept — open **Settings** (gear icon, top right, or <kbd>Alt</kbd>+<kbd>S</kbd>) to search for your city and set the calculation method, iqamah times and the rest. Settings are saved on each device (`localStorage`) and can be exported and imported as JSON.

---

## Features

<details>
<summary><strong>Display & layout</strong> (click to expand)</summary>

- **Prayer times come first** — the adhan and iqamah times are the largest text in the list, sized to fill the column on any screen.
- **Fits any screen shape** — 16:9, 16:10, 4:3, ultra-wide and portrait. Text is sized from the space each area actually has (height as well as width), so the screen fills without gaps and nothing is cut off. 1080p and 4K TVs scale in proportion.
- **Live clock and countdown** in the city's timezone (not the device's). Digits keep a fixed width, so the time doesn't shift left and right as it ticks. In the final minute the countdown switches to large digits.
- **Iqamah countdown** — between a prayer's adhan and its iqamah, the countdown switches to "Iqamah" and counts down to it in minutes and seconds.
- **All five daily prayers** with bilingual names, icons, and a highlighted, pulsing active prayer.
- **6 progress styles** — Hero (default), Ring, Day Bar, Moon, Line, Orbit.
- **6 themes** — Classic Gold, Emerald Night, Royal Blue, Midnight Teal, Warm Sand, Pure White.
- **Viewing-distance scaling** — Manual (70–130%), By distance (presets for room size), or Calibrate by eye. Text grows as far as the screen allows; it can't be pushed off the edge.
- **Eco mode** (on by default) — stops decorative animation and dims the background art for always-on panels.
- **Dark backgrounds** to limit OLED burn-in, with subtle Islamic geometric background art.

</details>

<details>
<summary><strong>Prayer-time calculation</strong></summary>

- **12 calculation methods** — Muslim World League, ISNA, Moonsighting Committee, Egyptian Authority, Umm al-Qura (Makkah), Dubai, Qatar, Kuwait, University of Karachi, MUIS Singapore, Diyanet (Turkey), University of Tehran.
- **Two Asr conventions** — Standard (Shafi'i, Maliki, Hanbali) and Hanafi.
- **High-latitude rules** — Middle of the Night, Seventh of the Night, Twilight Angle (for cities above about 48°).
- **Manual or automatic iqamah**:
  - Manual: a fixed number of minutes after each adhan.
  - Automatic: adds a per-prayer buffer to the adhan, then rounds to the nearest quarter-hour. It's never earlier than the adhan, so the gap can come out a few minutes shorter or longer than the buffer. A buffer of 0 means iqamah at the adhan time.

</details>

<details>
<summary><strong>Jumu'ah & Eid</strong></summary>

- **Jumu'ah** — on Fridays, up to **4 congregations** replace Dhuhr in the list, the countdown, the beeps, the blackout and the announcements. If every Jumu'ah slot is disabled, Dhuhr stays.
- **Eid detection** — the Eid banner appears automatically from the Hijri calendar, with separate schedules for Eid ul-Fitr (1 Shawwal) and Eid ul-Adha (10 Dhu al-Hijjah).
- **Eid venue** — an optional location line for the banner and announcements (e.g. when Eid prayer is at a community centre).
- **Test buttons** (development builds) preview Friday, Eid, blackout and the final-minute countdown on any day.

</details>

<details>
<summary><strong>Announcements & automatic notices</strong></summary>

- **Ticker** — scrolling or one-at-a-time, right-to-left aware, sized to be read across the hall.
- **Per-line markup** — start a line with `!` to mark it urgent; add `@YYYY-MM-DD` to hide it after that date (in the city's timezone).
- **Automatic notices** (optional) — next prayer and next congregation, Jumu'ah today, Eid countdown, and Sunnah-fast reminders.
- **Sunnah fasts** — Monday/Thursday, White Days (13–15), Arafah, Ashura, Tasu'a and the six of Shawwal. Overlapping fasts combine into one line, and no fast is suggested on the two Eids or the days of Tashreeq.

</details>

<details>
<summary><strong>Other widgets</strong></summary>

- **Hijri date** with a ±3-day offset to match local moon sighting.
- **Qibla** — bearing to the Kaaba in degrees with a 16-point direction.
- **Sun arc** by day (sunrise, solar noon, sunset) and **moon arc** at night (moonrise, transit, moonset, current phase).
- **Fasting bar** — Suhoor → Iftar progress with time remaining.
- **Weather** — temperature, conditions and high/low; hidden when offline.

</details>

<details>
<summary><strong>Blackout during salah</strong></summary>

- Optional overlay that dims the display from a few seconds before each congregation until the prayer ends.
- Covers the daily prayers, each Jumu'ah slot on Fridays, and the Eid prayer on the Eid day.
- Durations per prayer (including Jumu'ah and Eid) and overlay opacity are configurable.
- Hold anywhere for 3 seconds to dismiss early (with on-screen progress, so a passing tap won't dismiss it).

</details>

<details>
<summary><strong>Printable monthly schedule</strong></summary>

- A full month of adhan and iqamah times per prayer, Jumu'ah, and the Hijri date.
- Sunnah-fast markers matching the on-screen rules, with a legend for the markers that occur that month.
- A light ornamental background that prints cleanly on white paper.

</details>

<details>
<summary><strong>Languages</strong></summary>

- **English**, **Arabic** and **Urdu** (both right-to-left).
- Prayer names always show in two scripts, whatever the interface language.
- An optional per-screen label (e.g. "Main Hall", "Women's Section") for mosques with several screens.

</details>

<details>
<summary><strong>Settings & administration</strong></summary>

- **Made for a TV** — on large screens the Settings panel is scaled up for reading from a few feet away, with a clear focus outline. With a TV remote, Up/Down move between controls, OK opens a dropdown or moves on from a text or time field, and Left/Right switch tabs on the tab row. Escape closes the panel.
- **Optional PIN** before Settings opens (see [Configuration](#configuration)).
- **Export, import and reset** settings as JSON; imports are validated and cleaned before use.
- **City search** via [Open-Meteo geocoding](https://open-meteo.com/) — about 600,000 cities, free, no key.
- **Beeps** (optional) at adhan and/or iqamah. Jumu'ah and Eid slots beep when either is on.
- **Installable** as a PWA for a fullscreen launch.

</details>

<details>
<summary><strong>Offline & performance</strong></summary>

- **Offline** — a Workbox service worker precaches every file the display needs, including fonts, the beep and the print ornament. Works at a domain root or under a sub-path such as `/prayer-times-tv/` on GitHub Pages.
- **Light on TV hardware**:
  - Only the clock and countdown update every second; the prayer list, arcs, fasting bar, weather and ticker update once a minute or once a day.
  - The background art redraws only when it visibly changes (every few minutes), on its own layer.
  - Date formatters are created once and reused.
  - Settings and the printable schedule load on demand, keeping the startup download small.
- **Built-in measurements** — add `?perf` to the URL to see an on-screen performance overlay (see [Performance on TVs](#performance-on-tvs)).

</details>

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│ main.jsx — providers, styles, self-hosted fonts, ?perf    │
└───────────────────────────────┬───────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────┐
│ App.jsx — orchestrator                                    │
│   useSettings()    → applied + draft settings             │
│   useT()           → translations + RTL                   │
│   useCityTime()    → city-timezone "now" (ticks 1/s)      │
│   usePrayerTimes() → today/tomorrow/yesterday, active     │
│   buildCongregations() → today's iqamah/Jumu'ah/Eid list  │
│   useBlackoutMode, useChime, useWeather, useLunarPhase    │
│   per-minute / per-day values for components that don't  │
│   need second-by-second updates                           │
└───────────────────────────────┬───────────────────────────┘
                                │ props
┌───────────────────────────────▼───────────────────────────┐
│ components/                                               │
│   Clock (per second) · StableDigits                       │
│   Header · PrayerList (memoised) · PrayerCard             │
│   Footer · Ticker · BlackoutOverlay · PinOverlay          │
│   ProgressVisual · QiblaCompass · NumberStepper           │
│   widgets/ SunArc · MoonArc · FastBar · WeatherStrip ·    │
│            HeaderQibla (memoised)                         │
│   settings/ SettingsPanel · LogoUploader (lazy-loaded)    │
│   PrintableSchedule (lazy-loaded)                         │
└───────────────────────────────────────────────────────────┘

   ┌──────┐  ┌──────┐  ┌────────┐  ┌──────┐  ┌────────┐
   │ lib/ │  │hooks/│  │context/│  │ i18n/│  │ styles/│
   │ pure │  │React │  │settings│  │ dicts│  │  CSS   │
   │  JS  │  │state │  │  i18n  │  │      │  │        │
   └──────┘  └──────┘  └────────┘  └──────┘  └────────┘
```

### Project layout

```
prayer-times-tv/
├── index.html                  # CSP, icons (manifest link injected at build)
├── vite.config.js              # Vite + vite-plugin-pwa (injectManifest, web manifest)
├── vitest.config.js
├── TESTING.md                  # Test suite guide
├── .github/
│   ├── workflows/deploy.yml    # Lint + test + build + GitHub Pages deploy
│   └── dependabot.yml
├── public/                     # Icons, ornament.jpg, sounds/
└── src/
    ├── main.jsx                # Entry: providers, styles, fonts, perf monitor
    ├── App.jsx                 # Orchestrator
    ├── sw.js                   # Service worker (Workbox precache + offline navigation)
    ├── IslamicGeometryEngine.jsx  # Background art (memoised SVG)
    ├── lib/                    # Pure JS, no React
    │   ├── prayerCalc.js       # adhan wrapper, qibla, timezone offset
    │   ├── hijri.js            # Gregorian ↔ Hijri, Eid detection
    │   ├── iqamah.js           # Manual / automatic iqamah
    │   ├── congregations.js    # Today's congregations; pending-iqamah lookup
    │   ├── sunnahFasts.js      # Recommended-fast rules (screen + print)
    │   ├── viewingScale.js     # Viewing-distance scaling
    │   ├── scheduleValidation.js
    │   ├── settingsImport.js   # Validates and cleans imported settings
    │   ├── formatters.js       # Time and countdown formatting (cached formatters)
    │   ├── perfMonitor.js      # ?perf overlay
    │   ├── audio.js            # Beep playback
    │   ├── weather.js          # Weather code → icon / text
    │   ├── themes.js           # Theme colour variables
    │   └── constants.js        # Prayers, methods, storage key, env flags
    ├── hooks/                  # useCityTime, usePrayerTimes, useBlackoutMode, useChime, …
    ├── context/                # SettingsContext, I18nContext
    ├── i18n/                   # en.json, ar.json, ur.json
    ├── components/             # React components (tests in __tests__/)
    │   ├── settings/
    │   └── widgets/
    ├── styles/                 # CSS, one file per area; responsive.css holds all media
    │                           # queries and the fit-to-space rules
    └── tests/                  # Test setup
```

---

## Configuration

### Environment variables

Set these at build time, for example in `.env.local` at the project root (never commit it).

| Variable                 | Default                | Description                                                                                 |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------- |
| `VITE_SETTINGS_PIN`      | _(none)_               | PIN required before Settings opens.                                                         |
| `VITE_SHOW_TEST_BUTTONS` | on in dev, off in prod | `true` / `false` to force the preview buttons (Friday, Eid, blackout, countdown) on or off. |
| `VITE_APP_ENV`           | _(none)_               | Set to `staging` to treat a production build as staging (test buttons on).                  |
| `VITE_BASE_URL`          | `/`                    | Base path when the app is served from a sub-folder, e.g. `/prayer-times-tv/`.               |

```bash
# .env.local
VITE_SETTINGS_PIN=4826
```

> **About the PIN:** Vite builds environment values into the JavaScript the browser downloads, so anyone who opens the browser's developer tools can read the PIN. It keeps casual visitors out of Settings; it isn't a real lock. Don't reuse a PIN that protects anything else.

### Runtime settings

Everything else is set in the **Settings** panel and saved on the device: location, calculation method, Asr convention, high-latitude rule, iqamah (manual or automatic), Jumu'ah and Eid schedules, Eid venue, theme, text size, viewing distance, progress style, language, masjid name, logo and screen label, eco mode, blackout, announcements and ticker style, automatic notices, and beeps.

Because settings live on each device, the quickest way to set up several screens is to configure one, **Export** the settings, and **Import** the file on the others.

---

## Development

### Prerequisites

- **Node.js 20 or newer** (CI uses Node 20)
- **npm** (lockfile: `package-lock.json`)

### Scripts

| Command                 | What it does                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`           | Dev server at `http://localhost:5173` (also reachable on your LAN for testing on a TV) |
| `npm run build`         | Production build → `./dist/`                                                           |
| `npm run preview`       | Serve the production build locally                                                     |
| `npm run lint`          | ESLint, then Stylelint on the CSS                                                      |
| `npm run format`        | Format with Prettier                                                                   |
| `npm test`              | Run the test suite once                                                                |
| `npm run test:watch`    | Re-run tests on change                                                                 |
| `npm run test:coverage` | Coverage report in `./coverage/`                                                       |
| `npm run ci-check`      | `npm ci` + lint + test + build                                                         |

### Testing

**251 tests across 18 files**, built on Vitest and Testing Library. They cover prayer and iqamah calculation, Hijri and Eid detection, Sunnah fasts, today's congregations (Friday and Eid rules), blackout windows, beeps, settings import and first-run detection, the clock's countdown modes, and more. See [TESTING.md](TESTING.md).

```bash
npm test
npm run test:coverage    # HTML report at ./coverage/index.html
```

---

## Deployment

The build is a static site in `./dist/`. HTTPS is required for the service worker (offline mode) and for location access.

### GitHub Pages

`.github/workflows/deploy.yml` lints, tests, builds and deploys on every push to `main`, under `/<repository-name>/`.

- In the repository settings, set **Pages → Source** to "GitHub Actions".
- Optional repository **secret** `VITE_SETTINGS_PIN` — the Settings PIN.
- Optional repository **variable** `VITE_SHOW_TEST_BUTTONS` — the workflow defaults it to `true`, so set it to `false` for a production display.

### Other static hosts

- **Netlify / Vercel / Cloudflare Pages** — build command `npm run build`, output directory `dist`.
- **Your own server** — serve `dist/` with Nginx, Caddy, Apache or similar. If it's not at the domain root, build with `VITE_BASE_URL=/your-path/`.

### Smart TV / Fire Stick

1. Deploy the build to an HTTPS host.
2. Open the URL in the TV's browser. Check [Browser support](#browser-support) first — older built-in TV browsers can't run the app.
3. Use "Add to Home Screen" for a fullscreen launch where the browser supports it.
4. Settings work with the TV remote (see **Settings & administration** under [Features](#features)).

### Raspberry Pi / mini-PC kiosk

For an unattended display, a kiosk browser on a small attached computer is the most reliable option, and avoids the limits of older built-in TV browsers:

```bash
# Raspberry Pi OS (or any Linux desktop)
sudo apt install chromium-browser
# Add to autostart:
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --start-fullscreen "https://your-deployed-url"
```

### Updating a display

A running display keeps its cached version until the page reloads. After you deploy a new build, reload the display; some browsers need two reloads (the first fetches the update, the second shows it).

---

## Performance on TVs

Built-in TV browsers often run on slow processors. To see how the display performs on a particular TV, open it with `?perf` added to the address (for example `https://your-host/?perf`). A small overlay in the bottom-left corner shows:

| Line        | Meaning                                                          |
| ----------- | ---------------------------------------------------------------- |
| `tick`      | Time to apply each 1-second update (average and 95th percentile) |
| `DOM`       | Page changes per second (normally just the clock digits)         |
| `formatter` | Date formatters created per second (should be 0)                 |
| `frames`    | Frame rate and frames slower than 50 ms                          |
| `longtask`  | Main-thread tasks over 50 ms (where the browser reports them)    |
| `nodes`     | Size of the page                                                 |

Remove `?perf` for normal use. If a TV still struggles: keep **Eco mode** on, use the default **Hero** progress style, or run the display from a small media player instead (see above).

---

## Browser support

| Browser                                                      | Status                                                                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome / Edge 105+, Firefox 110+, Safari 16+                 | ✅ Full support, including fit-to-space sizing                                                                                                                                    |
| Android TV, Fire TV or Chromecast with an up-to-date browser | ✅ Full support                                                                                                                                                                   |
| Chromium 88–104 (common in built-in smart-TV browsers)       | ⚠️ Should work, with simpler text sizing based on screen size. Not tested on real TV hardware.                                                                                    |
| Chromium before 88                                           | ❌ Not supported. Before 80 the app won't start (it uses ES2020 JavaScript); 80–87 lack CSS the layout relies on (`inset`, flexbox `gap`). Use a media player or mini PC instead. |

To check a TV, look up its browser's Chromium version (many TV browsers show it in their settings or "about" page), or open the display and see whether it loads.

The app needs ES2020 JavaScript, CSS Grid, custom properties, `min()` / `max()` / `clamp()`, `Intl.DateTimeFormat` with timezone support, and service workers for offline use. Where container queries are available (Chromium 105+), text is sized from the space each area has; other browsers get fallback sizes.

---

## Contributing

Pull requests are welcome. For larger changes, please open an issue first.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/my-feature`).
3. Make your changes and **add tests** for new logic (see [TESTING.md](TESTING.md)).
4. Run `npm test` and `npm run lint`.
5. Commit and open a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Code style

- ESLint (`eslint.config.js`), Stylelint (`stylelint.config.mjs`) and Prettier (`.prettierrc.json`).
- Two-space indentation, single quotes.
- Tests live next to the code in `__tests__/` folders as `*.test.js` / `*.test.jsx`.

---

## Tech stack

- **[React 19](https://react.dev/)** — UI
- **[Vite 6](https://vitejs.dev/)** — build and dev server
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** + **[Workbox](https://developer.chrome.com/docs/workbox)** — service worker and offline cache
- **[adhan](https://github.com/batoulapps/adhan-js)** — prayer-time calculation
- **[suncalc](https://github.com/mourner/suncalc)** — sun and moon positions
- **[Fontsource](https://fontsource.org/)** — self-hosted Amiri, Noto Naskh Arabic and Rajdhani fonts
- **[Open-Meteo](https://open-meteo.com/)** — weather and city search (free, no key)
- **[Vitest](https://vitest.dev/)** + **[Testing Library](https://testing-library.com/)** — tests

---

## License

[MIT](LICENSE) — free for any use, including commercial. Attribution appreciated but not required.

The bundled fonts (Amiri, Noto Naskh Arabic, Rajdhani) are under the SIL Open Font License.

---

## Acknowledgments

- Prayer-time calculation: **[Batoul Apps / adhan-js](https://github.com/batoulapps/adhan-js)**
- Weather and geocoding: **[Open-Meteo](https://open-meteo.com/)**
- Sun and moon math: **[Vladimir Agafonkin / suncalc](https://github.com/mourner/suncalc)**
- Fonts: **Amiri** (Khaled Hosny), **Noto Naskh Arabic** (Google), **Rajdhani** (Indian Type Foundry)

---

<div align="center">

**Built for the ummah. May Allah accept it.**

</div>

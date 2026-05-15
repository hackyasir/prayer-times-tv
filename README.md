# 🕌 Prayer Times TV Dashboard

A self-contained prayer times dashboard built for **mosque lobby displays, Smart TVs, Fire Sticks, and large kiosks**. All prayer time calculations happen locally in the browser — no API key, no server, no network required after first load. Weather and city search use Open-Meteo's free, key-less endpoints.

![Preview](screenshots/tv-dashboard.png)

---

## What you get

| Capability | Detail |
|---|---|
| **Live clock** | Massive centre-stage clock, updated every second, in the city's wall-clock |
| **All 5 prayers + Sunrise** | Fajr · Dhuhr · Asr · Maghrib · Isha (Sunrise observed as a marker) — English + Arabic names |
| **Adhan + Iqamah** | Both times shown side-by-side for each prayer; iqamah offset configurable per prayer |
| **Pulsing active prayer** | The current prayer window glows; passed prayers dim; pre-Fajr night correctly tags Isha as still active |
| **Countdown to next** | HH:MM:SS until next prayer; final 60 seconds switch to a huge pulsing seconds digit |
| **Five progress styles** | Ring · Day Bar · Moon · Hero · Line — pick whichever fits your room |
| **Jumu'ah handling** | Replaces Dhuhr row on Fridays with 1–3 configurable congregations; preview block on other days |
| **Eid prayers** | Configurable Eid ul-Fitr / Eid ul-Adha slots with a banner that auto-shows N days before and hides 30 min after the last iqamah |
| **Qibla compass** | Live bearing to the Kaaba, with degrees + cardinal direction label |
| **Hijri date** | Today's Islamic calendar date with adjustable ±3 day offset |
| **Weather strip** | Current temp + emoji, Hi/Lo, humidity/wind/rain — refreshes every 10 minutes |
| **Sun day cycle** | Sunrise / Solar Noon / Sunset with daylight progress bar |
| **Fasting window** | Today's Fajr → Maghrib with progress bar and time-to-iftar countdown when active |
| **6 themes** | Classic Gold, Emerald, Royal Blue, Crimson Sunset, Pearl White, High Contrast |
| **Adjustable font scale** | 70–130% — useful for distant TVs or short-throw projectors |
| **Iqamah chimes** | Soft beep at adhan AND iqamah times; toggleable in settings; banner prompts user to unlock audio if browser blocks autoplay |
| **City search** | Live search across 600k+ cities via Open-Meteo Geocoding (or use device GPS) |
| **PIN-locked settings** | Optional via `VITE_SETTINGS_PIN` env var — useful when the display sits in a public area |
| **Fully responsive** | Works on portrait kiosks, landscape TVs (HD/4K), and even handheld phones — single codebase, 5 breakpoints |
| **OLED-friendly** | Pure-black backgrounds prevent burn-in; corner decorations subtle enough not to age the panel |
| **PWA installable** | Add to home screen from Silk/Chrome for fullscreen launch |

---

## Architecture

The codebase is organised in clearly-separated layers — each one has a single responsibility, no leaking concerns between them.

```
┌────────────────────────────────────────────────────────────────────┐
│ main.jsx                                                           │
│   - Imports styles/index.css (Vite bundles all 7 stylesheets)      │
│   - Wraps <App/> in <SettingsProvider>                             │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│ App.jsx (624 lines)                                                │
│   Composes hooks → derives state → renders components              │
│                                                                    │
│   useSettings()      → applied + drafts (location, theme, ...)     │
│   useCityTime()      → now, cityNow, cityNowParts, isFriday        │
│   usePrayerTimes()   → today/tomorrow/yesterday, active, next      │
│   useWeather()       → weather + state                             │
│   useAudioUnlock()   → audioReady                                  │
│   useChime()         → fires beeps at iqamah/adhan times           │
│   useLunarPhase()    → moon phase from Hijri day                   │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ props
┌──────────────────────────────▼─────────────────────────────────────┐
│ components/                                                        │
│   Header · PrayerList · Clock · widgets · Footer                   │
│   PinOverlay · settings/SettingsPanel                              │
│                                                                    │
│   Pure presentational. No useState beyond local UI state.          │
│   No fetch, no setTimeout, no localStorage.                        │
└────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐
   │  lib/        │  │  hooks/      │  │  context/    │  │  styles/ │
   │  Pure JS     │  │  React state │  │  Settings    │  │  CSS     │
   │  No React    │  │  + effects   │  │  Provider    │  │  No JS   │
   └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘
```

### Source tree

```
prayer-times-tv/
├── index.html                 Strict CSP, PWA manifest link, Google Fonts
├── package.json
├── vite.config.js             Vite 6 + vite-plugin-pwa
├── tailwind.config.js         (present but unused by active code)
│
├── public/
│   ├── manifest.json          PWA manifest
│   ├── sw.js                  Hand-crafted service worker
│   └── sounds/
│       └── beep.mp3           Soft chime for iqamah/adhan
│
└── src/
    ├── main.jsx               React entry — wraps app in SettingsProvider
    ├── App.jsx                Top-level composition
    ├── IslamicGeometryEngine.jsx
    │
    ├── lib/                   Pure utilities (no React)
    │   ├── constants.js       PRAYERS, METHODS, HADITHS, env config, etc.
    │   ├── prayerCalc.js      calcTimes, calcQibla, tzOffsetHours
    │   ├── hijri.js           toHijri — Gregorian → Islamic calendar
    │   ├── formatters.js      fmt12, addMins, fmtCountdown, compass
    │   ├── themes.js          THEMES + buildThemeVars (6 themes)
    │   ├── audio.js           primeAudio, playBeep, isAudioUnlocked
    │   └── weather.js         wmoEmoji, wmoText (Open-Meteo WMO codes)
    │
    ├── hooks/                 Custom React hooks
    │   ├── useCityTime.js     1-sec tick + city-tz extraction
    │   ├── usePrayerTimes.js  All prayer time derivations
    │   ├── useWeather.js      Open-Meteo fetch + 10-min refresh
    │   ├── useAudioUnlock.js  First-gesture audio primer
    │   ├── useChime.js        Iqamah/adhan beep firing
    │   └── useLunarPhase.js   Moon phase from Hijri day
    │
    ├── context/
    │   └── SettingsContext.jsx  Applied/draft state + localStorage
    │
    ├── components/            Visual components
    │   ├── Header.jsx
    │   ├── Footer.jsx
    │   ├── Clock.jsx          Centre column (clock + countdown + hadith)
    │   ├── PrayerList.jsx
    │   ├── PrayerCard.jsx
    │   ├── ProgressVisual.jsx 5 styles (Ring/DayBar/Moon/Hero/Line)
    │   ├── QiblaCompass.jsx
    │   ├── MosqueIcon.jsx     Persian mandala animated icon
    │   ├── AudioUnlockBanner.jsx
    │   ├── PinOverlay.jsx
    │   ├── widgets/
    │   │   ├── WeatherCard.jsx
    │   │   ├── SunDayCycle.jsx
    │   │   └── FastQiblaCard.jsx
    │   └── settings/
    │       └── SettingsPanel.jsx
    │
    └── styles/                Static CSS (Vite-bundled)
        ├── index.css          Barrel — imports the 7 below in cascade order
        ├── base.css           Fonts, reset, root, animations
        ├── layout.css         Main grid, corners, header
        ├── prayer-cards.css   Prayer rows + Jumu'ah/Eid banners
        ├── clock.css          Centre column
        ├── widgets.css        Bottom band widgets + status strip
        ├── settings.css       Settings panel overlay
        └── responsive.css     5 media queries
```

### How the data flows

Every clock-driven value pivots around a single source of truth: **the city's wall-clock**, computed via `Intl.DateTimeFormat` with the city's IANA timezone. This means a server in London powering a dashboard for Karachi shows Karachi time, not UK time — every prayer time, every countdown, every hijri date is computed against the city.

`useCityTime` ticks every second and exposes:
- `now` — real instant (same everywhere)
- `cityNowParts` — h/m/s/weekday/month/day/year extracted in `cityTz`
- `cityNow` — Date whose local fields match the city's wall-clock (safe to feed into `calcTimes`)
- `isFriday` — whether it's Friday in `cityTz`

`usePrayerTimes` consumes that anchor + location + method, returns today's/tomorrow's/yesterday's prayer times plus the active/next prayer and the elapsed % of the current window. It handles the tricky pre-Fajr case where "active" should still be yesterday's Isha (it entered last night, ends at today's Fajr).

### Settings — applied vs drafts

The Settings panel needs to let users edit values without immediately mutating the live dashboard. `SettingsContext` keeps both:

- **`applied`** — currently in effect; drives the render; persists to localStorage on every change
- **`drafts`** — what the Settings panel mutates; only commits to `applied` on "Apply"; discarded on "Cancel"

Direct updates (geolocation, city-search click) bypass drafts via `updateApplied()` since they're one-shot decisions, not multi-field forms.

### Prayer time calculation

`lib/prayerCalc.js` implements the standard spherical astronomy formula for prayer times:

```
cos(H) = [sin(altitude) − sin(latitude) · sin(declination)]
         / [cos(latitude) · cos(declination)]

local clock time = (12 − EqT) − longitude/15 + tzOffset ± H
```

Where `H` is the hour angle, `EqT` is the equation of time (in hours), and the altitude depends on the prayer:
- Fajr: `−fajrAngle` (sun below horizon by the method's convention)
- Sunrise/Maghrib: `−0.833°` (refraction-corrected horizon)
- Dhuhr: solar noon
- Asr: `arctan(1 / (shadowFactor + tan|lat − decl|))` — Standard shadowFactor=1, Hanafi=2
- Isha: `−ishaAngle`, or for Umm al-Qura: Maghrib + 90 minutes

Six calculation methods are supported (see Settings → Calculation Method):

| Method | Fajr | Isha |
|---|---|---|
| Muslim World League | 18° | 17° |
| ISNA – North America | 15° | 15° |
| Egyptian Authority | 19.5° | 17.5° |
| Umm al-Qura (Makkah) | 18.5° | Maghrib + 90 min |
| University of Karachi | 18° | 18° |
| MUIS Singapore | 20° | 18° |

Cross-validated against published values for Oakville · NYC · London · Karachi · Jakarta · Riyadh — matches to within ±1 minute.

---

## Quick start

```bash
# 1. Install
npm install

# 2. (Optional) configure env vars
cp .env.example .env
# Edit .env to set VITE_SETTINGS_PIN or VITE_SHOW_TEST_BUTTONS

# 3. Dev server
npm run dev
#  → http://localhost:5173
#  → also listens on 0.0.0.0:5173 for LAN access (TV/Fire Stick testing)

# 4. Production build
npm run build       # → dist/

# 5. Preview build locally
npm run preview
```

Requires Node 20+.

---

## Configuration

All settings persist to `localStorage` (key: `masjid_dashboard_v1`) and survive page reloads. They are set via the in-app **⚙ Settings** panel (footer-left button) — there is no separate config file. The panel covers:

| Group | Options |
|---|---|
| **Display Theme** | Classic Gold · Emerald · Royal Blue · Crimson Sunset · Pearl White · High Contrast |
| **Display Size** | 70%–130% in 5% steps (affects text only, layout unchanged) |
| **Progress Style** | Ring · Day Bar · Moon · Hero · Line |
| **Prayer Beep** | On/off toggle + Test Beep button |
| **Location** | City search (Open-Meteo geocoding) OR "Use my location" (browser GPS) |
| **Masjid Name** | Optional — shown in header instead of "Prayer Times" |
| **Calculation Method** | One of the 6 listed above |
| **Asr Method** | Standard (Shafi'i / Maliki / Hanbali) or Hanafi |
| **Iqamah Offsets** | Minutes after adhan, per prayer (Fajr/Dhuhr/Asr/Maghrib/Isha) |
| **Jumu'ah Slots** | Up to 3 configurable Friday congregations (time + iqamah offset, enable/disable each) |
| **Eid Prayers** | Up to 3 slots, named (Eid ul-Fitr / Eid ul-Adha), with adjustable "days before" banner |
| **Hijri Date Adjustment** | ±3 days (handles disagreement between calculated and observed moonsighting) |

### Environment variables

Set in `.env` (copy from `.env.example`):

| Variable | Default | Effect |
|---|---|---|
| `VITE_SETTINGS_PIN` | `""` (unset) | If set, requires PIN entry before settings open. Good for public kiosks. |
| `VITE_SHOW_TEST_BUTTONS` | `true` | Set to `false` to hide the Test Jumu'ah / Test Pattern buttons in production. |

These are baked in at build time (Vite convention). To change them, edit `.env` and rebuild.

---

## Deployment

### Static hosting (GitHub Pages, Netlify, Vercel, S3, etc)

```bash
npm run build
```

Upload everything in `dist/` to your static host. The dashboard is a single-page app — no server-side logic required.

For **GitHub Pages** specifically, set the `VITE_BASE_URL` environment variable in your build step to the repo subpath (e.g. `VITE_BASE_URL=/prayer-times-tv/ npm run build`).

### PWA installation on Smart TV / Fire Stick

1. Open the deployed URL in **Silk Browser** (Fire Stick) or **Chrome** (Android TV)
2. Browser menu → **"Add to Home Screen"** or **"Install App"**
3. Launches fullscreen, landscape, with offline support via the service worker

---

## Built with

| Library | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite 6** | Build + dev server |
| **vite-plugin-pwa** | Service worker + manifest injection |

That's it for runtime dependencies. The prayer time math, hijri conversion, qibla calculation, theme system, audio handling, weather code interpretation, and timezone math are all **plain JavaScript** in `src/lib/`. No `adhan`, no `moment`, no `date-fns`, no UI library — every line of logic is in the repo and inspectable.

---

## Security

- **Strict Content Security Policy** in `index.html`: blocks XSS, clickjacking, plugin injection. Only same-origin scripts + Google Fonts.
- **No backend** — settings stay in `localStorage`, prayer times computed locally.
- **Two outbound calls only**, both to Open-Meteo (no API key, no auth, no tracking):
  - `geocoding-api.open-meteo.com/v1/search` — city search (only when the user types in the panel)
  - `api.open-meteo.com/v1/forecast` — current weather (on load + every 10 minutes)
- **Service worker** caches same-origin assets + Google Fonts for offline operation. Once cached, the dashboard works with the network unplugged.

---

## License

MIT. Free for mosque, community, school, and personal use.

---

*"الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ — Prayer is better than sleep."*

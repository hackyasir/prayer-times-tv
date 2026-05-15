# 🕌 Prayer Times TV Dashboard

A self-contained prayer times dashboard for **mosque lobby displays, Smart TVs, Fire Sticks, and kiosks**. All prayer time computation happens locally in the browser — no API key, no backend, no network needed after first load. Weather and city search use Open-Meteo's free, key-less endpoints.

![Preview](screenshots/tv-dashboard.png)

---

## Features

| Capability | Detail |
|---|---|
| **Live clock + countdown** | Massive centre-stage clock, second-accurate, in the city's wall-clock timezone. Final 60 sec switch to a giant pulsing seconds digit. |
| **All 5 prayers + Sunrise** | Fajr · Dhuhr · Asr · Maghrib · Isha + Sunrise marker. Bilingual primary/secondary names. SVG icon per prayer (rising sun → moon). |
| **Adhan + Iqamah** | Both shown per prayer. Iqamah offset configurable manually OR auto-computed (smart mode). |
| **Smart auto-iqamah** | Optional: iqamah = adhan + per-prayer buffer minutes, rounded UP to the next quarter-hour (:00 / :15 / :30 / :45). Stops daily edits as adhan times drift with seasons. |
| **Active-prayer glow** | Current prayer pulses gold; passed prayers dim; pre-Fajr night correctly tags yesterday's Isha as still active. |
| **5 progress visuals** | Ring · Day Bar · Moon · Hero · Line — pick by room/distance. |
| **Jumu'ah** | On Fridays, replaces Dhuhr in the prayer list AND as next-prayer. 1–3 configurable congregations. Dim preview on other days so staff can verify. |
| **Eid prayers** | Up to 3 named slots (Eid ul-Fitr / Eid ul-Adha). Banner auto-shows N days before, hides 30 min after last iqamah. |
| **Qibla compass** | Live bearing to the Kaaba in degrees + 16-point cardinal label. |
| **Hijri date** | Today's Islamic calendar date with adjustable ±3 day offset for moonsighting variance. |
| **Weather widget** | Current temp + emoji, Hi/Lo, humidity / wind / rain. Hidden entirely when offline — remaining widgets re-flow. |
| **Sun day cycle** | Sunrise / Solar Noon / Sunset with daylight progress bar showing % elapsed. |
| **Fasting window** | Today's Fajr → Maghrib with progress bar and time-to-iftar countdown while active. |
| **Announcement ticker** | Slim bottom strip with seamless scrolling marquee. Multi-line input in Settings. Direction-aware (LTR/RTL). Hidden when empty. |
| **Blackout mode during salah** | Configurable opacity overlay covers the dashboard from ~30s before iqamah until the prayer ends. Reverent Bismillah centred. 3-second hold-to-dismiss gesture. Per-prayer durations. |
| **i18n** | English · Arabic · Urdu with full RTL support. Bilingual prayer name pair stays visible regardless of language. |
| **6 themes** | Classic Gold · Emerald · Royal Blue · Crimson Sunset · Pearl White · High Contrast. |
| **Adjustable font scale** | 70–130% via `--t-fs` CSS variable — useful for distant TVs or short-throw projectors. |
| **Split adhan/iqamah beep** | Independent toggles. Default: iqamah ON, adhan OFF (most mosques play real adhan from speakers). Silent auto-unlock on first user interaction. |
| **City search** | Live search across 600k+ cities via Open-Meteo Geocoding, or "Use my location" via browser GPS. |
| **Settings location card** | Always-visible card below city search showing currently applied location + pending change preview. |
| **PIN-locked settings** | Optional via `VITE_SETTINGS_PIN` — for public kiosks. |
| **Export / Import / Reset settings** | Bottom of Settings panel. Download a JSON backup, restore on another device, or wipe to factory defaults. 2-click confirmation on reset. |
| **Tabbed Settings** | Five tabs: Display · Location · Prayer Times · Iqamah · Behaviour. Wraps to 2 rows on narrow screens. |
| **Fully responsive** | Portrait kiosks, landscape TVs (HD/4K), and phones — one codebase, 5 breakpoints. |
| **OLED-friendly** | Pure-black backgrounds prevent burn-in; subtle corner decorations. |
| **PWA installable** | Add to home screen from Silk/Chrome for fullscreen launch. Offline-first via service worker. |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ main.jsx                                                           │
│   - Imports styles/index.css (Vite bundles all stylesheets)        │
│   - Wraps <App/> in <SettingsProvider> > <I18nProvider>            │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│ App.jsx                                                            │
│   Composes hooks → derives state → renders components              │
│                                                                    │
│   useSettings()       → applied + drafts (location, theme, ...)    │
│   useT()              → i18n translation + lang + isRTL            │
│   useCityTime()       → now, cityNow, cityNowParts, isFriday       │
│   usePrayerTimes()    → today/tomorrow/yesterday, active, next     │
│   useWeather()        → weather + state                            │
│   useAudioUnlock()    → silent unlock on first gesture             │
│   useChime()          → fires beeps at adhan/iqamah                │
│   useLunarPhase()     → moon phase from Hijri day                  │
│   useBlackoutMode()   → derives blackout active/endsAt             │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ props
┌──────────────────────────────▼─────────────────────────────────────┐
│ components/                                                        │
│   Header · PrayerList · PrayerCard · PrayerIcons · Clock           │
│   Footer · Ticker · BlackoutOverlay · PinOverlay                   │
│   widgets/{WeatherCard, SunDayCycle, FastQiblaCard}                │
│   settings/SettingsPanel                                           │
│                                                                    │
│   Mostly pure presentational. Settings panel + Blackout overlay    │
│   manage local UI state (tabs, hold-gesture).                      │
└────────────────────────────────────────────────────────────────────┘

   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  lib/    │  │  hooks/  │  │ context/ │  │  i18n/   │  │ styles/  │
   │ Pure JS  │  │ React    │  │ Settings │  │ Dicts +  │  │ Bundled  │
   │ No React │  │ state    │  │ context  │  │ Provider │  │ CSS      │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Source tree

```
prayer-times-tv/
├── index.html                 Strict CSP, PWA manifest, Google Fonts
├── package.json
├── vite.config.js             Vite 6 + vite-plugin-pwa
├── .github/workflows/         GitHub Pages auto-deploy
│
├── public/
│   ├── manifest.json          PWA manifest
│   ├── sw.js                  Hand-crafted service worker
│   └── sounds/beep.mp3        Soft chime
│
└── src/
    ├── main.jsx               React entry — provider chain
    ├── App.jsx                Top-level composition
    ├── IslamicGeometryEngine.jsx
    │
    ├── lib/                   Pure utilities (no React)
    │   ├── constants.js       PRAYERS, METHODS, HADITHS, env config
    │   ├── prayerCalc.js      adhan-js wrapper: calcTimes, calcQibla
    │   ├── hijri.js           Gregorian → Islamic calendar
    │   ├── formatters.js      fmt12, addMins, fmtCountdown, compass
    │   ├── themes.js          6 themes + buildThemeVars
    │   ├── audio.js           primeAudio, playBeep, isAudioUnlocked
    │   └── weather.js         wmoEmoji, wmoText (Open-Meteo WMO codes)
    │
    ├── hooks/                 Custom React hooks
    │   ├── useCityTime.js     1-sec tick + city-tz extraction
    │   ├── usePrayerTimes.js  Prayer time derivations
    │   ├── useWeather.js      Open-Meteo fetch + 10-min refresh
    │   ├── useAudioUnlock.js  Silent first-gesture audio primer
    │   ├── useChime.js        Adhan/iqamah beep firing (split flags)
    │   ├── useLunarPhase.js   Moon phase from Hijri day
    │   └── useBlackoutMode.js Blackout window derivation
    │
    ├── context/
    │   └── SettingsContext.jsx   Applied/draft state + legacy migration
    │
    ├── i18n/                  Internationalization
    │   ├── I18nContext.jsx    Provider + useT() + fmtStr + RTL handling
    │   ├── en.json            English dictionary
    │   ├── ar.json            Arabic dictionary (RTL)
    │   └── ur.json            Urdu dictionary (RTL)
    │
    ├── components/
    │   ├── Header.jsx
    │   ├── Footer.jsx                 Status strip
    │   ├── Clock.jsx                  Centre column
    │   ├── PrayerList.jsx
    │   ├── PrayerCard.jsx
    │   ├── PrayerIcons.jsx            SVG icon per prayer
    │   ├── ProgressVisual.jsx         5 styles
    │   ├── QiblaCompass.jsx
    │   ├── MosqueIcon.jsx
    │   ├── Ticker.jsx                 Announcement marquee
    │   ├── BlackoutOverlay.jsx        Salah-time overlay
    │   ├── PinOverlay.jsx
    │   ├── widgets/
    │   │   ├── WeatherCard.jsx
    │   │   ├── SunDayCycle.jsx
    │   │   └── FastQiblaCard.jsx
    │   └── settings/
    │       └── SettingsPanel.jsx      Tabbed editor
    │
    └── styles/                Bundled CSS (Vite-imported)
        ├── index.css          Barrel
        ├── base.css           Fonts, reset, animations
        ├── layout.css         Main grid, corners, header
        ├── prayer-cards.css   Prayer rows + Jumu'ah/Eid + icons
        ├── clock.css          Centre column
        ├── widgets.css        Bottom band
        ├── ticker.css         Announcement marquee
        ├── settings.css       Settings panel + tabs + data footer
        ├── blackout.css       Salah overlay
        └── responsive.css     Breakpoints
```

### How the data flows

Every clock-driven value pivots around a single source of truth: **the city's wall-clock**, computed via `Intl.DateTimeFormat` with the city's IANA timezone. A server in London powering a Karachi mosque dashboard shows Karachi time — every prayer time, every countdown, every Hijri date is computed against the configured city.

- **`useCityTime`** ticks every second, exposes `now` (real instant) + `cityNow` (city-time anchored Date) + `cityNowParts` (h/m/s extracted in city tz) + `isFriday`.
- **`usePrayerTimes`** consumes that anchor + location + method, returns today/tomorrow/yesterday times plus `active`/`next` prayer and elapsed % of the current window. Handles the pre-Fajr edge case where "active" is still yesterday's Isha.
- **App.jsx** overlays Jumu'ah substitution on Fridays (replaces Dhuhr in next-prayer display) and computes effective iqamah offsets when smart auto-mode is on.

### Settings — applied vs drafts

The Settings panel edits values without mutating the live dashboard. `SettingsContext` keeps both:

- **`applied`** — currently in effect; drives the render; persists to `localStorage` on every change.
- **`drafts`** — what the Settings panel mutates; commits to `applied` only on "Apply"; discarded on "Cancel".

Direct updates (geolocation, city-search click) bypass drafts via `updateApplied()` since they're one-shot decisions.

Legacy keys are migrated transparently on load. Example: a pre-split `chimeEnabled` value is mapped to both new `chimeAdhan` + `chimeIqamah` flags so existing users don't lose their preference.

### Prayer time calculation

`lib/prayerCalc.js` wraps **adhan-js** (a small, well-tested astronomical library) and exposes:

```js
calcTimes(date, lat, lng, method, asrShadow, cityTz, highLatRule)
   → { fajr, sunrise, dhuhr, asr, maghrib, isha }   // all Date objects
calcQibla(lat, lng)
   → degrees from north (0..360)
tzOffsetHours(date, tzName)
   → offset in hours for IANA tz at given date
```

Six calculation methods supported:

| Method | Fajr | Isha |
|---|---|---|
| Muslim World League | 18° | 17° |
| ISNA – North America | 15° | 15° |
| Egyptian Authority | 19.5° | 17.5° |
| Umm al-Qura (Makkah) | 18.5° | Maghrib + 90 min |
| University of Karachi | 18° | 18° |
| MUIS Singapore | 20° | 18° |

Plus 3 high-latitude rules (Middle of Night / Seventh of Night / Angle-Based) for locations above ~48° where the sun doesn't dip far enough in summer.

Cross-validated against published values for Oakville · NYC · London · Karachi · Jakarta · Riyadh — within ±1 minute.

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
#  → also on 0.0.0.0:5173 for LAN access (TV/Fire Stick testing)

# 4. Production build
npm run build       # → dist/

# 5. Preview build locally
npm run preview
```

Requires **Node 20+**.

---

## Configuration

All settings persist to `localStorage` (key: `masjid_dashboard_v1`) and survive page reloads. Edit them via the in-app **⚙ Settings** panel (footer-left button). Five tabs:

| Tab | Settings |
|---|---|
| **Display** | Language (en/ar/ur) · Theme · Display Size · Progress Style |
| **Location** | City search · Masjid name · Always-visible current/pending location card |
| **Prayer Times** | Calculation Method · High-Latitude Rule · Hijri Adjustment · Asr Method |
| **Iqamah** | Auto-iqamah toggle + per-prayer buffers OR manual offsets · Jumu'ah slots · Eid slots |
| **Behaviour** | Announcements · Blackout mode (toggle + opacity + durations) · Prayer beep (adhan + iqamah toggles) |

A persistent footer below all tabs holds **⬇ Export · ⬆ Import · ↺ Reset**:
- **Export** downloads `prayer-times-settings-YYYY-MM-DD.json` containing the full applied state.
- **Import** reads a JSON file into drafts (user clicks Apply to commit, Cancel to discard).
- **Reset** wipes drafts to factory defaults with 2-click confirmation.

### Environment variables

Set in `.env` (copy from `.env.example`):

| Variable | Default | Effect |
|---|---|---|
| `VITE_SETTINGS_PIN` | `""` (unset) | If set, requires PIN entry before settings open. Good for public kiosks. |
| `VITE_SHOW_TEST_BUTTONS` | `true` | Set to `false` to hide Test Jumu'ah / Test Pattern / Test Blackout buttons in production. |

Baked in at build time (Vite convention). Edit `.env` and rebuild to change.

---

## Internationalization

Three languages currently ship: **English · Arabic · Urdu**. Switching the language in Settings:

- Instantly retranslates the entire UI via `useT()` hook
- Flips `<html dir="rtl">` for Arabic/Urdu — layout mirrors automatically
- Swaps prayer name pair: English UI shows English primary + Arabic secondary; Arabic UI shows Arabic primary; Urdu UI shows Urdu primary + Arabic secondary
- Decorative Arabic calligraphy (`مواقيت الصلاة` header, `بِسْمِ اللَّهِ...` blackout invocation, Hadith) stays in Arabic regardless — these are signature elements, not translations

Adding a new language: drop `xx.json` in `src/i18n/`, register it in `I18nContext.jsx`, optionally add to `RTL_LANGS` set if right-to-left.

---

## Deployment

### Static hosting (GitHub Pages, Netlify, Vercel, S3, etc)

```bash
npm run build
```

Upload `dist/` to any static host. Single-page app — no server-side logic.

For **GitHub Pages** specifically, set `VITE_BASE_URL` to the repo subpath:
```bash
VITE_BASE_URL=/prayer-times-tv/ npm run build
```

A workflow at `.github/workflows/deploy.yml` is included for auto-deploy to GitHub Pages on push.

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
| **vite-plugin-pwa** | Service worker + manifest |
| **adhan** | Prayer time astronomical calculations |

Hijri conversion, Qibla calculation, themes, audio, weather codes, timezone math, and the i18n system are all **plain JavaScript** in `src/lib/` and `src/i18n/`. No `moment`, no `date-fns`, no UI library, no icon library — every line is inspectable.

---

## Security

- **Strict Content Security Policy** in `index.html` — blocks XSS, clickjacking, plugin injection. Only same-origin scripts + Google Fonts.
- **No backend** — settings stay in `localStorage`, prayer times computed locally.
- **Two outbound calls**, both to Open-Meteo (no API key, no auth, no tracking):
  - `geocoding-api.open-meteo.com/v1/search` — city search (only when user types in panel)
  - `api.open-meteo.com/v1/forecast` — weather (on load + every 10 min, hidden if it fails)
- **Service worker** caches same-origin assets + Google Fonts. Dashboard works fully offline once cached.

---

## License

MIT. Free for mosque, community, school, and personal use.

---

*"الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ — Prayer is better than sleep."*

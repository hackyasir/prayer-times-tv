// Built-ins missing from older TV browsers — before anything else runs.
import './lib/polyfills.js';
// Opt-in performance overlay (?perf in the URL). Imported early so it can
// count date formatters created anywhere in the app.
import './lib/perfMonitor.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { I18nProvider } from './i18n/I18nContext.jsx';

// All stylesheets imported once at app entry. Vite resolves the chain via
// the @imports in styles/index.css. Theme CSS variables are still injected
// dynamically at runtime by App.jsx (they change when the user switches
// themes), but every static rule lives in src/styles/*.css.
import './styles/index.css';

// Self-hosted fonts (Fontsource). Bundled with the app so the service worker
// precaches them and the display keeps its typography offline. One file per
// weight: each declares its subsets with `unicode-range`, so the browser
// downloads only the subsets the text on screen needs. (Importing single
// subsets, as before, dropped `unicode-range` — the browser then fetched the
// latin-ext files for plain English text too.) The service worker precaches
// the Latin and Arabic subsets; any other subset is cached the first time
// it's used (see src/sw.js and vite.config.js).
//   Amiri             — Arabic display text (400, 700)
//   Noto Naskh Arabic — Arabic/Urdu body text (400, 700)
//   Rajdhani          — Latin UI text (300, 400, 600, 700)
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/700.css';
import '@fontsource/rajdhani/300.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';

// Provider chain (outermost → innermost):
//   1. SettingsProvider — applied + draft settings, persists to localStorage
//   2. I18nProvider     — translation strings, reads applied.lang from settings
//   3. App              — the dashboard
//
// I18nProvider sits INSIDE SettingsProvider because it reads applied.lang
// to pick the active dictionary. This way, changing language in Settings
// instantly retranslates the entire UI without a page reload.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

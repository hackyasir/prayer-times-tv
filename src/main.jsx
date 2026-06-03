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

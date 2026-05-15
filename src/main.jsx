import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';

// All stylesheets imported once at app entry. Vite resolves the chain via
// the @imports in styles/index.css. Theme CSS variables are still injected
// dynamically at runtime by App.jsx (they change when the user switches
// themes), but every static rule lives in src/styles/*.css.
import './styles/index.css';

// Settings (location, theme, calc method, etc) are managed via React Context.
// Provider wraps the whole app so any descendant component can pull settings
// via useSettings() — and the Settings panel can mutate drafts that commit
// on Apply. See src/context/SettingsContext.jsx for the full API.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);

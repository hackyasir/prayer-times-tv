// ── i18n Context ─────────────────────────────────────────────────────────────
//
// Lightweight, dependency-free translation system. Holds a flat string map
// keyed by language code (`en`, `ar`, `ur`) and looks up keys at render time.
//
// Why hand-rolled, not react-i18next?
//   - Total surface needed: ~70 keys, no plurals, no namespaces, no lazy loading
//   - Zero deps; 30 lines does what we need
//   - Falls through to English if a translation is missing, never crashes
//   - Trivial for native speakers to PR a new language: add one JSON file
//
// API:
//   const { t, lang, isRTL } = useT();
//   <h1>{t('next.label')}</h1>
//
// The `lang` value here is sourced from SettingsContext.applied.lang, so
// changing language in Settings instantly retranslates the whole UI.

import { createContext, useContext, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import en from './en.json';
import ar from './ar.json';
import ur from './ur.json';

// Bundle of all supported languages. To add a new one:
//   1. Drop YOUR-CODE.json in this folder
//   2. Import it above
//   3. Add the entry below
//   4. (If the language is RTL, add its code to RTL_LANGS)
const DICTS = { en, ar, ur };

// Languages that read right-to-left. CSS will set `dir="rtl"` on <html>
// when one of these is active, flipping the entire layout horizontally.
const RTL_LANGS = new Set(['ar', 'ur']);

// Friendly display names for the language dropdown in Settings.
// Each language self-names — Arabic shows "العربية", not "Arabic".
export const LANGUAGE_LABELS = {
  en: 'English',
  ar: 'العربية',
  ur: 'اردو',
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { applied } = useSettings();
  const lang = applied.lang || 'en';
  const isRTL = RTL_LANGS.has(lang);

  // Set the html dir attribute so CSS direction-aware properties
  // (margin-inline-start, text-align: start, etc) work correctly.
  // Also set lang for accessibility / screen readers.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [lang, isRTL]);

  // Lookup function. Falls through to English if the key is missing in the
  // current language, then to the raw key itself if missing everywhere.
  // This means a translator can ship a partial dictionary safely.
  const t = useMemo(() => {
    const dict = DICTS[lang] || DICTS.en;
    const fallback = DICTS.en;
    return (key) => dict[key] ?? fallback[key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({ t, lang, isRTL }), [t, lang, isRTL]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook for translation. Returns `{ t, lang, isRTL, fmt }`.
 *   - `t(key)` looks up a string by key in the current language
 *   - `lang` is the current language code ('en' | 'ar' | 'ur')
 *   - `isRTL` is true when the current language reads right-to-left
 *   - `fmt(str, vars)` interpolates {placeholder} tokens — use with t():
 *       `fmt(t('label.until'), { prayer: 'Asr', time: '4:30 PM' })`
 *
 * Throws if used outside <I18nProvider> (programmer error → fail loud).
 */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT() called outside <I18nProvider>');
  return ctx;
}

// Standalone format helper. Substitutes {placeholder} tokens in a string with
// values from the `vars` object. Used heavily with the t() function to build
// translated strings that include dynamic values (prayer names, times, counts).
//   fmt('Until {prayer} · {time}', { prayer: 'Asr', time: '4:30 PM' })
//   → 'Until Asr · 4:30 PM'
// Exported separately so non-React code (rare) can use it too.
export function fmtStr(str, vars) {
  return Object.entries(vars || {}).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    str
  );
}

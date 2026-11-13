import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { cssMathFallback } from './src/lib/cssMathFallback.js';

// The page's Content-Security-Policy (index.html) only allows requests to
// the weather services. When the shared-settings source is on
// (VITE_SETTINGS_SOURCE, see docs/remote-settings.md), also allow its
// address: Google Sheets, or the Cloudflare Worker (https + wss).
//
// With Google Sheets, admins of self-serve masjids turn their publish
// passphrase into the masjid's key with Argon2id, which runs as
// WebAssembly; browsers refuse to run WebAssembly unless the policy allows
// it. 'wasm-unsafe-eval' allows WebAssembly only — never JavaScript eval —
// and only from this site's own files (script-src stays 'self'). Browsers
// too old to know it ignore it; they never run the passphrase step anyway.
function settingsSourceCsp() {
  let env = {};
  return {
    name: 'settings-source-csp',
    configResolved(config) {
      env = config.env || {};
    },
    transformIndexHtml(html) {
      const source = String(env.VITE_SETTINGS_SOURCE || '').toLowerCase();
      const connect = [];
      if (source === 'sheet')
        connect.push('https://docs.google.com', 'https://*.googleusercontent.com');
      if (source === 'cloudflare' && env.VITE_SETTINGS_API_URL) {
        try {
          const { origin } = new URL(env.VITE_SETTINGS_API_URL);
          connect.push(origin, origin.replace(/^http/, 'ws'));
        } catch {
          // not a URL: nothing added, the app shows the source as unreachable
        }
      }
      // Only inside the policy tag (a comment above it mentions the directives too).
      let out = html;
      if (connect.length) {
        out = out.replace(
          /(Content-Security-Policy"[\s\S]*?connect-src[^;]*)/,
          `$1 ${connect.join(' ')}`
        );
      }
      if (source === 'sheet') {
        out = out.replace(
          /(Content-Security-Policy"[\s\S]*?script-src[^;]*)/,
          `$1 'wasm-unsafe-eval'`
        );
      }
      return out;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // For GitHub Pages: set VITE_BASE_URL env var in CI, default '/' for local dev
  base: process.env.VITE_BASE_URL ?? '/',

  plugins: [
    react(),
    settingsSourceCsp(),

    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Our own service worker source (src/sw.js), bundled by the plugin
      // with the precache manifest injected.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Files to precache for offline use. (With injectManifest the
      // `workbox` option is ignored — this is the setting that applies.)
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,mp3,woff2,webmanifest}'],
        // Font subsets the display doesn't normally show (accented Latin,
        // Devanagari, maths, symbols) aren't precached; the service worker
        // caches any of them the first time a screen needs it.
        globIgnores: ['**/*-latin-ext-*', '**/*-devanagari-*', '**/*-math-*', '**/*-symbols-*'],
      },

      // The only web app manifest — the plugin writes manifest.webmanifest
      // and links it from index.html. start_url and scope come from `base`.
      // Icon paths are relative so they resolve under the base path too.
      manifest: {
        name: 'Prayer Times — Digital Masjid Display',
        short_name: 'Prayer Times',
        description:
          'High-visibility prayer times dashboard for Smart TVs, Fire Sticks, and large displays. Works offline.',
        lang: 'en',
        dir: 'ltr',
        categories: ['lifestyle', 'utilities'],
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],

  // Older TV browsers lack clamp() / min() / max(); give those rules a plain
  // fallback (see src/lib/cssMathFallback.js).
  css: {
    postcss: { plugins: [cssMathFallback()] },
  },

  build: {
    // Chromium 63 = Samsung's 2019 TVs (Tizen 5.0). LG's 2020 TVs are
    // Chromium 68. The old target (es2020) kept `?.` and `??`, which need
    // Chromium 80, so Samsung TVs up to 2021 and LG up to 2021 failed to
    // load the app at all. esbuild rewrites that syntax; it also lowers
    // CSS such as `inset`.
    target: 'chrome63',
    outDir: 'dist',
    // Chunk splitting: vendor libs separate from app code so React + adhan
    // stay cached between deploys. A function, because `react-dom/client`
    // (most of React) is a separate entry the old list form didn't catch.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/node_modules[\\/]adhan[\\/]/.test(id)) return 'adhan';
          return undefined;
        },
      },
    },
  },

  server: {
    port: 5173,
    // This computer only. To try the display on a TV or Fire Stick on the
    // same network, run `npm run dev:lan` (anyone on that network can then
    // open it, with your .env.local values built in).
  },
});

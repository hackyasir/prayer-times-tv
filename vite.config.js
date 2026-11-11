import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { cssMathFallback } from './src/lib/cssMathFallback.js';

// https://vitejs.dev/config/
export default defineConfig({
  // For GitHub Pages: set VITE_BASE_URL env var in CI, default '/' for local dev
  base: process.env.VITE_BASE_URL ?? '/',

  plugins: [
    react(),

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
    // Useful for testing on TV/Fire Stick on same LAN
    host: '0.0.0.0',
  },
});

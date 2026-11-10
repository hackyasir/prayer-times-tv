import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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

  build: {
    target: 'es2020',
    outDir: 'dist',
    // Chunk splitting: vendor libs separate from app code so React + adhan
    // can be cached independently of our app code between deploys
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          adhan: ['adhan'],
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

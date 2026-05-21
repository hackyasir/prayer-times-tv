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

      // Use our hand-crafted service worker (src/sw.js)
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',

      manifest: {
        name: 'Prayer Times — Digital Masjid Display',
        short_name: 'Prayer Times',
        description: 'Offline-first prayer times dashboard for Smart TVs',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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

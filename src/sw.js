/**
 * src/sw.js — service worker for offline operation.
 *
 * Built by vite-plugin-pwa (strategies: 'injectManifest'; see vite.config.js)
 * and registered automatically via the generated registerSW.js.
 *
 * At build time `self.__WB_MANIFEST` is replaced with every file in dist/
 * that matches `injectManifest.globPatterns`, each with a revision hash.
 * Those entries are relative to this file, and Workbox resolves them
 * against the worker's own URL — so the same build works at a domain root
 * or under a sub-path such as /prayer-times-tv/ on GitHub Pages.
 *
 * Everything the display needs is precached: app code, styles, fonts,
 * icons, the beep sound and the print ornament. Weather and city search
 * are cross-origin and go straight to the network (both fail gracefully).
 */

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

// Activate a new build straight away (registerType: 'autoUpdate').
self.skipWaiting();
clientsClaim();

// Serve precached files cache-first; a new build replaces only the files
// whose revision changed and deletes the rest.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Any page navigation (the start URL, a reload, a deep link) gets the
// cached app shell, so the display also loads with the network unplugged.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Caches left behind by the earlier hand-written worker.
const LEGACY_CACHES = ['prayer-times-v1', 'prayer-times-fonts-v1'];
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(LEGACY_CACHES.map((name) => caches.delete(name))));
});

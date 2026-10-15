const CACHE_NAME = 'tracker-pwa-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './food-api.js', './stealth.js', './cloud-sync.js'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

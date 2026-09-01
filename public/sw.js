// Service Worker for MIJ ERP PWA
const CACHE_NAME = 'mij-erp-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through fetch requests online
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

const CACHE = 'gestor-mobile-__BUILD_ID__';
const SHELL = ['/', '/index.html', '/app.js', '/app.css', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));});
self.addEventListener('message', event => {if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gestor-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(shell => shell || fetch(event.request)));
    return;
  }
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});

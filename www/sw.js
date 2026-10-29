// Offline-first service worker for the hosted/PWA build (the Android APK bundles files directly).
const CACHE = 'shelfstock-v3';
const CORE = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/main.js', 'js/store.js', 'js/router.js', 'js/data/foods.js', 'js/data/recipes.js', 'js/data/holidays.js', 'js/data/layout.js',
  'js/ui/dom.js', 'js/ui/itemSheet.js', 'js/ui/label.js', 'js/ui/tour.js', 'js/ui/help.js', 'vendor/zxing.min.js', 'js/services/off.js', 'js/services/mealdb.js', 'js/services/sync.js', 'js/services/people.js', 'js/services/vision.js', 'js/services/live.js', 'js/services/stores.js',
  'js/ui/login.js', 'js/ui/loader.js', 'js/ui/seasons.js', 'js/ui/house.js', 'icons/icon-512.png',
  'js/views/kitchen.js', 'js/views/stock.js', 'js/views/recipes.js', 'js/views/plan.js', 'js/views/list.js', 'js/views/settings.js',
  'fonts/fraunces-latin-400-normal.woff2', 'fonts/fraunces-latin-600-normal.woff2', 'fonts/fraunces-latin-700-normal.woff2',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // stale-while-revalidate for app files
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  } else if (/openfoodfacts|themealdb/.test(url.hostname) && /\.(jpg|jpeg|png|webp)$/i.test(url.pathname)) {
    // cache product & recipe photos so they show offline
    e.respondWith(caches.open(CACHE + '-img').then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
  }
});

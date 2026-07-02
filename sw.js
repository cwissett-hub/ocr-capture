const CACHE = 'serial-scanner-v19';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/serial.js', './js/vote.js', './js/store.js',
  './js/ocr.js', './js/camera.js', './js/zoom.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './vendor/tesseract/tesseract.min.js', './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core-simd.wasm.js',
  './vendor/tesseract/tesseract-core-simd.wasm',
  './vendor/tesseract/eng.traineddata.gz',
  './vendor/fonts/space-grotesk-400.woff2', './vendor/fonts/space-grotesk-500.woff2',
  './vendor/fonts/space-grotesk-700.woff2', './vendor/fonts/jetbrains-mono-500.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Big, static vendored assets: cache-first (fast + offline; they never change).
  if (url.pathname.includes('/vendor/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
    return;
  }
  // App shell (html/css/js/manifest/icons): network-first so a new deploy lands
  // immediately when online; fall back to cache when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

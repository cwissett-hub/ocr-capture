const CACHE = 'serial-scanner-v1';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/serial.js', './js/vote.js', './js/store.js',
  './js/ocr.js', './js/camera.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './vendor/tesseract/tesseract.min.js', './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core-simd.wasm.js',
  './vendor/tesseract/tesseract-core-simd.wasm',
  './vendor/tesseract/eng.traineddata.gz',
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
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

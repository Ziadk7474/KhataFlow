// KhataFlow service worker. Bump VERSION on every release so users get the update.
const VERSION = 'khataflow-v5';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png',
  'icon-maskable-192.png', 'icon-maskable-512.png',
  'apple-touch-icon.png', 'favicon.svg', 'favicon-32.png', 'favicon-16.png'
];
// Static third-party files the app needs: fonts, Firebase SDK scripts, html2canvas, jsPDF.
// Firebase database/auth traffic (firebasedatabase.app, identitytoolkit) is NOT listed, so it is never cached.
const CDN = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com|cdnjs\.cloudflare\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !CDN.test(url.host)) return; // never touch other APIs

  // Page loads: network first, fall back to cached app shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); return r; })
        .catch(() => caches.match('index.html').then(m => m || caches.match('./')))
    );
    return;
  }

  // Everything else: cached copy instantly, refresh it in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req)
        .then(r => {
          if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
          return r;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});

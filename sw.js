/* KhataFlow service worker: offline-first app shell + Firebase SDK + fonts */
const VERSION = 'kf-v8';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './favicon.svg', './favicon-16.png', './favicon-32.png', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'];
/* the app cannot start without these two files, so keep them on the phone */
const SDK = ['https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js'];
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

const keep = (c, url) => fetch(url, { mode: 'cors' }).catch(() => fetch(url, { mode: 'no-cors' }))
  .then(r => (r && (r.ok || r.type === 'opaque')) ? c.put(url, r) : null).catch(() => null);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).then(() => Promise.all(SDK.map(u => keep(c, u))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r) }, e => { clearTimeout(t); no(e) }) });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* Firebase SDK + Google fonts: cache first (versioned URLs never change) */
  if (CDN.test(req.url)) {
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req.url, copy)); }
      return r;
    })));
    return;
  }
  if (url.origin !== location.origin) return; /* database traffic goes straight to the network */
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) {
    /* network first so updates arrive, but give up after 3.5s on a weak signal and open from the phone */
    const net = fetch(req).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); } return r; });
    e.respondWith(timeout(net, 3500).catch(() => caches.match('./index.html').then(r => r || caches.match('./')).then(r => r || net)));
    return;
  }
  /* static files: cache first, refresh in background */
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});

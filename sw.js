// Naukagry service worker: works offline, always tries the network first for the app itself.
const CACHE = 'naukagry-2.9';
const ASSETS = ['./', './index.html', './skarbonka.js', './manifest.webmanifest',
  './games/klocki.js', './games/ogrodek.js', './games/jezyk.js', './games/akwarium.js',
  './games/trojki.js', './games/latawiec.js', './games/rury.js',
  './ng-core.js', './games/memo.js', './games/banki.js', './games/wedkarz.js', './games/pianinko.js', './games/obrazki.js',
  './games/sudoku.js', './games/kolorowanka.js', './games/pokoik.js', './games/zwierzak.js', './games/restauracje.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('naukagry-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith('/naukagry/')) {
    // network first (bypassing the HTTP cache so a deploy never mixes old and new files),
    // but after 3 s on a weak connection serve the cached copy; good responses refresh the cache
    const net = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    const cached = () => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(cached);
    e.respondWith(Promise.race([net.catch(() => null), slow]).then(r => r || cached()).then(r => r || net));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});

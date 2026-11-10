/* ==========================================================================
   sw.js — makes the website work as an app (and open without internet).
   Must stay in the main folder, next to index.html.

   • Pages, code and data: always fetched fresh when online, so new
     donations show at once; the saved copy is used only when offline.
   • Photos and fonts: shown from the saved copy, refreshed in the background.
   • GitHub (admin publishing) and videos are never touched.
   ========================================================================== */

const CACHE = 'chhath-app-v1';
const CORE = [
  './', 'index.html', 'donation.html', 'admin.html',
  'css/style.css', 'js/main.js', 'js/share.js', 'js/pwa.js',
  'images/icons/icon-192.png', 'images/hero-ghat.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    // Add one by one, so a missing file does not stop the app from installing
    return Promise.all(CORE.map(function (url) { return cache.add(url).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      // Offline and not saved: open the home page for page visits only
      if (request.mode === 'navigate') return caches.match('index.html');
      return new Response('', { status: 503, statusText: 'Offline' });
    });
  });
}

function savedThenRefresh(request) {
  return caches.match(request).then(function (hit) {
    const fresh = fetch(request).then(function (response) {
      if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return hit; });
    return hit || fresh;
  });
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Fonts from Google: saved copy is fine
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(savedThenRefresh(request));
    return;
  }
  // Everything else outside this website (GitHub API, WhatsApp, Facebook, CDN): leave alone
  if (url.origin !== self.location.origin) return;
  // Videos stream in parts: leave alone
  if (url.pathname.indexOf('/videos/') !== -1 || request.headers.has('range')) return;

  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(savedThenRefresh(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

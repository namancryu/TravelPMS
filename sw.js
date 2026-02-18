const CACHE_NAME = 'travel-pms-v5';
const ASSETS = ['/index.html', '/manifest.json', '/assets/styles/custom.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  // 네트워크 우선, 실패 시 캐시 폴백
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

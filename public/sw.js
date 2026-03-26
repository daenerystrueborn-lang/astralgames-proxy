/* ═══════════════════════════════════════════════
   ✦ Astral of the Sun PWA — Service Worker
   Handles install, cache, offline fallback
═══════════════════════════════════════════════ */

const CACHE_NAME = 'astral-v9'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/catalog.js',
  '/icons.js',
  '/manifest.json',
  '/images/default-banner.png',
  '/images/default-pfp.png',
  '/images/loading-bg.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

/* ── Install: cache all static assets ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll fails silently for missing optional assets
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      )
    })
  )
  self.skipWaiting()
})

/* ── Activate: clear old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

/* ── Fetch: cache-first for static, network-first for API ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // API calls — always try network, fallback to cache (GET only — POST/PUT/DELETE can't be cached)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (e.request.method === 'GET') {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => e.request.method === 'GET' ? caches.match(e.request) : Promise.reject())
    )
    return
  }

  // Static assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        return res
      }).catch(() => caches.match('/index.html'))
    })
  )
})

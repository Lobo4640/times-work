// Times Work · Service Worker v1.0
const CACHE_NAME = 'times-work-v1'
const STATIC_ASSETS = [
  '/',
  '/clock',
  '/history',
  '/profile',
  '/manifest.json',
  '/icon.png',
]

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch (network-first for API, cache-first for assets) ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Supabase API → always network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => new Response('offline', { status: 503 })))
    return
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }).catch(() => caches.match('/') || new Response('offline'))
    })
  )
})

// ── Push Notifications ──
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'Times Work',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'times-work',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Ver jornada' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
    data: { url: '/clock' },
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Times Work', options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const url = event.notification.data?.url || '/clock'
      const existing = windowClients.find(c => c.url.includes(url))
      if (existing) { existing.focus(); return }
      return clients.openWindow(url)
    })
  )
})

// ── Background Sync for offline logs ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-time-logs') {
    event.waitUntil(syncPendingLogs())
  }
})

async function syncPendingLogs() {
  // When back online, this will be triggered to sync any offline logs
  // Implementation depends on IndexedDB queue setup in the app
  console.log('[SW] Syncing pending time logs...')
}

// ── Message handler (from app for scheduled notifications) ──
self.addEventListener('message', event => {
  const { type, payload } = event.data || {}

  if (type === 'SCHEDULE_NOTIFICATION') {
    const { delay, title, body, tag } = payload
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [300, 100, 300],
        tag,
        requireInteraction: true,
      })
    }, delay)
  }

  if (type === 'CANCEL_NOTIFICATIONS') {
    self.registration.getNotifications().then(notifications => {
      notifications.forEach(n => n.close())
    })
  }
})

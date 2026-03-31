// Times Work · Service Worker v1.1
const CACHE_NAME = 'times-work-v1.1'; // Incrementamos versión
const STATIC_ASSETS = [
  '/',
  '/profile',
  '/clock',
  '/history',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.png'
];

// ── Install: Cacheamos lo esencial ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos addAll pero con catch para evitar que un recurso falte y rompa todo
      return cache.addAll(STATIC_ASSETS).catch(err => console.warn('Falta algún recurso en el caché:', err));
    })
  );
  self.skipWaiting();
});

// ── Activate: Limpiamos cachés antiguos ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Estrategia inteligente ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignorar peticiones de Supabase (Siempre red)
  if (url.hostname.includes('supabase.co')) {
    return; 
  }

  // 2. Estrategia para assets estáticos y navegación
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Si está en caché, lo devolvemos, pero intentamos actualizarlo de fondo (Stale-while-revalidate)
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const cacheClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheClone));
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red y no hay caché, mandamos a la home
        if (event.request.mode === 'navigate') return caches.match('/');
      });

      return cached || fetchPromise;
    })
  );
});

// ── Notificaciones Push ──
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Recordatorio de jornada',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'times-work-alert',
    data: { url: data.url || '/clock' },
    actions: [
      { action: 'open', title: 'Abrir App' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Times Work', options)
  );
});

// ── Click en Notificación ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = event.notification.data?.url || '/clock';
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Background Sync ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-time-logs') {
    console.log('[SW] Sincronizando registros pendientes...');
    // Aquí iría la lógica de recuperar de IndexedDB y enviar a Supabase
  }
});

// ====== SERVICE WORKER — Mundial 2026 ======
var CACHE_NAME = 'mundial2026-v1';
var CACHE_STATIC = 'mundial2026-static-v1';

// Archivos que siempre van al caché (funcionan offline)
var STATIC_FILES = [
  '/mundial2026.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;900&display=swap'
];

// ====== INSTALL: cachear archivos estáticos ======
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(function(cache) {
      return cache.addAll(STATIC_FILES).catch(function(err) {
        console.log('Cache install parcial:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ====== ACTIVATE: limpiar cachés viejos ======
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_STATIC && key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ====== FETCH: estrategia inteligente por tipo de recurso ======
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API de wc2026api y Anthropic → SIEMPRE red (datos en vivo, nunca cachear)
  if (url.includes('api.wc2026api.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('corsproxy.io') ||
      url.includes('allorigins.win')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Fuentes de Google → caché primero, luego red
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          return caches.open(CACHE_STATIC).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // HTML principal → Network First (siempre intentar la versión más nueva)
  // Si no hay red, usar la versión cacheada
  if (url.includes('mundial2026.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Actualizar caché con la versión nueva
          var responseClone = response.clone();
          caches.open(CACHE_STATIC).then(function(cache) {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(function() {
          // Sin red → usar caché
          return caches.match(event.request).then(function(cached) {
            return cached || new Response(
              '<html><body style="background:#0a0a0a;color:#f5c518;font-family:sans-serif;text-align:center;padding:3rem">' +
              '<h1>⚽ Mundial 2026</h1>' +
              '<p style="color:#888">Sin conexión a internet.<br>Conectate para ver el contenido.</p>' +
              '</body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
    return;
  }

  // Todo lo demás → caché primero
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request);
    })
  );
});

// ====== BACKGROUND SYNC: notificar cuando hay partido de Argentina ======
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================
// Service Worker — //kent.dev PWA + Offline
// ============================================
var CACHE_NAME = "kent-dev-v2";
var CORE_ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/theme.js",
  "/vendor/bootstrap/css/bootstrap.min.css",
  "/vendor/bootstrap/js/bootstrap.bundle.min.js",
  "/vendor/typed/typed.min.js",
  "/vendor/font-awesome/css/all.min.css",
  "/images/profile.png",
  "/favicon.svg"
];

// Install — cache core assets
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first for assets, network-first for pages
self.addEventListener("fetch", function (e) {
  // Skip non-GET and external requests
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.includes("cdn.jsdelivr.net")) return;

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (response) {
        // Cache successful responses
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function () {
        // Offline fallback
        if (e.request.destination === "document") {
          return caches.match("/index.html");
        }
      });
    })
  );
});

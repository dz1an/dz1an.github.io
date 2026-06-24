// ============================================
// Service Worker — //kent.dev PWA + Offline
// ============================================
var CACHE_NAME = "kent-dev-v10";
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

// Fetch — network-first for HTML/JS/CSS (so code updates reach users immediately,
// no more "I pushed but visitors see old code"); cache-first for static assets
// (images, fonts, vendor libs). Offline always falls back to cache.
self.addEventListener("fetch", function (e) {
  // Skip non-GET and external requests
  if (e.request.method !== "GET") return;
  var url = e.request.url;
  if (!url.startsWith(self.location.origin) && !url.includes("cdn.jsdelivr.net")) return;

  var dest = e.request.destination;
  var networkFirst = dest === "document" || dest === "script" || dest === "style";

  function cachePut(response) {
    if (response && response.ok) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
    }
    return response;
  }

  if (networkFirst) {
    // Always try the network first; fall back to cache only when offline.
    e.respondWith(
      fetch(e.request).then(cachePut).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || (dest === "document" ? caches.match("/index.html") : undefined);
        });
      })
    );
    return;
  }

  // Cache-first for everything else (immutable static assets).
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(cachePut).catch(function () {
        if (dest === "document") return caches.match("/index.html");
      });
    })
  );
});

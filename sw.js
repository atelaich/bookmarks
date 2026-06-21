/* ============================================================
   My Bookmarks — Service Worker
   ------------------------------------------------------------
   Caches the app shell so it loads instantly and works offline.
   Strategy:
     - App shell (HTML, manifest, icons): cache-first, with a
       background refresh so updates are picked up next launch.
     - Everything else (GitHub API sync, external favicons):
       network-only — never cached, so sync is always live.
   Bump CACHE_VERSION whenever you deploy a new index.html so old
   files are cleared.
   ============================================================ */
const CACHE_VERSION = "v1";
const CACHE_NAME = "my-bookmarks-" + CACHE_VERSION;

// Same-origin files that make up the installable app shell.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll fails if any file is missing; add individually and
      // ignore failures so a missing optional icon won't break install.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET requests. Let sync (api.github.com),
  // favicons and everything cross-origin go straight to the network.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      // Cache-first; refresh the cached copy in the background.
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // offline: fall back to cache

      return cached || network;
    })
  );
});

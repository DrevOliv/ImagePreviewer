// Minimal service worker so the site is installable as a PWA.
//
// Strategy is deliberately conservative: we only cache the static app shell
// (CSS / JS / icons under /static/) so the app opens quickly and survives a
// flaky connection. Auth pages, the API and the actual photos/videos are
// always fetched from the network so nothing stale or unauthorised is served
// from the cache.

const CACHE = "filvisare-shell-v4";
const SHELL = [
  "/static/css/style.css",
  "/static/js/app.js",
  "/static/icon.png",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only the static shell is cache-eligible; everything else goes to the
  // network untouched so auth and media stay live.
  const isShell = url.origin === self.location.origin && url.pathname.startsWith("/static/");
  if (!isShell) return;

  // Network-first: fresh assets when online, cached copy when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

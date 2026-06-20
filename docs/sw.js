const CACHE = "roulette-v2";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.mode === "navigate") {
    // Network-first for the HTML page — picks up updates when online, falls back to cache offline
    e.respondWith(
      fetch(e.request)
        .then(r => {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match("./index.html"))
    );
  } else {
    // Cache-first for all assets (icons, manifest)
    e.respondWith(
      caches.match(e.request)
        .then(r => r || fetch(e.request)
          .catch(() => new Response("", { status: 404 }))
        )
    );
  }
});

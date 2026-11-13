const CACHE = "faragh-v10"; // ← رُفع الإصدار لإجبار التحديث
const ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  // لا تخزن طلبات خارجية غير أساسية (مثل Leaflet) — دعها تمر مباشرة
  if (e.request.url.includes("unpkg.com") || e.request.url.includes("tile.openstreetmap.org")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
// Tasá works offline once it has loaded (docs/viral-loop.md). The network answers first, so a new game shows as soon as
// it exists; when there is no network, the copy kept from the last visit answers. One copy per path (the version stamp
// and the referral code in the address are not part of the key), so the cache never grows past the files and games seen.
// Photos come from the portals' servers and are not handled here.
const CACHE = "tasa-1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) return;
  const key = url.origin + url.pathname;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) await cache.put(key, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(key);
      if (hit) return hit;
      throw err;
    }
  })());
});

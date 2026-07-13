/* Matrix Field service worker foundation (Patch 39)
 * Safe caching: app shell for /field routes only. Never caches API responses.
 */
const SHELL_CACHE = "matrix-field-shell-v2";
const SHELL_URLS = ["/field", "/field/work", "/field/offline", "/field/profile"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* skip URLs that fail (auth redirect / offline) */
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return; // never cache APIs
  if (!url.pathname.startsWith("/field")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful navigations — never cache 5xx / auth redirects
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((r) => r || caches.match("/field")),
      ),
  );
});

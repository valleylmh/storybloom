/* Bump the version when the offline shell or caching policy changes. */
const PREFIX = "storybloom-pwa-";
const CACHE = `${PREFIX}v1`;
const OFFLINE = "/offline.html";
const LIMIT = 100;
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([
    OFFLINE, "/icons/icon-192.png", "/icons/icon-512.png",
  ])));
  // Let open tabs finish using their current version before activating an update.
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
function cacheable(request) {
  const url = new URL(request.url);
  return request.method === "GET" && url.origin === self.location.origin &&
    !url.search && !request.headers.has("range") &&
    (url.pathname.startsWith("/_next/static/") ||
      /^\/library\/.+\.(webp|png|jpg|jpeg|avif)$/.test(url.pathname) ||
      /^\/icons\/[a-z0-9-]+\.png$/.test(url.pathname));
}
// Serialize writes so concurrent image loads cannot bypass the cache bound.
let writes = Promise.resolve();
function save(request, response) {
  writes = writes.catch(() => {}).then(async () => {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
    const keys = (await cache.keys()).filter((key) => new URL(key.url).pathname !== OFFLINE);
    for (const key of keys.slice(0, Math.max(0, keys.length - LIMIT))) await cache.delete(key);
  });
  return writes;
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match(OFFLINE)) || new Response("当前离线，请联网后重试", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
      })));
    return;
  }
  if (!cacheable(request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected && response.type !== "opaque" &&
        !/private|no-store/i.test(response.headers.get("cache-control") || "")) {
      // Cache failure must never break a successful resource load.
      await save(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});

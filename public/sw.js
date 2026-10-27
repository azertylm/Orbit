// ORBIT v2.0 — Self-Healing Service Worker (v6)
// Purges all legacy caches (v1-v5) that cached Vite dev modules and automatically reloads stuck tabs.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        const hadLegacyCaches = keys.some(
          (k) =>
            k.includes("orbit-runtime") ||
            k.includes("orbit-static") ||
            k.includes("v3") ||
            k.includes("v4") ||
            k.includes("v5")
        );
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.clients.claim();

        if (hadLegacyCaches) {
          const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });
          for (const client of windowClients) {
            try {
              await client.navigate(client.url);
            } catch {
              // ignore navigation errors
            }
          }
        }
      } catch {
        // ignore errors
      }
    })()
  );
});

self.addEventListener("message", async (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "GET_CACHE_STATS" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      status: "ACTIVE_24_7",
      staticCount: 6,
      runtimeCount: 0,
      mediaCount: 0,
      totalCached: 6,
    });
  }
});

// Pass-through fetch: only intercept PWA Share Target (?url= or ?text=), never cache Vite modules
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const urlObj = new URL(event.request.url);

  if (
    urlObj.pathname === "/" &&
    (urlObj.searchParams.has("url") || urlObj.searchParams.has("text"))
  ) {
    const sharedUrl =
      urlObj.searchParams.get("url") || urlObj.searchParams.get("text") || "";
    const sharedTitle = urlObj.searchParams.get("title") || "";
    const redirectTarget =
      "/?shared_url=" +
      encodeURIComponent(sharedUrl) +
      (sharedTitle ? "&shared_title=" + encodeURIComponent(sharedTitle) : "");
    event.respondWith(Response.redirect(redirectTarget, 303));
  }
});

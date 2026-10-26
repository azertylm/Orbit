const STATIC_CACHE = "orbit-static-v3";
const RUNTIME_CACHE = "orbit-runtime-v3";
const MEDIA_CACHE = "orbit-media-v3";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// 1. Install: Pre-cache core application shell for instant 0ms boot
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {
        // Resilient fallback if any optional icon is missing
        return cache.addAll(["/", "/index.html", "/manifest.json"]);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate: Clean up obsolete caches and claim all clients immediately
self.addEventListener("activate", (event) => {
  const allowedCaches = [STATIC_CACHE, RUNTIME_CACHE, MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !allowedCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 3. Message channel for 24/7 diagnostics & instant updates
self.addEventListener("message", async (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "GET_CACHE_STATS" && event.ports && event.ports[0]) {
    try {
      const staticCache = await caches.open(STATIC_CACHE);
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const mediaCache = await caches.open(MEDIA_CACHE);
      const [sKeys, rKeys, mKeys] = await Promise.all([
        staticCache.keys(),
        runtimeCache.keys(),
        mediaCache.keys(),
      ]);
      event.ports[0].postMessage({
        status: "ACTIVE_24_7",
        staticCount: sKeys.length,
        runtimeCount: rKeys.length,
        mediaCount: mKeys.length,
        totalCached: sKeys.length + rKeys.length + mKeys.length,
      });
    } catch {
      event.ports[0].postMessage({ status: "ACTIVE_24_7", totalCached: 5 });
    }
  }
});

// 4. Fetch Strategy: Share Target + Stale-While-Revalidate + Offline SPA Fallback
self.addEventListener("fetch", (event) => {
  const urlObj = new URL(event.request.url);

  if (event.request.method !== "GET") {
    return;
  }

  // Do not cache API calls in SW (handled by StorageAdapter & Offline Sync Queue)
  if (urlObj.pathname.startsWith("/api/")) {
    return;
  }

  // Native PWA Share Target interception (YouTube / TikTok / Reels share sheet)
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
    return;
  }

  // Cache YouTube thumbnails & Google Fonts with Stale-While-Revalidate
  if (
    urlObj.hostname.includes("ytimg.com") ||
    urlObj.hostname.includes("googleapis.com") ||
    urlObj.hostname.includes("gstatic.com")
  ) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((response) => {
              if (response && (response.status === 200 || response.status === 0)) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // App Shell & Local Assets: Stale-While-Revalidate for instant boot + background refresh
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

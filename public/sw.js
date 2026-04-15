// ---------------------------------------------------------------------------
// OKrunit -- Service Worker for PWA: Offline Caching + Push Notifications
// ---------------------------------------------------------------------------

const CACHE_VERSION = "v1";
const STATIC_CACHE = `okrunit-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `okrunit-runtime-${CACHE_VERSION}`;

// App shell files to precache on install
const APP_SHELL = [
  "/",
  "/org/overview",
  "/requests",
  "/login",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/logo-icon.png",
  "/logo_text.png",
];

// ---- Install: precache app shell -------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Use addAll with a fallback: if any file fails (e.g. dynamic routes),
      // still install. We cache what we can.
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => {
            // Silently skip files that can't be precached (dynamic routes)
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// ---- Activate: clean old caches -------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---- Fetch: network-first for pages, cache-first for assets ----------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests (POST, PUT, etc.)
  if (request.method !== "GET") return;

  // Skip API routes, auth routes, and Supabase calls
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.includes("supabase")
  ) {
    return;
  }

  // Static assets (images, fonts, CSS, JS): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages: network-first with offline fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ---- Caching strategies ----------------------------------------------------

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|mp4|webm)$/.test(
    pathname
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached: return a basic offline response
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed: try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return offline page from static cache
    const offlinePage = await caches.match("/");
    if (offlinePage) return offlinePage;

    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OKrunit - Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#334155;text-align:center;padding:1rem}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#64748b}button{margin-top:1rem;padding:0.5rem 1.5rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:white;cursor:pointer;font-size:0.875rem}</style></head><body><div><h1>You\'re offline</h1><p>Check your connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>',
      { status: 503, headers: { "Content-Type": "text/html" } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(RUNTIME_CACHE);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached || new Response("Offline", { status: 503 }));

  return cached || fetchPromise;
}

// ---- Push Notifications ----------------------------------------------------

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "OKrunit";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "okrunit-notification",
    data: {
      url: data.url || "/requests",
      requestId: data.requestId,
    },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  let url = notifData.url || "/requests";

  // Handle approve/reject actions directly from notification
  if (action === "approve" && notifData.requestId) {
    url = `/approve/${notifData.requestId}`;
  } else if (action === "reject" && notifData.requestId) {
    url = `/reject/${notifData.requestId}`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

// ---- Background Sync (for offline approve/reject) --------------------------

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-decisions") {
    event.waitUntil(syncPendingDecisions());
  }
});

async function syncPendingDecisions() {
  // Future: replay queued approve/reject actions when back online
  // For now this is a no-op placeholder for background sync registration
}

const CACHE = "rv-v2";
const ASSETS = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Network-first for the upstream proxy + supabase API
  const isApi =
    url.pathname.startsWith("/functions/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("iamonstro.com.br");
  if (isApi) return;
  // Cache-first for static assets, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        // Refresh in background
        fetch(e.request)
          .then((fresh) => {
            if (fresh && fresh.ok) {
              caches.open(CACHE).then((c) => c.put(e.request, fresh.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(e.request).then((fresh) => {
        if (fresh && fresh.ok && fresh.type === "basic") {
          const clone = fresh.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return fresh;
      });
    })
  );
});

// Service worker — la app funciona offline tras la primera visita.
// Estrategia stale-while-revalidate para GET same-origin: responde de caché
// al instante y actualiza en segundo plano. Los assets de Vite llevan hash,
// así que nunca se sirve una versión mezclada.

const CACHE = "photocut-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add("/");
      // precachear los assets referenciados por el HTML (JS/CSS con hash):
      // sin esto, la primera visita no deja la app utilizable offline
      try {
        const html = await (await fetch("/")).text();
        const assets = [
          ...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|webmanifest|png))"/g),
        ].map((m) => m[1]);
        await cache.addAll([...new Set(assets)]);
      } catch {
        /* sin red durante install: el runtime cache cubrirá después */
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  // ignoreVary: vite preview/CDNs mandan "Vary: Origin" y los module scripts
  // llevan header Origin — sin esto el match fallaría justamente offline
  e.respondWith(
    caches
      .match(request, { ignoreVary: true, ignoreSearch: request.mode === "navigate" })
      .then((cached) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached || (request.mode === "navigate" ? caches.match("/") : undefined));
      return cached || fresh;
    })
  );
});

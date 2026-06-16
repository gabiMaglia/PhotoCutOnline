// Service worker — la app funciona offline tras la primera visita.
//
// Dos estrategias según el tipo de recurso:
//  - Inmutables (assets hasheados de Vite, runtime/wasm de ORT, modelo .onnx):
//    cache-first. Su URL cambia si cambia el contenido, así que servir de caché
//    sin revalidar es seguro y evita re-descargar megabytes (la IA pesa ~18MB)
//    en cada carga.
//  - Lo demás (HTML/navegación, que no lleva hash): stale-while-revalidate, para
//    recoger nuevos deploys sin quedar pegado a una versión vieja.

const CACHE = "photocut-v2";

// /assets/ = salida hasheada de Vite; .wasm/.onnx/.mjs y /models/ = runtime y
// modelo de IA (inmutables para un build dado; un cambio sube CACHE).
const IMMUTABLE = /\/assets\/|\/models\/|\.(?:wasm|onnx|mjs)(?:$|\?)/;

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
  const matchOpts = { ignoreVary: true, ignoreSearch: request.mode === "navigate" };

  // Inmutables: cache-first. Si está en caché se sirve sin tocar la red (no se
  // re-descargan los megabytes de la IA ni el JS hasheado en cada visita).
  if (IMMUTABLE.test(new URL(request.url).pathname)) {
    e.respondWith(
      caches.match(request, matchOpts).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Resto: stale-while-revalidate (responde de caché y refresca en segundo plano).
  e.respondWith(
    caches.match(request, matchOpts).then((cached) => {
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

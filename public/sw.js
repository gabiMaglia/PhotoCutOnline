// Service worker — la app funciona offline tras la primera visita, y online
// siempre se ve la versión actual (BUG-08).
//
// El build (plugin sw-build de vite.config.js) reemplaza BUILD con el id y el
// manifiesto del deploy: así sw.js cambia de bytes en cada deploy, el navegador
// instala el SW nuevo y install/activate vuelven a correr. Sin eso el install
// corría una sola vez en la vida del visitante y la caché crecía para siempre.
//
// Estrategias:
//  - Hasheados de Vite (/assets/), wasm, modelos: cache-first. Su URL cambia si
//    cambia el contenido; buscarlos en TODAS las cachés deja que una pestaña
//    abierta del build anterior siga encontrando sus chunks (retención N-1).
//  - Lo demás (HTML/navegación): network-first con 3 s de margen. Online se ve
//    el deploy actual; offline o con red colgada, la copia del shell de ESTE
//    build, coherente con sus chunks (nunca pide un hash que el server borró).
//
// Modelos: se cachean por NOMBRE. Cambiar un modelo exige cambiarle el nombre,
// si no los visitantes recurrentes siguen con el viejo (GROW-36). No se
// precachean: BiRefNet son 115 MB en partes (solo con GPU) y u2netp 4,6 MB; solo
// los baja quien usa la IA y la poda los conserva mientras el build los liste.

const BUILD = /*__PHOTOCUT_BUILD__*/ { id: "dev", shell: [], keep: [] } /*__PHOTOCUT_BUILD_END__*/;

const SHELL_PREFIX = "photocut-shell-";
const SHELL = SHELL_PREFIX + BUILD.id;
const RUNTIME = "photocut-runtime";
const META = "photocut-meta";
const LEGACY = "photocut-v2"; // caché única de los SW anteriores a BUG-08
const BUILDS_KEY = "/__photocut-sw/builds";
const RETAIN_BUILDS = 2; // el actual + el anterior (pestañas abiertas durante el deploy)
const NAV_TIMEOUT_MS = 3000; // ver plan BUG-08: más es «lie-fi», menos cae a caché en 3G

const IMMUTABLE = /\/assets\/|\/models\/|\.(?:wasm|onnx|mjs)(?:$|\?)/;
const HTML_ROUTES = new Set(["/", "/editor/"]);
// ignoreVary: los module scripts llevan header Origin y algunos CDNs mandan
// «Vary: Origin»; sin esto el match fallaría justamente offline
const MATCH = { ignoreVary: true };
const TIMEOUT = Symbol("timeout");

async function putSafe(cacheName, key, res) {
  try {
    await (await caches.open(cacheName)).put(key, res);
  } catch {
    /* cuota llena u otra falla de escritura: la respuesta ya se sirvió igual */
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      try {
        const misses = [];
        for (const url of BUILD.shell) {
          if (HTML_ROUTES.has(url)) {
            misses.push(new Request(url, { cache: "no-cache" }));
            continue;
          }
          // un asset hasheado que ya tenemos no se vuelve a bajar: el deploy
          // le cuesta al visitante solo lo que cambió
          const hit = await caches.match(url, MATCH);
          if (hit) await shell.put(url, hit);
          else misses.push(url);
        }
        await shell.addAll(misses);
      } catch (err) {
        // todo o nada: sin red a mitad del install sigue mandando el SW anterior
        await caches.delete(SHELL);
        throw err;
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const meta = await caches.open(META);
      let previous = [];
      try {
        previous = (await (await meta.match(BUILDS_KEY))?.json()) || [];
      } catch {
        /* meta ilegible: se arranca de cero */
      }
      const builds = [{ id: BUILD.id, keep: BUILD.keep }, ...previous.filter((b) => b.id !== BUILD.id)].slice(
        0,
        RETAIN_BUILDS
      );
      await meta.put(BUILDS_KEY, new Response(JSON.stringify(builds), { headers: { "content-type": "application/json" } }));

      // la caché heredada tiene ~20 MB que siguen vigentes (ORT wasm, modelos):
      // se rescatan antes de borrarla para no hacerlos bajar de nuevo
      if (await caches.has(LEGACY)) {
        const legacy = await caches.open(LEGACY);
        const keepNow = new Set(BUILD.keep);
        for (const req of await legacy.keys()) {
          if (!keepNow.has(new URL(req.url).pathname)) continue;
          const res = await legacy.match(req);
          if (res) await putSafe(RUNTIME, req, res);
        }
      }

      const shells = new Set(builds.map((b) => SHELL_PREFIX + b.id));
      for (const name of await caches.keys()) {
        if (name !== RUNTIME && name !== META && !shells.has(name)) await caches.delete(name);
      }

      const keep = new Set(builds.flatMap((b) => b.keep));
      const runtime = await caches.open(RUNTIME);
      for (const req of await runtime.keys()) {
        const p = new URL(req.url).pathname;
        if (/^\/(?:assets|models)\//.test(p) && !keep.has(p)) await runtime.delete(req);
      }
      await self.clients.claim();
    })()
  );
});

async function cacheFirst(event) {
  const { request } = event;
  const cached = await caches.match(request, MATCH);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) event.waitUntil(putSafe(RUNTIME, request, res.clone()));
  return res;
}

// Copia local para cuando la red no llega: para navegación, primero el shell de
// este build (sus chunks están todos en caché), después cualquier otra copia.
async function cachedCopy(request) {
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    const shell = await caches.open(SHELL);
    const opts = { ...MATCH, ignoreSearch: true };
    const path = url.pathname;
    const own = (await shell.match(path, opts)) || (!path.endsWith("/") && (await shell.match(path + "/", opts)));
    if (own) return own;
    return caches.match(request, opts);
  }
  return caches.match(request, MATCH);
}

async function networkFirst(event) {
  const { request } = event;
  const nav = request.mode === "navigate";
  let stored;
  const network = fetch(request).then((res) => {
    if (res.ok) {
      // navegación sin query: ?tab=… no debe multiplicar copias del mismo HTML
      const key = nav ? new URL(request.url).pathname : request;
      stored = putSafe(RUNTIME, key, res.clone());
    }
    return res;
  });
  // aunque se sirva la copia, la respuesta tardía actualiza la caché
  event.waitUntil(network.then(() => stored, () => {}));

  let timer;
  const timedOut = new Promise((resolve) => (timer = setTimeout(resolve, NAV_TIMEOUT_MS, TIMEOUT)));
  try {
    const res = await Promise.race([network, timedOut]);
    if (res !== TIMEOUT) return res;
  } catch {
    /* sin red: se cae a la copia */
  } finally {
    clearTimeout(timer);
  }

  const copy = await cachedCopy(request);
  if (copy) return copy;
  try {
    return await network; // sin copia: no queda otra que esperar a la red
  } catch {
    const home = nav && (await caches.match("/", MATCH));
    return home || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(IMMUTABLE.test(url.pathname) ? cacheFirst(e) : networkFirst(e));
});

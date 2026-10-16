# Plan — BUG-08 · «worker error» al primer ingreso tras un deploy

**Nivel (P-11):** Strong. Toca el service worker (afecta a TODA visita recurrente, landing y guías
incluidas, no solo al editor) y el transporte del worker en `backend.js`; no cambia contratos entre
capas ni agrega dependencias. Lleva §QUÉ (este) + §CÓMO estampado antes del código y verificador ciego.

**Origen:** Sprint 9, bug bash pre-lanzamiento (engram/03_backlog.md, fila BUG-08). Autorización del PO:
«dale arreglá», con la condición «tiene que andar 100 de 100 antes de salir».

## QUÉ — diseño

### Problema (medido)
- `public/sw.js:74-88` sirve TODO lo no hasheado, navegación incluida, con stale-while-revalidate: responde
  la copia de caché y actualiza en segundo plano. El comentario de `sw.js:8-9` dice que es «para recoger
  nuevos deploys», pero en la visita misma se sirve el HTML viejo.
- El HTML viejo carga su `editor-<hash viejo>.js` desde la caché (cache-first, `sw.js:57-71`), y ese
  bundle crea el worker con la URL hasheada vieja (`src/lib/backend.js:42`). Si ese worker no quedó en la
  caché (el usuario abrió el editor en la versión anterior pero no llegó a usar el worker, o el install
  solo precacheó lo que encontró en `/`, `sw.js:21-29`), va a la red. Vercel ya no lo tiene: verificado
  `https://www.photocutapp.com/assets/cutoutWorker-B9IGSm2K.js` → **404 text/html**. El worker module
  falla al cargar, `worker.onerror` (`backend.js:57-60`) rechaza con «worker error». Al refrescar anda
  porque el SWR ya guardó el HTML nuevo.
- Mismo mecanismo para los chunks perezosos: `App.jsx:10-14` y `EditPage.jsx:9-12` (`React.lazy`), y los
  `import()` de dentro del worker (`backend.js:88,117,141-154`: aiSegmenter, photocut_wasm, ORT).
- **El SW nunca se actualiza.** `sw.js` vive en `public/` y es idéntico byte a byte en cada deploy
  (`CACHE = "photocut-v2"` constante, `sw.js:11`). El navegador solo instala un SW nuevo si cambian los
  bytes, así que `install` (el precache) corrió UNA vez en la vida de cada visitante y `activate`
  (`sw.js:38-45`, poda por nombre de caché) nunca vuelve a correr: `photocut-v2` acumula todos los
  hashes de todos los deploys, para siempre.
- El precache del install mira solo `/` (la landing, `sw.js:21,25`); `/editor/` (la app, rewrite en
  `vercel.json:27`) no se precachea.
- **Hallazgo adicional:** tras un fallo de carga, `getWorker()` sigue devolviendo el worker muerto
  (`backend.js:41`: `if (worker) return worker;`, nunca se resetea). Las llamadas siguientes hacen
  `postMessage` a un worker que no existe y su Promise **no se resuelve nunca** (spinner eterno).
- **Riesgo latente que el mismo diseño cierra:** `/models/*.onnx` es cache-first por nombre
  (`sw.js:15`) y los modelos no llevan hash (`aiSegmenter.js:13` `/models/u2netp.onnx`). Si GROW-36
  reemplaza el modelo con el mismo nombre, los visitantes recurrentes seguirían con el viejo para siempre.

### Enfoque (la solución como un todo)
Una idea: **online siempre se ve la versión actual; offline se ve una versión coherente consigo misma;
y si igual falta una pieza, el usuario recibe un mensaje accionable, no «worker error».**

1. **`sw.js` versionado por build.** El build inyecta en `sw.js` un `BUILD_ID` y el manifiesto del build
   (lista de URLs hasheadas de `/assets/` + los modelos de `/models/`). Los bytes cambian en cada deploy
   ⇒ el navegador instala el SW nuevo ⇒ `install`/`activate` vuelven a correr. `vercel.json:43` ya sirve
   `/sw.js` con `max-age=0, must-revalidate`; no cambia.
2. **Navegación y todo lo no hasheado del mismo origen: network-first con timeout de 3 s.** Si la red
   responde, se sirve y se guarda en caché. Si falla (offline) o tarda más de 3 s, se sirve la caché
   (y la respuesta de red, si llega después, igual actualiza la caché para la próxima). Sin caché y sin
   red: el error de red normal (o `/` para navegaciones, como hoy `sw.js:85`).
   *Por qué 3 s:* el HTML del editor pesa decenas de KB; en 3G lenta llega en < 2 s, y el TTFB de Vercel
   es de cientos de ms. Más de 3 s es «lie-fi», donde esperar al timeout de red del navegador (decenas de
   segundos) es peor que mostrar la copia local. *Descartado:* sin timeout (network-first puro) — en
   lie-fi la navegación se cuelga. *Descartado:* timeout < 2 s — en móviles caería al fallback (y a una
   versión vieja) demasiado seguido.
   Se permite (no se exige) `navigationPreload` para no pagar el arranque del SW en cada navegación.
3. **Precache atómico del build en `install`:** HTML de `/` y `/editor/` + TODOS los `.js/.css/.mjs`
   del manifiesto (≈ 600 KB hoy, medido en `dist/assets`), con `cache.addAll` (todo o nada). Excluidos
   los pesados: el `.wasm` de ORT (13 MB) y los `.onnx` siguen en caché runtime cache-first al primer uso,
   como hoy. Un asset cuyo nombre hasheado ya está en alguna caché **no se vuelve a descargar** (se copia):
   un deploy no debe costarle al visitante más que lo que cambió.
   Resultado: el HTML cacheado y sus chunks/worker son del mismo build ⇒ el fallback offline o por
   timeout ya no puede pedir un hash que el servidor borró.
4. **Poda en `activate`, con retención N-1.** Se conservan el build actual y el anterior; se borra todo
   lo demás: cachés de shell de builds más viejos, la caché heredada `photocut-v2` (antes de borrarla se
   rescatan las entradas que siguen vigentes en el manifiesto —ORT wasm, modelos— para no hacer bajar de
   nuevo ~20 MB a cada visitante), y en la caché runtime toda entrada de `/assets/` o `/models/` que no
   figure en el manifiesto actual ni en el anterior. *Por qué N-1:* el SW nuevo se activa con
   `skipWaiting` + `clients.claim` (`sw.js:33,43`) mientras hay pestañas abiertas en la versión anterior;
   si al activar se borrara su caché, la próxima carga perezosa de esa pestaña (abrir Filtros, Lote…)
   pediría un hash que Vercel ya no tiene. Con N-1 la pestaña vieja sigue andando desde caché.
   *Descartado:* quitar `skipWaiting` y esperar a que se cierren todas las pestañas — deja a los usuarios
   en la versión vieja indefinidamente (pestaña de editor siempre abierta) y no resuelve la caché eterna.
5. **Recuperación en el cliente (segunda línea, nunca recarga sola):**
   - `backend.js`: si el worker falla **al cargar** (error antes de su primer mensaje), se termina y se
     pone `worker = null` (la próxima llamada lo recrea), y las llamadas pendientes se rechazan con un
     error tipado `WORKER_LOAD_FAILED`, no «worker error». Un error en tiempo de ejecución de un worker
     que ya respondió conserva el comportamiento actual (la sesión de recorte vive en el worker; no se tira).
   - `window` escucha `vite:preloadError` (evento de Vite para un `import()` dinámico que no carga, doc
     oficial «Load Error Handling»; verificado vía Context7 /vitejs/vite).
   - Ambos casos, y los `import()` fallidos que el worker reporte, muestran el mismo aviso es/en/pt:
     «Hay una versión nueva de PhotoCut. Recargá la página para seguir.» con botón **Recargar**.
     *Descartado:* `location.reload()` automático (lo que sugiere la doc de Vite) — el worker se crea
     recién cuando el usuario ya abrió su foto; recargar solo le borraría el trabajo sin avisar.
   - Sin chequeo de versión al arrancar: con 1–4 el arranque ya es coherente; un `version.json` por
     visita sería una request más para cubrir un caso que el precache coherente ya cubre.
6. **Tauri / dev sin cambios:** el SW se registra solo en producción web (`main.jsx:15-19`). Las piezas de
   cliente (5) son inocuas en desktop.

### Errores
- Install sin red o `addAll` falla: el SW nuevo no se instala; sigue el anterior (comportamiento estándar
  de `install`). Nunca queda un precache a medias.
- Cuota de almacenamiento llena al cachear runtime: se sirve la respuesta de red igual; el `put` fallido
  no rompe la respuesta.
- Respuestas no-OK (404/500) nunca se guardan en caché (ya es así, `sw.js:63,79`; se mantiene).

### Contratos que cambian
- Ninguno entre capas. `backend.*` conserva firmas; lo único nuevo es el código de error
  `WORKER_LOAD_FAILED` en el rechazo (los llamadores que muestran `err.message` pasan a mostrar el aviso
  traducido: el §CÓMO lista cada llamador que hace toast del error).
- El build pasa a generar `dist/sw.js` (ya no es copia literal de `public/sw.js`): el §CÓMO define cómo
  (plugin de Vite en `generateBundle`/`writeBundle`) sin agregar dependencias (no Workbox).

### Pruebas (criterios de aceptación; rojas primero contra `main` donde se indica)
Viabilidad medida: el arnés actual corre `vite dev` (`test/run-tests.mjs:184`), donde el SW NO se
registra (`main.jsx:15`) y no hay hashes; y con SW activo `ctx.route` no ve lo que pide el SW
(`run-tests.mjs:72`, QA H-03). Por eso **suite nueva `sw-deploy-test`** con servidor estático propio
(node:http, sin dependencias) que imita a Vercel: rewrite `/editor` → `/editor/index.html`, `/sw.js`
no-cache, y **404 `text/html` para todo `/assets/*` que no exista en el deploy servido**. El servidor
cambia de «deploy» en caliente (A → B → C) sin cambiar de origen. Los deploys salen de UN build hecho por
la propia suite en un directorio temporal (determinista; no confía en un `dist/` local viejo): A y C se
derivan renombrando un subconjunto de hashes (entrada del editor, `cutoutWorker`, un chunk perezoso) y
reescribiendo sus referencias y el `BUILD_ID`; el resto de los assets se comparte, como en un deploy real.
*Descartado:* `vite preview` — no puede cambiar de deploy sin reiniciar y su 404 no imita a Vercel.
Se engancha en `npm run test:web` (CI ya hace `npm run build` antes, `ci.yml:27-28`, pero la suite usa
su propio build). Corre en Chrome; en WebKit si Playwright WebKit registra SW en `http://localhost` (el
§CÓMO lo verifica primero); si no, se documenta como no cubierto y el cierre adjunta una prueba manual en
Safari con evidencia (no «asumido»).

- **C1 (roja hoy):** visito `/editor/` en el deploy A sin usar el worker (SW activo y página controlada);
  el servidor pasa a B; navego a `/editor/` y abro una imagen ⇒ el HTML servido es el de B (`BUILD_ID` B),
  el worker arranca, el recorte automático termina, y no hay ninguna respuesta 404 de `/assets/` ni el
  texto «worker error». Con el `sw.js` actual esto falla.
- **C2 offline (regresión, no debe romperse):** tras visitar B, `context.setOffline(true)` y navego a
  `/editor/` ⇒ la app arranca desde caché, y abrir Filtros (chunk perezoso) funciona sin red.
- **C3 red lenta:** con caché de B y el servidor demorando el HTML 6 s ⇒ la página se sirve desde caché en
  ≤ 3,5 s y funciona (worker incluido); en la visita siguiente sin demora, el HTML es el más nuevo.
- **C4 pestaña abierta durante un deploy (N-1):** pestaña controlada en A; el servidor pasa a B y se fuerza
  `registration.update()` hasta que B activa; en la pestaña de A abro Filtros (chunk perezoso aún no
  cargado) ⇒ carga desde caché, sin 404.
- **C5 poda:** sembrar una caché `photocut-v2` con una entrada `/assets/old-XXXX.js` y el `.onnx`; pasar
  A → B → C ⇒ tras activar C: no existe `photocut-v2`; no queda ninguna URL exclusiva de A; quedan las de
  B y C; el `.onnx` vigente sigue en caché y **no** se volvió a pedir a la red.
- **C6 sin re-descarga:** en el install de B, cero requests de red para los assets cuyo nombre hasheado
  ya estaba en caché por A.
- **C7 recuperación (jest, `backend`):** con `Worker` mockeado que dispara `error` antes de cualquier
  mensaje ⇒ la Promise pendiente rechaza con `WORKER_LOAD_FAILED`; una segunda llamada crea un worker
  nuevo y resuelve (hoy: queda colgada para siempre — roja). Un error de un worker que ya respondió NO
  lo recrea.
- **C8 aviso:** en el arnés, forzar 404 del worker en un deploy ⇒ aparece el aviso traducido con botón
  Recargar (es/en/pt), nunca «worker error»; la página no se recarga sola. Ídem disparando
  `vite:preloadError`.
- `npm test` + `npm run test:web` verdes; 0 requests fuera del origen en la suite nueva.

### Riesgos
- **Transición (aceptado):** la primera visita de cada usuario tras desplegar este fix la atiende todavía
  el SW viejo (SWR) ⇒ puede ver el bug UNA vez más; durante esa visita se instala el SW nuevo y no vuelve
  a pasar. No se fuerza `client.navigate()` desde el SW nuevo porque recargaría pestañas con trabajo.
- Modelos: desde este fix, **cambiar un modelo exige cambiar su nombre de archivo** (o el manifiesto lo
  trata como el mismo y el usuario no lo baja). Avisar a GROW-36.
- La lista de precache sale del bundle; si un asset se pide por una ruta que el build no conoce, queda
  solo en caché runtime (como hoy) y offline podría faltar. El §CÓMO lista qué entra.
- El timeout de 3 s puede servir HTML de caché a quien tenga red muy lenta: es coherente (precache del
  mismo build), no vuelve el 404.

### Fuera de alcance
Aviso «hay una versión nueva» proactivo al detectar un SW en espera; Workbox; estrategia de caché de
`/fonts`, iconos e imágenes más allá de pasar a network-first con el resto de lo no hasheado.

**Aprobado por:** nerv-arquitecto · arquitecto · 2026-10-16

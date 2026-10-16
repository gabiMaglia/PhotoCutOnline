# BUG-08 — QA (nivel Strong, P-11)

## Intento 1 — rama `fix/BUG-08-sw-deploy`, HEAD 3a78032

**Veredicto: APROBADO.** Los criterios C1–C8 se cumplen en Chrome y en WebKit. La prueba de rojo existe y
falla por las aserciones. No hay aserciones vacías ni debilitadas. Las sondas propias de QA cubren lo que la
suite no cubre (IA offline, wasm y modelo entre deploys, migración, pestaña abierta en dos deploys, install
fallido) y todas pasan. Quedan observaciones de severidad baja, sin bloqueo. Van como deuda.

### §Plan
- **Contrato:** `engram/plans/BUG-08.md` (§QUÉ C1–C8, §CÓMO T1–T8 y desvíos).
- **Lentes Strong:** riesgo (privacidad, caché de `sw.js`), resiliencia (offline, install a medias, pestaña
  vieja), legibilidad, confiabilidad (tests y rojo).
- **Ejecución propia:** `npm test`, `npm run test:web` (Chrome + WebKit),
  `node test/sw-deploy-test.mjs chrome|webkit`, `curl -I` contra prod y la sonda QA
  `scratchpad/qa-bug08/probe.mjs`. La sonda está fuera de la rama: corre un build propio con el mismo
  servidor-Vercel de la suite, en el puerto 5199.

### Comandos y salidas
| Comando | Resultado |
|---|---|
| `npm test` | jest **53 suites / 319 tests verdes**. `node --test scripts/` **78/78**. exit 0 |
| `node test/sw-deploy-test.mjs chrome` | 36 PASS, 0 FAIL. «✓ sw-deploy verde». C3: 3035 ms |
| `node test/sw-deploy-test.mjs webkit` | 36 PASS, 0 FAIL. «✓ sw-deploy verde». C3: 3068 ms |
| `npm run test:web` (1.ª corrida) | exit 1: `canvas-test` TIMEOUT y `engine-test` `ERR_CONNECTION_REFUSED :5187`. **Causa ajena a la rama:** otro agente (worktree `agent-ac71089…`) corría `test:web` en el mismo puerto 5187 a la vez (`lsof`: PID 75357 `vite dev --port 5187`, load 20). |
| `npm run test:web` (reintento, puerto libre) | **«✓ todo verde», exit 0.** Todas las suites en Chrome y WebKit, incluida `sw-deploy-test` en los dos motores. |
| Cobertura del código nuevo (jest) | `staleBuild.js` 100 % de líneas, `useStaleBuild.js` 100 %, `UpdateNotice.jsx` 100 %, `StaleBuildNotice.jsx` 100 % de líneas, `swManifest.mjs` 100 % de líneas. `sw.js` lo ejercita la suite de navegador (C1–C8, en los dos motores). |
| `curl -sI https://www.photocutapp.com/sw.js` | `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT` (la CDN la invalida en cada deploy) |
| `curl -sI https://www.photocutapp.com/editor/` | `200`, sin redirección (el HTML del precache no queda `redirected`) |

**Rojo (P-18):** revisé los archivos guardados en el scratchpad.
- `red-sw.txt` (Chrome) y `red-sw-webkit.txt`: 5 casos con fallos contra `main`. C1 muestra «worker error»
  y un 404 de `cutoutWorker-…a.js`. C2 no abre Filtros offline. C3 tarda 6061 ms. C4 da 404 de
  `FiltersPage-…a.js`. C5 deja `photocut-v2`. C8 no muestra aviso.
- `red-jest.txt`: C7 rechaza con `worker error` en lugar de `WORKER_LOAD_FAILED`. También faltan los
  módulos nuevos.
- `red-node.txt`: falta `swManifest.mjs`.

Los tests nuevos fallan por aserción, no por infraestructura. C6 y el chequeo de origen pasaban también
en rojo. Son guardas de regresión, no la prueba del bug, y es aceptable.

**P-18.4 / P-18.5:** cada test nuevo tiene aserciones de comportamiento (`backend.worker-load.test.js`,
`staleBuild.test.js`, `StaleBuildNotice.test.jsx`, `swManifest.test.mjs`, `sw-deploy-test.mjs`).
`test/run-tests.mjs` solo suma líneas (`+runSwDeploy` en Chrome y WebKit). No hay aserciones quitadas ni
debilitadas.

### Sonda QA (propia, fuera de la rama)
Guardada en `scratchpad/qa-bug08/probe-chrome.txt` y `probe-webkit.txt`.

| Caso | Chrome | WebKit |
|---|---|---|
| P1: tras una visita, red cortada (servidor caído y `setOffline` en Chrome): `/editor/` carga, abre la imagen y **el Recorte IA funciona** con el modelo en caché, sin aviso de versión | PASS | PASS |
| P2: con IA usada en A, deploy B y nueva IA: **0 requests de `.wasm`/`.onnx`** al servidor | PASS | PASS |
| P3: un SW viejo siembra `photocut-v2` con `u2netp.onnx` y `ort-wasm-simd-threaded-*.wasm`. Se instala el SW nuevo y se usa IA: ni el wasm de ORT ni el modelo se vuelven a pedir, y `photocut-v2` desaparece. Solo se pide `photocut_wasm_bg` (42 KB), que no estaba sembrado. | PASS | PASS |
| P4: pestaña de A sin worker. B queda activo y recién entonces se abre la imagen y se usa IA: el worker y los chunks de A salen del shell N-1, con 0 respuestas 404 | PASS | PASS |
| P5: pestaña de A abierta durante **dos** deploys (B y C activos, shell-A podado): se muestra el **aviso con Recargar**. No aparece «worker error» y la página no se recarga sola | PASS | PASS |
| P6: install de B con un 404 en el precache: no queda `photocut-shell-B` a medias, no hay nada en `waiting` y el build activo sigue siendo A | PASS | PASS |
| P7: offline, `/editor/?tab=batch` y `/editor` (sin barra) arrancan desde caché | PASS | PASS |

En la primera versión de P7 la sonda entraba por `/` y el SW no se activaba. Era un error de la sonda: el
SW se registra solo desde el editor (`src/main.jsx:17-21`), igual que en `main`. Corregida, pasa.

### Revisión por lente
- **Riesgo / privacidad.** El `fetch` del SW ignora lo que no sea GET del mismo origen (`public/sw.js:181`).
  Install y activate solo tocan URLs propias. **El cambio no agrega ninguna request fuera del origen.**
  Las únicas externas vistas son GET de AdSense sin cuerpo (`editor/index.html:195`), que ya existían antes
  de esta rama. `vercel.json:42-45` sirve `/sw.js` con `max-age=0, must-revalidate` y prod lo confirma.
  Además, el navegador no usa la caché HTTP para el script del SW (por defecto `updateViaCache: "imports"`,
  y `sw.js` no importa nada).
- **Mezcla de builds.** El precache es todo o nada: `addAll` y, si falla, borra el shell y relanza
  (`public/sw.js:63-67`, P6). La navegación offline o con timeout sirve el shell del build de ESE SW
  (`public/sw.js:129-138`), que es coherente con sus chunks. La retención N-1 cubre la pestaña abierta
  durante un deploy (C4, P4). Con dos deploys aparece el aviso, como prevé el diseño (P5).
- **Resiliencia.** El worker que falla antes de su primer mensaje se descarta y se recrea
  (`src/lib/backend.js:74-80`, C7). Un error de un worker que ya respondió mantiene el comportamiento
  anterior. Si `put` falla por cuota, la respuesta se sirve igual (`public/sw.js:38-44`).
- **Falsos positivos del aviso.** `isChunkLoadError` está anclado al inicio (`src/lib/staleBuild.js:17-18`).
  Los errores WebP de GROW-35 llevan el prefijo `WEBP_ENCODE_FAILED:` y además viajan por `webpEncoder.js`,
  no por `backend.js`. En `test:web`, `webp-retry-test [webkit]` pasa con su propio manejo. `cutoutWorker`
  atrapa todo error de sus handlers y lo responde como `ok:false` (`src/lib/cutoutWorker.js:145-159`), así
  que el error antes del primer mensaje queda limitado, en la práctica, a que el script no cargó. La recarga
  ocurre solo con el botón (`src/features/update/StaleBuildNotice.jsx:5,15`).
- **Legibilidad.** Los comentarios de `sw.js` y `main.jsx` están al día. Las funciones son puras y están
  testeadas (`scripts/lib/swManifest.mjs`). El plugin usa el `outDir` resuelto (`vite.config.js:231-257`).

### Evaluación de los desvíos declarados
1. **«Ninguna request externa con cuerpo» en lugar de «0 requests externas».** Aceptable. Las externas
   vienen de AdSense, fijo en el HTML desde antes y fuera del alcance de BUG-08. El SW no las genera (ver
   lente de riesgo). La suite las bloquea, así que es hermética. Lo que protege la promesa de privacidad,
   que la foto no sale, se sigue exigiendo. → GAP G-2 al PO.
2. **C5 siembra `photocut-v2` con un SW estilo viejo.** Aceptable. Es más fiel a la realidad que sembrar
   desde la página, y P3 lo confirma con el wasm de ORT real.
3. **`waitActive` sondea desde node.** Aceptable. Evita el falso verde de `waitForFunction` con una Promise.
4. **Sin `navigationPreload`.** Aceptable. El §QUÉ lo permite, no lo exige.
5. **Margen de C3 (~3,05 s contra 3,5 s).** Aceptable. El timeout es 3 s por diseño y quedan unos 450 ms de
   holgura. Con la máquina muy cargada podría ponerse inestable (observación O-4).
6. **Un `import()` que falla offline muestra «versión nueva, recargá».** Aceptable con nota. Con todo el
   JS/CSS en el precache, offline solo pasa si el install todavía no terminó (primera visita) o si el
   navegador desalojó la caché. Recargar es inocuo. → O-3.

### §GAP
| # | Escenario | Tipo | Hallazgo |
|---|---|---|---|
| G-1 | IA offline con el modelo en caché | Deducido (pedido de la revisión, no está en C1–C8) | Funciona (P1). La suite no lo cubre: C2 solo abre Filtros. Propuesta al PO: sumarlo como criterio si se quiere en la regresión. |
| G-2 | «0 requests fuera del origen» | Especificado → desvío | El editor ya pedía AdSense antes del cambio. Validar con el PO la redacción «ninguna request externa con cuerpo». |
| G-3 | Navegaciones fuera de `/` y `/editor/` (guías, `/fonts`) | Deducido | Pasan a network-first con 3 s de margen. Su caché runtime no se poda (ya era así). El §QUÉ las deja fuera de alcance. |
| G-4 | Landing nunca visitada desde el editor | Deducido | El SW se registra solo desde el editor (ya era así). Quien solo vio la landing no tiene SW. No es un defecto de este ticket. |
| G-5 | Respuesta 5xx de la red en una navegación | Deducido | Se sirve el 5xx; no se cae a la copia, porque la caché se usa solo si falla la red o vence el timeout. Antes, con SWR, se servía la caché. No está en los criterios → PO. |

### §Casos (1:1 con el Gherkin del §QUÉ)
| Criterio | Evidencia | Chrome | WebKit |
|---|---|---|---|
| C1 deploy nuevo: HTML de B, worker vivo, auto termina, 0 404, sin «worker error» | sw-deploy C1 | PASS | PASS |
| C2 offline: arranca y abre Filtros | sw-deploy C2, más P1 y P7 | PASS | PASS |
| C3 red lenta ≤ 3,5 s desde caché y después el HTML nuevo | sw-deploy C3 (3035 / 3068 ms) | PASS | PASS |
| C4 pestaña abierta durante el deploy (N-1) | sw-deploy C4, más P4 | PASS | PASS |
| C5 poda, sin `photocut-v2`, modelo conservado sin re-descarga | sw-deploy C5, más P3 | PASS | PASS |
| C6 sin re-descarga de assets compartidos | sw-deploy C6, más P2 | PASS | PASS |
| C7 recuperación (jest) | `backend.worker-load.test.js` 5/5 | PASS | — |
| C8 aviso es/en/pt con Recargar, sin recarga automática (worker 404 y `vite:preloadError`) | sw-deploy C8, más `StaleBuildNotice.test.jsx` | PASS | PASS |
| `npm test` y `npm run test:web` verdes | ver tabla de comandos | PASS | PASS |

### §Defectos
Ninguno bloqueante.

Observaciones (severidad Baja, no bloquean; candidatas a `_debt.md`):
- **O-1 (Baja)** — `public/sw.js:52-63`. El install baja el HTML (`no-cache`) sin verificar que su
  `<meta name="photocut-build">` coincida con `BUILD.id`. Si sale un deploy en los segundos entre la
  descarga de `sw.js` y la del HTML, el shell guarda el HTML del build N+1 con chunks del build N. Online
  no afecta. Offline, ese HTML pediría chunks que no están. La ventana es mínima y se corrige sola en el
  siguiente update.
- **O-2 (Baja)** — `public/sw.js:160-161`. En network-first, una respuesta no-OK de la red (5xx) gana la
  carrera y se sirve aunque haya copia. Ver G-5.
- **O-3 (Baja)** — `src/hooks/useStaleBuild.js:13`. Cualquier `vite:preloadError` muestra «versión nueva»,
  también un fallo de red offline con caché desalojada (desvío 6). El texto puede confundir, pero la acción
  es inocua.
- **O-4 (Baja)** — `test/sw-deploy-test.mjs:277`. C3 tiene unos 450 ms de holgura sobre el timeout de 3 s.
  Además, el chequeo «no se recargó sola» de C8 (`:368`) es instantáneo: no espera un tiempo para descartar
  una recarga tardía. El código no tiene ninguna recarga automática, así que hoy no oculta nada.
- **O-5 (Info, proceso)** — `test/run-tests.mjs` usa los puertos fijos 5187 y 5188. Dos agentes que corren
  `test:web` en paralelo se pisan, y eso fue lo que hizo fallar mi primera corrida.

**Firmado:** nerv-qa · 2026-10-16

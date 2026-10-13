# QA GROW-35 — WebP real en todos los navegadores (nerv-qa, 2026-10-11)

## Intento 4 — **APROBADO (Strong)** · HEAD c79292c (nivel X, gate PASS)

D-i3-1 está corregido. El CI del PR #4 corrió sobre este mismo HEAD (c79292c) y salió **verde**: run
38330079824, con Web y Rust en success. No quedan defectos abiertos. Lo que no está cubierto ya está
anotado como deuda en `_debt.md`: el flag `forceWasm` para CI, O1, O2, A5 (escritorio) y Safari/iOS
reales.

- **`retryVerdict` y `scripts/lib/run-tests-retry.test.mjs`:** los 6 casos pasan (6/6). Probé dos
  mutaciones y restauré el archivo después de cada una.
  - **(a)** Hice que el SKIP también contara como pase en darwin: falla «SKIP por ruta nativa en macOS es un fallo».
  - **(b)** Hice que pasara sin SKIP y sin requests bloqueados: falla «sin SKIP y sin requests bloqueados falla en cualquier plataforma».
- **En macOS el SKIP no se cuela:** corrí `npm run test:web` en local (load de 6,8 al empezar y 4,6 al terminar) y salió «✓ todo verde», EXIT 0.
  - `webp-retry-test [webkit]` imprimió `ruta=wasm`, los 4 PASS y PHASE1_DONE/ALL_DONE, en 27,0 s de 240. No hubo SKIP.
  - `webp-test [webkit]` tardó 27,6 s de 240.
- **Log de CI** (`gh run view 38330079824 --log`, headSha c79292c):
  - Dentro de `test:web`, la línea `SKIP: ruta=nativa — …` aparece una sola vez, en `webp-retry-test [webkit]`. Los otros «SKIP» del log son solo nombres de tests de `npm test`.
  - `webp-test [webkit]`: `ruta=nativa`, 14 PASS y 0 FAIL/ERROR, en 6,2 s de 240.
  - El log termina con «✓ todo verde».
  - La ruta WASM no se ejercita en CI Linux; eso es deuda registrada.
- **Refactor a `main()`:** el runner arranca solo cuando se lo ejecuta (guarda `import.meta.url === pathToFileURL(argv[1])`), así que el test de node puede importar `retryVerdict` sin lanzar navegadores.
  - `npm run test:web`: verde.
  - `RUNNER_SELFTEST=1 npm run test:web`: espera 35,2 s de 120 en Chrome y 35,1 s de 240 en WebKit, y sale verde.
- **`_debt.md`:** tiene la entrada «intento 3b», con el flag del harness `?forceWasm=1` pendiente para que CI Linux ejercite la ruta WASM y el reintento.
- **Alcance (`git diff b1743b2..HEAD --stat`):** `test/run-tests.mjs`, `test/webp-retry-test.js`,
  `scripts/lib/run-tests-retry.test.mjs`, `engram/plans/GROW-35.md`, `engram/qa/_debt.md`, y
  `engram/03_backlog.md` (este último vino del merge de main). Nada de `src/`.
- Después del merge hay que mirar el CI de `main`, que no está protegida.

---

## Intento 3 — **RECHAZADO** · HEAD b1743b2 (nivel X, gate PASS)

D-i2-1 está corregido y probado con mutación. Rechazo porque el CI del PR #4 sobre este mismo HEAD
(b1743b2) sale **rojo**, y la revisión del arquitecto (§3 a y d) exige CI verde para mergear. La causa
es determinista: no es la carga de la máquina.

### Defectos
1. **D-i3-1 · ALTA · `test/webp-retry-test.js` + `runRetry` en `test/run-tests.mjs`**
   - **Dónde falló:** GitHub Actions run 38329483132, job «Web (build + tests en Chrome)», conclusión FAILURE.
   - **Qué dice el log de CI:**
     - `webp-test [webkit]`: «ruta=nativa», 9,5 s de 240 s, todo PASS. El WebKit de Playwright en Linux codifica WebP nativo, que es justo el escenario (c) del arquitecto.
     - `webp-retry-test [webkit]`: «FAIL: editor sin encoder: error WebP (null)» y «FAIL: no se bloqueó ningún request del encoder». Termina en «✗ 1 suite(s) con fallos», exit code 1.
   - **Causa:** el test de D2 da por hecho que corre por la ruta WASM. En un motor con WebP nativo el
     export no pide el encoder, así que no hay nada que bloquear y no aparece el error que la fase 1 espera.
     Va a fallar siempre en Linux.
   - **Qué viola:** §3 (a)/(d) de la revisión del arquitecto (merge solo con CI verde) y C7 (`test:web` con la corrida WebKit).
   - **Por qué no se vio antes:** en local (macOS, `ruta=wasm`) pasa. El riesgo (c) se anotó solo para
     `webp-test`, no para `webp-retry-test`.
   - **Cómo arreglarlo:** lo decide el arquitecto.
     - **Preferible:** el flag de prueba que fuerza `canEncodeWebP()` falso solo en el harness (el que
       §3 c deja como deuda), aplicado al menos a `webp-retry-test`. Así D2 se ejercita también en CI.
     - **Alternativa:** que `webp-retry-test` y `runRetry` detecten la ruta nativa y la informen como
       no aplicable, de forma explícita y visible en el log. En ese caso D2 queda sin cubrir en CI y
       hay que anotarlo.

### Verificado con salida real
- **Plan contra lo implementado** (§QUÉ «Revisión del arquitecto tras 2 rechazos» y §CÓMO «Correcciones — intento 3» R1–R3): coincide.
  - `TIMEOUT_MS = {chrome: 120 s, webkit: 240 s}`.
  - `runSuite` llama `(fn, null, {timeout: TIMEOUT_MS[tag]})`; `runRetry` usa `TIMEOUT_MS.webkit`. Solo hay esos 2 `waitForFunction` (grep, líneas 85 y 125).
  - El aviso de TIMEOUT muestra el límite y cada suite imprime su duración.
  - El `ctx.setDefaultTimeout` opcional no se agregó; el plan lo dejaba a criterio.
- **Prueba de rojo del runner:**
  - `RUNNER_SELFTEST=1 npm run test:web` con load 18: verde. La espera fue de 35,1 s de 120 en Chrome y 35,4 s de 240 en WebKit.
  - Mutación (saqué el `null` en runSuite): TIMEOUT en los dos motores y EXIT 1. Restauré el archivo.
  - Detalle cosmético: con la mutación el mensaje dice «(120000 ms)» aunque el corte real es a los 30 s.
  - La autoprueba no corre por defecto: solo con `RUNNER_SELFTEST === "1"`, que no aparece en `.github`, `package.json` ni `scripts`.
- **`npm run test:web` completo en local** (load 5,2 al empezar, 8,5 al terminar): «✓ todo verde», EXIT 0.
  - `webp-test`: `ruta=nativa`, 18,7 s de 120.
  - `webp-test [webkit]`: `ruta=wasm`, **28,0 s de 240**.
  - `reencode-test [webkit]` y `webp-retry-test [webkit]`: verdes.
- **`_debt.md`:** tiene los 3 cambios de aserciones, O1, O2 (como pregunta para el PO) y el riesgo de
  CI de `ruta=wasm` en Linux. Ese riesgo se cumplió y además rompió `webp-retry-test` (D-i3-1).
- **Alcance (`git diff 1f5c1fc..HEAD --stat`):** `test/run-tests.mjs`, `test/runner-timeout-test.{html,js}`,
  `engram/plans/GROW-35.md`, `engram/qa/_debt.md` y `engram/03_backlog.md` (este entra por el merge de
  main). No hay nada de `src/`.

---

## Intento 2 — **RECHAZADO** · HEAD 1f5c1fc (nivel X computado por el gate, PASS)

Las correcciones D1, D2 y D3 del verifier y los hallazgos H-01, H-02 y H-05 están bien hechos y probados con mutación. Rechazo por un solo defecto: `npm run test:web`, que es obligatorio y corre en CI, sale **rojo en 2 de 3 corridas**. La causa es determinista: el tiempo límite real del runner es de 30 s, no los 120 s que dice el código.

### Defectos
1. **D-i2-1 · MEDIA · `test/run-tests.mjs:111-114` (runSuite).**
   - **Causa:** `page.waitForFunction(fn, { timeout: 120000 })` pasa `{timeout}` como **`arg`** y no como `options` (la firma es `(fn, arg, options)`). El tiempo límite efectivo queda en el default de Playwright: 30 s.
   - **Por qué ahora:** `webp-test [webkit]` tarda entre 27,4 y 29,7 s (autoCut en WebKit) y queda pegado a ese límite. Es la corrida WebKit que agrega este ticket (criterio C7 del §QUÉ).
   - **Corridas** (las tres con `npm run test:web`):

     | # | Load al empezar | Resultado |
     |---|---|---|
     | 1 | 34 | `webp-test [webkit]` TIMEOUT, EXIT 1 |
     | 2 | 20,6 | ídem, EXIT 1 (al terminar, 52) |
     | 3 | 8,7 | «✓ todo verde», EXIT 0 |

   - **Mensaje real**, capturado con una copia instrumentada del runner: `page.waitForFunction: Timeout 30000ms exceeded`, a los 30,0 s del arranque de la suite.
   - **Prueba del arreglo:** en la misma copia, con `(fn, null, { timeout })` y load 32, todo verde (`webp-test [webkit]` ALL_DONE a los 28,4 s).
   - El bug ya estaba en main (c13458a:73-76). En Chrome nunca se notó porque sus suites son rápidas.
   - **Riesgo en CI:** en un runner Linux de 2 vCPU, autoCut en WebKit pasa con facilidad los 30 s, así que el CI quedaría rojo después del merge.
   - El handoff atribuye los timeouts a «los 120 s del runner»; ese diagnóstico es incorrecto.
   - **Qué arreglar:** pasar `null` como `arg` en runSuite, y en el mismo cambio revisar los otros `waitForFunction` del runner. `runRetry` ya lo hace bien.

### Verificado con salida real (no se repite si se arregla solo D-i2-1)
- **Suites:** `rm -rf dist && npm test` da jest 303/303 y node 68/68, EXIT 0. Con load 8,7, `test:web` sale verde: Chrome `ruta=nativa`; WebKit `ruta=wasm`, `reencode-test` y `webp-retry-test`.
- **D1** (build + preview, Chrome y WebKit): Color #2563eb + JPEG → Sticker WhatsApp → Original.
  - Toast «Volvió tu fondo (Color) y tu formato: JPEG».
  - Color marcado y JPEG marcado y habilitado.
  - Baja `photocut-solid.jpg`, JPEG real, con esquina [37,99,234,255], igual a la de antes del sticker.
  - Mutaciones: quitar la restauración del fondo hace fallar 1 test; un aviso con el formato pedido en vez del efectivo hace fallar 2.
- **D2** (WebKit, con `encode-*.js` bloqueado y SW bloqueado):
  - 2 exportaciones sin descarga y con aviso.
  - Al desbloquear, 2 reintentos dan `photocut-transparent.webp` real (65 828 B).
  - Archivo: bloqueado no baja nada; el reintento da `.webp` real.
  - Mutaciones: sin `dropWorker` fallan jest y `webp-retry-test [webkit]` («editor, reintento con red… load: Importing a module script failed»); con `typeof document` en lugar de `typeof Worker`, falla jest.
- **D3** (WebKit, Archivo, PNG de 16384×96): no baja nada y sale el toast «WebP admite hasta 16383 px por lado…», sin aviso de conexión.
  - Mutaciones: sin la marca `too_large` falla 1 test; con la clave colapsada a `webpFailed` fallan 2.
  - En Chrome el WebP nativo baja recortado; según el verifier ya pasaba en la base y queda fuera de alcance.
- **H-01:** `_debt.md` tiene los desvíos a–f y los del intento 2.
- **H-02:** la mutación M-c1 (worker al importar) hace fallar «importar el módulo no crea ningún Worker». La M-c4 (import estático del wrapper) hace fallar la guarda: «editor-…js trae el wrapper de jSquash en la carga inicial». En el build real la guarda pasa 3/3, sin falso positivo.
- **H-05:** F-07 figura como «Retirado en GROW-34».
- **Aserciones cambiadas** (P-18.5): son 3 y las tres están estampadas en el plan, en «Correcciones — intento 2», antes del código. Ninguna afloja una aserción.
  - **Test de nodo del worker:** el contrato cambia por D2. Se reemplaza por dos tests: uno con Worker (crea 1 anidado y no codifica directo) y otro sin Worker (codifica directo).
  - **Más de 16383 px:** pasa de `webpFailed` a `webpTooLarge`, y además verifica que la clave exista. Es más estricto.
  - **D2 del intento 1:** arranca en Color + JPEG y espera `settingsRestored`. El escenario Transparente + JPEG sigue cubierto en un test propio que espera PNG, lo que de verdad baja. Es más preciso.
  - Observación: `_debt.md` no lista estos 3 cambios; sí están en el plan y en el handoff.
- **Regresión:**
  - G6 (Chrome, c13458a contra la rama): los 6 hashes son idénticos (50a8b5f7…, 2453ec3d…, 2cc4ff79…, 15cb58de…, 8b65c70b…, c25bb184…).
  - Lote e Icon Studio: el diff contra c13458a no toca `src/features/batch`, `iconStudio` ni `backend.js`, e `icons-test` sale verde.
  - Sticker WhatsApp en WebKit: `.webp` real con alfa, 25,2 KB, esquina 0.
  - A1 con 4000×3000 en WebKit: 2 posts al worker y gana la última (0.15); peor bloqueo del hilo principal, 191 ms.
- **merge-tree** contra main 7f038b4: limpio (8e65310), y main ya está contenido en HEAD.

---

## Intento 1 — APROBADO (Strong) · rama `feat/GROW-35-webp-real` HEAD 3759539 (base c13458a)
(Después lo rechazó nerv-verifier: ver GROW-35-verifier.md.)

Gate: el orquestador informó nerv-gate PASS (43 archivos = diff, plan estampado, prueba de rojo OK). Yo
re-hice la prueba de rojo con mutaciones (§Casos M-a..M-c). Ningún criterio del §QUÉ falla. Los
hallazgos BAJOS de abajo no bloquean y van a deuda. No hay aprobación "con observaciones".

## §Plan
- Nivel: Strong (computado X por el gate; la pasada hostil corre aparte en nerv-verifier ciego).
- Suites: `rm -rf dist && npm test`, `npm run test:web` (Chrome + WebKit).
- E2E propio con Playwright contra `npm run build` + `vite preview`, en Chrome 154.0.8037.99 y WebKit 26.4.
  Scripts y descargas en el scratchpad de la sesión (`qa-grow35/`).
- G6: build de c13458a en un worktree temporal (:4400) contra la rama (:4399), hash de los bytes.
- Mutaciones (a, b, c) restauradas con `git checkout --`. Worktree limpio al terminar.

## §Casos (1:1 con el Gherkin del §QUÉ)
| # | Criterio | Resultado | Evidencia real |
|---|---|---|---|
| C1 | Sin WebP nativo, «Sticker WhatsApp» → RIFF/VP8X con alfa, esquinas 0, 512², ≤100 KB, `*.webp` | CUMPLE | WebKit E2E: `photocut-transparent.webp` webp 512x512 25,2 KB corners=0,0,0,0, VP8X+alfa. Harness `webp-test [webkit]` `ruta=wasm` 30,3 KB, todo PASS. Chrome: 25,6 KB, ídem. |
| C2 | Chip WebP sin preset y pestaña Archivo → WebP real | CUMPLE | WebKit: Transparente/WEBP 65 828 B VP8X+alfa; Archivo WebP `Imagen actual.webp` magic=webp. `reencode-test [webkit]`: «webp: el resultado ES WebP». |
| C3 | Falla el encoder → no se descarga nada y aviso en el idioma de la UI | CUMPLE | WebKit, `.wasm` bloqueado con `ctx.route` (y SW bloqueado, ver nota): es/en/pt → download=null, toast exacto en cada idioma, panel intacto (preset WhatsApp, WEBP, Transparente). Archivo bloqueado → sin descarga y con aviso. Al desbloquear, el reintento da `.webp` real (el init es reintentable). |
| C3b | >16383 px | CUMPLE (jest) | `webpWasm.test.js`: acepta 16383 y rechaza 16384 sin tocar el WASM. `useExport.test.js`: error «supera 16383 px» → sin descarga y aviso. |
| C4 | Chrome: bytes idénticos a main (G6) y ningún request a `.wasm` | CUMPLE | Hashes main = rama: Transp/PNG 50a8b5f7ba88606b, Color/PNG 2453ec3d7e2d5c46, Color/JPEG 2cc4ff79077b0569, Transp/WEBP 15cb58de771f5ee9, Color/WEBP 8b65c70bd2512aad, Desenfoque/PNG c25bb18499db01e7. En Chrome, wasm=[] en todo el recorrido (sticker, 5 formatos y Archivo). |
| C5 | Nombre == magic bytes para PNG/JPEG/WebP | CUMPLE | En los dos motores, editor (Transp PNG/WEBP, Color PNG/JPEG/WEBP) y Archivo (WebP/PNG/JPG): extensión = magic = formato pedido. Jest 3×3 «pida lo que pida». |
| C6 | D2: Sticker WhatsApp → Original devuelve el formato previo, con aviso | CUMPLE | Chrome y WebKit: vuelve PNG + toast «Volvió tu formato: PNG». Jest: 4 casos. |
| C7 | `test:web` con corrida WebKit | CUMPLE | `webp-test [webkit]` y `reencode-test [webkit]` ALL_DONE, «✓ todo verde», EXIT 0. CI instala WebKit. |
| C8 | Guía re-medida en WebKit o caveat | CUMPLE | ES/EN/PT: «Chrome 154.0.8037.99 + WebKit 26.4», 20,2 KB (Chrome) y 19,9 KB (WebKit), iguales a `scripts/pruebas.json`. El caveat dice «WebKit de Playwright… no en un iPhone ni en Safari reales». |
| C9 | Privacidad: 0 requests fuera del origen en el export WebP en WebKit | CUMPLE | Harness (página de test): checkWebkit sin foreign. Build: los únicos externos son los 12 de AdSense/adtrafficquality de la página, que ya estaban en main; ninguno viene del encoder (el `.wasm` sale de localhost). |
| A1 | Archivo fuera del hilo principal y gana la última | CUMPLE | WebKit, 4000×3000, 5 movimientos de slider: solo 2 posts al worker [0.7, 0.15] (gana 0.15). El encode de 12 MP tarda ~5,5 s en el worker. Peor bloqueo del hilo principal: **202 ms** (gaps >100: 143, 145, 202), que corresponden a drawImage+getImageData y no al encode. Comparación: main en WebKit 3349 ms; la rama con JPG nativo, 354 ms. El PerformanceObserver de longtask no emite entradas en WebKit: lo medí con un heartbeat de 16 ms. |
| A3/A4/licencias/D3 | — | CUMPLE | `optimizeDeps.exclude` presente; `toWebpQuality` con it.each. Licencias: ver H-04. D3: el grep del plan sobre ROADMAP da vacío (queda «retirado en GROW-34», que es el texto que prescribe el plan). |

### Mutaciones (prueba de rojo)
- **M-a** `canvasToBlob` fuerza el camino nativo: jest canvasToBlob 4/6 fallan; `webp-test [webkit]` FAIL («sticker: png 199,2 KB q=0.32»), runner EXIT 1. Muere.
- **M-b** extensión por formato pedido: en useExport fallan 4 tests; en useReencode falla 1. Muere.
- **M-c2** sin memo del worker (`if (worker) return worker` comentado): falla «no crea el worker hasta el primer encode y después lo reutiliza». Muere.
- **M-c3** sin `latestRunner` en useReencode: falla «con una en vuelo… corre solo la última». Muere.
- **M-c1** worker ansioso (se crea al cargar el módulo): **sobrevive** (10/10). Ver H-02.
- **M-c4** `import` estático de `@jsquash/webp/encode.js` usado en webpWasm: el wrapper del encoder entra en el chunk `editor-*.js` (Vite avisa «dynamic import will not move module») y la guarda `webp-lazy` **pasa**. El glue (`webp_enc*.js`) y el `.wasm` siguen diferidos. Ver H-02.

### TDD (P-18)
- Hay prueba de rojo: gate PASS más las mutaciones de arriba.
- Aserciones: no se quitó ni se aflojó ninguna. La única `-assert` del diff es el regex de `browser` en `pruebas.test.mjs`, ampliado de forma estricta a «+ WebKit X.Y» (desvío e). Se agregó una aserción nueva. `reencode-test` WebP pasa de SKIP a aserción, o sea que se endureció.
- Cobertura de jest: latestRunner 100 %, webpEncoder 100 % líneas, webpWasm 100 %, webpWorker 100 %, useReencode 89,5 %, useExport 80 % (las líneas sin cubrir son portapapeles e imagen de fondo, que ya existían).
- Suites: jest 293/293, node --test 67/67, test:web «✓ todo verde».

## §GAP
**Especificado:** C1–C9, A1–A4, D2, D3, licencias.
**Deducido (para que lo valide el PO; no son casos de prueba):**
- G-1: WhatsApp → Telegram → Original devuelve el formato de ANTES del primer sticker (useExport.js `formatBeforePreset`). Es razonable.
- G-2: en Archivo, si el encoder no está disponible, sale un toast por cada estimación (vi 2 toasts iguales con el `.wasm` bloqueado y solo cambiar a WebP). Puede ser ruido si el usuario mueve el slider sin conexión.
- G-3: `npm run licenses` sumó `onnxruntime-web` y `@tauri-apps/plugin-opener`, que faltaban (desvío f). Es alcance extra, pero correcto.
- G-4: la ruta de la licencia libwebp sale como texto en AboutModal, no como enlace.
**Definido sin implementar:** ninguno, salvo A5 (smoke en escritorio), declarado NO VERIFICADO.

## §Defectos / hallazgos
| ID | Sev. | Evidencia | Criterio |
|---|---|---|---|
| H-01 | BAJA (proceso) | Los desvíos a–f del dev están solo en su handoff, no en `engram/qa/_debt.md`. `_debt.md` tiene exactamente el bloque de la Task 14 (riesgos, Safari/iOS reales, CI Linux, A5 NO VERIFICADO). | Handoff QA punto 9: el orquestador los transcribe al cierre |
| H-02 | BAJA (test débil) | M-c1 y M-c4 sobreviven. La guarda `webp-lazy.test.mjs` solo busca `from "./webp_enc` y no detecta el wrapper `encode.js` metido en el chunk de entrada. El `.wasm` y el glue siguen diferidos, así que el impacto real es de unos KB. | A1/§CÓMO guarda lazy → deuda: endurecer la guarda (p. ej. que `target_PSNR` o `@jsquash` no aparezcan en el chunk de entrada) y testear que no se crea ningún Worker al importar |
| H-03 | INFO (herramienta) | Con el Service Worker activo, en WebKit de Playwright `ctx.route` no intercepta lo que pide el SW: el `.wasm` llegó igual y se descargó el `.webp`. Con `serviceWorkers:"block"` el camino de error se comporta como corresponde. No es un defecto del producto: sw.js no precachea `webp_enc` (solo hace runtime cache). | Nota para futuras pruebas de fallo de red |
| H-04 | INFO | `public/licenses/libwebp-COPYING.txt` = COPYING de v1.1.0 (líneas 1–30) + PATENTS de v1.1.0 (31–53), ambos idénticos byte a byte a los de upstream. | Licencias OK |
| H-05 | INFO | `engram/01_requirements.md:15` todavía dice «F-07 Sticker Studio · Oculto tras feature flag». Queda fuera de D3, que se limita a ROADMAP. | Deuda de docs |

## Alcance
`git diff c13458a --stat`: 43 archivos, todos dentro del mapa del plan. En package.json solo se agrega `@jsquash/webp: 1.5.0` (exacto). En el lock: @jsquash/webp 1.5.0 y wasm-feature-detect 1.9.0, más la versión raíz del lock sincronizada 0.1.1→0.1.4 (package.json ya era 0.1.4 en main). `npm ci --dry-run` OK. `git merge-tree --write-tree main HEAD` limpio (856adfe), con main = c13458a.

## Riesgos (no bloquean; ya están en _debt.md)
A5 escritorio NO VERIFICADO. Safari/iOS reales no probados. En CI Linux la ruta WASM puede no ejercitarse (`ruta=wasm` se exige solo en darwin). libwebp 1.1.0. Pesos distintos según el motor. En el camino inline (Safari < 16.4) la composición sigue en el hilo principal.

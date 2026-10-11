# QA GROW-35 — WebP real en todos los navegadores (nerv-qa, 2026-10-11)

## Veredicto: **APROBADO (Strong)** · rama `feat/GROW-35-webp-real` HEAD 3759539 (base c13458a)

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

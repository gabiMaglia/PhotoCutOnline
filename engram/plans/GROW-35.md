# Plan — GROW-35 · WebP real en todos los navegadores

**Nivel (P-11):** Adversarial (declarado de entrada). Nace del rechazo de nerv-verifier sobre GROW-34
(qa/GROW-34-verifier.md, D1 ALTA): en WebKit el preset «Sticker WhatsApp» descarga un PNG con extensión
`.webp`. Ticket nuevo, pero integra una dependencia externa y cambia el contrato del punto único de
exportación: se trata como X y lleva §QUÉ + §CÓMO estampados ANTES del código (P-19.3).

**Decisión del PO (2026-10-10, chat):** entre «codificador WebP propio» / «aviso honesto + PNG» /
«ocultar WebP en Safari», eligió **codificador WebP propio, cargado bajo demanda**. Diseño de abajo
presentado en chat y aprobado por el PO («se» = sí, 2026-10-10).

## QUÉ — diseño

### Problema (medido)
- WebKit 26.4 (Playwright) devuelve `image/png` para `toDataURL/toBlob/convertToBlob('image/webp')`, en
  el hilo principal y en workers. Chromium 148 devuelve `image/webp`. (spike GROW-35, scratchpad spike35)
- El editor nombra el archivo con el formato PEDIDO (`useExport.js:67-68,105-106`) y `jsEngine.js:986-987`
  no valida el tipo devuelto. Resultado en Safari: PNG con extensión `.webp`, aviso de 100 KB engañoso
  (`fitWithinBytes` baja una calidad que el PNG ignora), y la guía de stickers miente.
- Mismo defecto en la pestaña Archivo (`metadata.js:197-218 reencodeToBlob`) y en el chip WebP de
  Exportar. No aplica a Lote (`useBatch.js:35`, solo PNG) ni a Filtros/Texto/Anotar/Caras/Marca de
  agua/Color (solo PNG/JPEG, verificado en el spike).

### Enfoque (la solución como un todo)
Una sola idea: **el archivo que se descarga dice lo que realmente es, y WebP se obtiene de verdad en
cualquier navegador.**

1. **Módulo nuevo `src/lib/webpEncoder.js`** — única unidad que sabe de WASM:
   - `canEncodeWebP(): Promise<boolean>` — detecta UNA vez si el navegador codifica WebP (OffscreenCanvas
     con `getContext("2d")` previo —sin él Chromium tira InvalidStateError y daría falso negativo— y
     fallback a `toDataURL`). Memoizado.
   - `encodeWebP(imageData, quality01): Promise<Blob>` — import dinámico de `@jsquash/webp/encode.js`
     (SOLO el encoder; Apache-2.0 sobre libwebp BSD-3), `init()` una vez, devuelve `Blob` `image/webp`.
   - Dependencias: `@jsquash/webp@1.5.0` (+ `wasm-feature-detect`). Sin SharedArrayBuffer ni threads ⇒
     no exige COOP/COEP. Peso: ~110 KB brotli (SIMD o no-SIMD, se baja uno), solo en navegadores sin
     soporte nativo y solo la primera vez; sw.js lo cachea (regex IMMUTABLE ya cubre `.wasm`).
2. **Los dos puntos donde se generan archivos lo usan**, nadie más:
   - `jsEngine.canvasToBlob` (cuello de botella de exportTransparent/Solid/ImageBg/BlurBg, worker o inline):
     si `mime === "image/webp"` y `!canEncodeWebP()` ⇒ `getImageData` + `encodeWebP`. En todos los casos
     devuelve el blob con su **tipo REAL**.
   - `metadata.reencodeToBlob` (pestaña Archivo): misma regla.
3. **El tipo real manda aguas arriba:** `useExport` (extensión, analítica, aviso de peso) y `useReencode`
   (extensión de descarga, estimación) derivan el formato de `blob.type`, no del formato pedido.
   Si por cualquier motivo sale PNG, se descarga `.png` y se avisa: nunca un archivo con extensión falsa.
4. **Tope de 100 KB del sticker:** `fitWithinBytes` sin cambios de lógica; ahora los bytes salen del
   encoder WASM en Safari, así que bajar calidad vuelve a tener efecto real.
5. **D2 (verifier):** el formato que impone un preset de sticker (`lockedFormat`) se revierte al formato
   previo del usuario al salir del preset (Original u otro preset); si el formato cambia por un preset,
   aviso igual al de fondo (O3 de GROW-34).
6. **D3 (verifier):** quitar Sticker Studio / `STICKERS_ENABLED` de `docs/ROADMAP.md`.
7. **Licencias:** libwebp (BSD-3-Clause, Google) y @jsquash/webp (Apache-2.0) en la salida de
   `npm run licenses` (scripts/gen-licenses.mjs) y en lo que el sitio publique de licencias de terceros.

### Errores
- Encoder no descargable (offline la primera vez, error de instanciación): **no** se descarga nada con
  nombre falso; toast es/en/pt «No se pudo preparar el WebP. Reintentá con conexión o elegí PNG» y el
  export se aborta limpio (estado del panel intacto).
- Encoder lanza en `encode`: mismo tratamiento.
- Navegador con soporte nativo: camino actual intacto, el WASM nunca se pide.

### Contratos que cambian
- `canvasToBlob(...)` y `reencodeToBlob(...)` pueden ser `async` en el camino WebP sin soporte; quien los
  llama ya espera Promises (verificar en §CÓMO). El tipo del Blob devuelto pasa a ser la fuente de verdad
  del formato para la UI.
- Sin cambios en `backend.js` salvo propagar el tipo si hiciera falta (§CÓMO lo determina).

### Pruebas (criterios de aceptación, Gherkin resumido)
- Dado un navegador SIN WebP nativo (WebKit en el harness, y jest con `canEncodeWebP` mockeado a false),
  cuando exporto con «Sticker WhatsApp», entonces el archivo empieza con `RIFF....WEBPVP8X`, tiene flag
  alpha, esquinas alpha 0, 512×512, ≤100 KB, y se llama `*.webp`.
- Ídem chip WebP de Exportar sin preset y pestaña Archivo → WebP.
- Dado que el encoder falla, cuando exporto WebP, entonces no se descarga ningún archivo y aparece el
  aviso en el idioma de la UI.
- Dado Chrome (WebP nativo), cuando exporto cualquier formato, entonces los bytes son idénticos a main
  (regresión G6) y no hay request al `.wasm`.
- Dado cualquier navegador, el nombre de archivo SIEMPRE coincide con los magic bytes del contenido
  (PNG/JPEG/WebP) — test que recorre los formatos.
- D2: Sticker WhatsApp → Original ⇒ vuelve el formato previo (+ aviso si cambió).
- Suite Chrome (`npm run test:web`) incorpora una corrida **WebKit** para los casos WebP (la que faltó en
  GROW-34). Guía de stickers ES/EN/PT: re-medir con el arnés en WebKit además de Chrome si el arnés lo
  permite; si no, documentarlo como límite en el caveat.
- Privacidad: en el harness, 0 requests fuera del origen durante un export WebP en WebKit.

### Fuera de alcance
Decoder WebP; precache del encoder para todos; CSP (no hay; si se agrega, `script-src 'wasm-unsafe-eval'`);
CVEs del encoder libwebp 1.1.0 (el decoder vulnerable a CVE-2023-4863 no se incluye) → anotar como riesgo.

**Aprobado por:** nerv-arquitecto · arquitecto · 2026-10-10 (con los ajustes OBLIGATORIOS A1–A5 de abajo)

### Revisión del arquitecto

Pasada hostil sobre el código de `main` (04ac077). Veredicto: **APROBADO con ajustes**. El enfoque (encoder
WASM bajo demanda + "el tipo real manda") es correcto y cubre todos los productores de WebP; los ajustes
cierran huecos que el §QUÉ deja abiertos y son vinculantes para el §CÓMO.

**1. Cobertura de productores de WebP — completa.** grep de `image/webp|toBlob|convertToBlob|toDataURL`
en `src/`: los únicos que pueden emitir WebP son `jsEngine.canvasToBlob` (vía `composite`: 601/624/657;
549 es preview PNG) y `metadata.reencodeToBlob` (216). `stripToBlob` (metadata.js:238) pasa por
`reencodeToBlob` y hoy solo se llama con `image/jpeg` (MetadataPage.jsx:87), así que queda cubierto por
construcción. `imageFile.bitmapToDataUrl` (jpeg/png), `icons.js`, `utils/image.js` y los `toBlob` de
Filtros/Texto/Marca de agua/Anotar/Caras/Color son PNG/JPEG fijos. No hay otro productor.

**2. Worker / inline.** `worker.format: "es"` ya está en vite.config.js y el worker ya carga un `.wasm`
(photocut_wasm, ORT): el patrón está probado. getImageData en OffscreenCanvas 2D: WebKit lo soporta desde
16.4 (misma versión que OffscreenCanvas, que es la condición de `WORKER_OK`); el spike lo midió en worker.
La ruta inline (sin OffscreenCanvas = Safari < 16.4) usa HTMLCanvas en hilo principal: funciona, bloquea
~150 ms en 512² y segundos en "Original" grande — aceptable por ser legado, documentarlo.

**3. Contrato async — no rompe nada.** `canvasToBlob` y `reencodeToBlob` YA devuelven Promise en todas sus
ramas; todos los llamadores hacen `await` (useReencode 77/104, MetadataPage 87, backend `call("composite")`).
Ojo: `toBlob` puede resolver `null`; los llamadores ya lo toleran, el encoder WASM no debe devolver `null`
sino lanzar (camino de error del §QUÉ).

**4. Consumidores del formato.** Además de extensión y aviso: `trackEvent("export", {format})`
(useExport.js:115) y el filtro del diálogo Tauri (`save.js` lo deriva del nombre ⇒ se corrige solo si el
nombre sale del tipo real). `backend.exportUrlFrom` no nombra nada. `useReencode` usa
`OUTPUT_FORMATS[format].ext` (download) y `fmt.lossy/alpha` para la UI: el nombre debe salir de `blob.type`.

**Ajustes OBLIGATORIOS**
- **A1 — Pestaña Archivo fuera del hilo principal.** `useReencode` recodifica en CADA cambio de slider
  (debounce 220 ms) sobre el tamaño completo. `toBlob` nativo codifica fuera del hilo; el WASM de jSquash
  es síncrono una vez llamado: 512² ≈ 150 ms ⇒ una foto de 12 MP ≈ varios segundos de UI congelada por
  cada movimiento en Safari. `encodeWebP` llamado desde el hilo principal debe delegar en un worker
  dedicado y perezoso (`ImageData.data.buffer` transferido), y la estimación debe poder descartarse (el
  `runId` ya existe; además no lanzar una nueva codificación WASM mientras haya una en vuelo — la última
  gana). Dentro de cutoutWorker se llama directo. *Descartado:* subir el debounce — no evita el congelamiento.
- **A2 — El tipo real en el editor sin cambiar el contrato de `backend`.** `backend.export*` devuelve solo
  una URL y lo consumen 5 llamadores (useCutout, usePreviewPanel, useBatch, clipboard, useExport). No
  cambiar su forma de retorno: `useExport` obtiene el tipo con `(await fetch(url)).blob()` en ambos caminos
  (el de `fitWithinBytes` ya lo hace). Analítica y nombre (⇒ filtro Tauri) usan el formato real.
  *Descartado:* devolver `{url,type}` desde backend — rompe 4 llamadores ajenos al ticket.
- **A3 — Detección en el contexto que codifica.** `canEncodeWebP()` se memoiza POR contexto (worker y
  ventana por separado); nunca se pasa el resultado del hilo principal al worker. Vite: añadir
  `optimizeDeps.exclude: ["@jsquash/webp"]` (el spike lo necesitó; sin él el `.wasm` no resuelve en dev).
- **A4 — Límites del encoder = camino de error, nunca PNG.** WebP admite como máximo 16383 px por lado y la
  memoria WASM (32-bit, crece) puede agotarse en iOS con fotos grandes: si el encoder lanza o la imagen
  excede el límite, se aplica el tratamiento de "Errores" (toast, sin descarga). Agregar caso de prueba
  con dimensión > 16383 (jest, encoder mockeado). Mapeo de calidad explícito y testeado: `quality01 × 100`.
- **A5 — Desktop.** Tauri usa el MISMO motor JS (backend.js no tiene rama nativa de export) ⇒ en macOS
  (WKWebView) y Linux (WebKitGTK) se beneficia del fallback. La CSP de `src-tauri/tauri.conf.json` ya
  permite `'wasm-unsafe-eval'` y `connect-src 'self'`; el §CÓMO incluye un smoke de export WebP en
  `npm run tauri dev` en macOS o lo documenta como no verificado en el cierre (no "asumido").

**Riesgos aceptados (registrar, no bloquean):** alpha premultiplicado — `getImageData` des-premultiplica y
pierde precisión RGB en bordes de alfa muy bajo; es lo mismo que hace el camino nativo de Chromium, visualmente
nulo. Tamaños distintos al nativo de Chrome para la misma calidad: los tests de `fitWithinBytes` usan encoder
mockeado y los criterios exigen "≤100 KB", no bytes exactos; la guía de stickers no debe citar KB de un solo
motor como universales. libwebp 1.1.0 encode-only: la entrada son píxeles propios (no archivos de terceros),
superficie baja; anotar en `qa/_debt.md` para revisar al subir de versión.

**Alcance:** una sola entrega coherente. D3 es una línea de docs; D2 vive en el mismo `useExport` y en el
mismo flujo de sticker, pero en el §CÓMO va como paso **independiente** (paralelizable) de la cadena
serial `webpEncoder` (primitiva compartida) → `canvasToBlob`/`reencodeToBlob` → `useExport`/`useReencode`.
Si D2 retrasa la cadena WebP, se parte a ticket propio sin reabrir este §QUÉ.

## CÓMO — plan de implementación

**Plan de implementación GROW-35 — WebP real en todos los navegadores**

> **Para agentes:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans`, tarea por tarea. Los pasos usan casillas (`- [ ]`). TDD (P-18): el test
> va PRIMERO y tiene que FALLAR contra `main` antes de escribir el código. El gate vuelve a correr los
> tests nuevos contra el árbol previo y rechaza si pasan ahí. Por eso cada test nuevo afirma algo que hoy
> es falso. Prohibido aflojar una aserción para llegar a verde.

**Objetivo:** que el archivo descargado diga lo que realmente es y que WebP salga de verdad en cualquier
motor (WebKit incluido), con un encoder WASM que se carga bajo demanda.

**Arquitectura:** `webpWasm.js` es lo único que toca jSquash. Tiene los límites, el mapeo de calidad,
los errores y el encode directo. `webpEncoder.js` es la API pública: detecta el soporte nativo por
contexto y enruta el encode (en la ventana va a un worker dedicado y perezoso; dentro de un worker se
codifica directo). `jsEngine.canvasToBlob` y `metadata.reencodeToBlob` son los dos únicos productores de
WebP y lo usan cuando el canvas no sabe codificar. `useExport` y `useReencode` nombran, miden y avisan
según `blob.type`, no según el formato pedido.

**Stack:** React 18 + Vite 5 (MPA, `worker.format: "es"`), jest 29 + jsdom (unidad), harness Playwright
`playwright-core@1.60.0` (Chrome `channel:"chrome"` + WebKit de Playwright), `@jsquash/webp@1.5.0`
(Apache-2.0; libwebp 1.1.0 BSD-3-Clause adentro del `.wasm`; trae `wasm-feature-detect` Apache-2.0).

**Spec:** §QUÉ de este archivo, con los ajustes A1–A5 (vinculantes) más arriba. Evidencia:
`scratchpad/spike35/` (`src/webp.js` = detección + carga + encode verificados; runners `pw35.mjs`,
`det.mjs` y `swtest.mjs`).

**Restricciones globales** (cada tarea las incluye implícitamente):
- Rama `feat/grow-35-webp` creada desde `main` (04ac077 o posterior). Nada se commitea en `main`, y el
  merge lo hace el orquestador tras QA.
- Commits: en cada `git commit` va un segundo `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- `@jsquash/webp` se fija EXACTO en `1.5.0` (`--save-exact`). La deuda de libwebp 1.1.0 depende de esa versión.
- Solo se importa `@jsquash/webp/encode.js`, nunca el index ni el decoder (CVE-2023-4863 queda afuera).
- `canEncodeWebP()` se memoiza por módulo (= por contexto). Nunca se pasa al worker el resultado de la ventana (A3).
- Calidad: la UI y el canvas trabajan en 0–1 y libwebp recibe `Math.round(q01×100)` acotado a 0–100 (A4).
- Una dimensión de más de 16383 px, un OOM, un init fallido o un worker caído van al camino de error:
  toast es/en/pt, nada se descarga y el panel queda intacto. Nunca hay PNG con nombre `.webp` (A4).
- No se cambia la forma de retorno de `backend.export*` (sigue siendo una URL). El tipo real se obtiene con `fetch(url).blob()` (A2).
- Regla del repo: canvas siempre montado (no aplica: no hay `<canvas>` nuevo en JSX). Tras tocar páginas
  van `npm run lastmod` y un commit del json con `[lastmod-skip]`. `npm test` y `npm run test:web` son
  obligatorios antes de entregar. Después de cualquier `push`, revisar el CI.
- `npm test` usa `dist/` vía `ensureDist` y NO reconstruye si ya existe: corré `npm run build` antes de
  `npm test` cada vez que cambie algo del bundle (Tasks 2 y 8).
- P-1.6: la API de jSquash está verificada leyendo `node_modules/@jsquash/webp/encode.js` (spike) y el
  CLI `playwright-core install [--with-deps] webkit` con `--help` (1.60.0). Antes de Task 2, consultá en
  Context7 (Vite, "worker", "new URL import.meta.url nested worker") y antes de Task 8 (Playwright,
  "BrowserContext request event workers"). Si los docs contradicen el plan, frená y devolvé al orquestador.
- P-22: este repo no tiene `engram/09_codemap.md` ni `bin/nerv-index.sh` (verificado). Los módulos nuevos
  se listan en el handoff de retorno para que el orquestador los registre si crea el codemap.
- React law: no hay componentes nuevos. Los avisos usan el `toast`/`onToast` que ya existen, sin `t()` en reusables.

**Mapa de archivos**

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/webpWasm.js` | crear | Límite 16383, mapeo de calidad, `WebpEncodeError` e `isWebpEncodeError`, `encodeWebPDirect` (import dinámico de jSquash, init una vez con reintento si falla) |
| `src/lib/webpEncoder.js` | crear | `canEncodeWebP()` memoizado por contexto y `encodeWebP()` (ventana → worker perezoso; worker → directo); re-exporta `isWebpEncodeError` |
| `src/lib/webpWorker.js` | crear | Worker dedicado de la ventana: recibe píxeles transferidos y devuelve bytes WebP transferidos |
| `src/lib/latestRunner.js` | crear | Una tarea por vez, gana la última y las intermedias se descartan (A1, estimación de Archivo) |
| `src/lib/jsEngine.js:986-997` | modificar | `canvasToBlob`: WebP sin soporte nativo pasa por `getImageData` + `encodeWebP` |
| `src/lib/metadata.js:147-218` | modificar | `formatFromMime()` y `reencodeToBlob` con la misma regla |
| `src/features/cutout/hooks/useExport.js` | modificar | Tipo real (nombre, analítica, aviso), error WebP y D2 |
| `src/features/metadata/hooks/useReencode.js` | modificar | Tipo real en la descarga, `latestRunner` en la estimación, errores vía `onToast` |
| `src/features/metadata/MetadataPage.jsx:33` | modificar | Pasa `onToast` a `useReencode` |
| `src/lib/i18n.js` | modificar | 4 claves × es/en/pt |
| `vite.config.js` | modificar | `optimizeDeps.exclude: ["@jsquash/webp"]` (A3) |
| `test/webp-test.html` y `test/webp-test.js` | crear | Bytes reales en Chrome y WebKit |
| `test/reencode-test.js:76-84` | modificar | WebP pasa de SKIP a aserción |
| `test/run-tests.mjs` | modificar | Segunda corrida WebKit + chequeo de requests |
| `.github/workflows/ci.yml` | modificar | Instala WebKit de Playwright |
| `scripts/lib/webp-lazy.test.mjs` | crear | Guarda del build: el encoder no viaja en la carga inicial |
| `scripts/gen-licenses.mjs`, `scripts/licenses.test.mjs`, `src/generated/licenses.json`, `public/licenses/libwebp-COPYING.txt` | crear/modificar | Licencias |
| `docs/ROADMAP.md:25-26,117-118` | modificar | D3 |
| `scripts/pruebas/lib.mjs`, `scripts/pruebas/tests-d.mjs`, `scripts/pruebas.json`, 3 guías de stickers | modificar | Re-medición Chrome + WebKit y copy |
| `engram/qa/_debt.md`, `scripts/lastmod.json` | modificar | Cierre |

---

### Task 1: Primitiva WASM y detección (`webpWasm.js` y `canEncodeWebP`)

**Archivos:**
- Crear: `src/lib/webpWasm.js`, `src/lib/webpWasm.test.js`, `src/lib/webpEncoder.js` (solo `canEncodeWebP` en esta tarea), `src/lib/webpEncoder.test.js`
- Modificar: `package.json` y `package-lock.json` (dependencia), `vite.config.js`

**Interfaces que produce** (las usan las tareas 2 a 8):
- `webpWasm.js`: `WEBP_MAX_DIM = 16383`, `WEBP_ERROR = "WEBP_ENCODE_FAILED"`,
  `class WebpEncodeError extends Error` (mensaje `"WEBP_ENCODE_FAILED: <motivo>"`),
  `isWebpEncodeError(e|string): boolean`, `toWebpQuality(q01 = 0.92): number /*0..100*/`,
  `encodeWebPDirect(imageData:{data,width,height}, q01): Promise<Blob /*image/webp*/>`, `_resetWasmForTests()`.
- `webpEncoder.js`: `canEncodeWebP(): Promise<boolean>`, `_resetForTests()`.

- [ ] **Paso 1: rama y dependencia**

```bash
git switch -c feat/grow-35-webp
npm i @jsquash/webp@1.5.0 --save-exact
npm ls @jsquash/webp wasm-feature-detect
```
Esperado: `@jsquash/webp@1.5.0` y `wasm-feature-detect@1.x` (el spike resolvió la 1.9.0).

- [ ] **Paso 2: escribir los tests que fallan.** Archivo `src/lib/webpWasm.test.js`:

```js
jest.mock("@jsquash/webp/encode.js", () => ({
  __esModule: true,
  init: jest.fn(async () => ({})),
  default: jest.fn(async () => new Uint8Array([82, 73, 70, 70]).buffer),
}));
import * as jsq from "@jsquash/webp/encode.js";
import {
  encodeWebPDirect, toWebpQuality, isWebpEncodeError, WEBP_MAX_DIM, _resetWasmForTests,
} from "./webpWasm.js";

const img = (w = 4, h = 4) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const failure = (p) => p.then(() => null, (e) => e);

beforeEach(() => {
  jest.clearAllMocks();
  _resetWasmForTests();
});

describe("toWebpQuality: 0–1 del canvas → 0–100 de libwebp (A4)", () => {
  it.each([[0, 0], [1, 100], [0.92, 92], [0.82, 82], [0.3, 30], [1.4, 100], [-0.2, 0], [undefined, 92], [NaN, 92]])(
    "%p → %p",
    (q, want) => expect(toWebpQuality(q)).toBe(want)
  );
});

describe("encodeWebPDirect", () => {
  it("codifica con la calidad mapeada y devuelve un Blob image/webp", async () => {
    const b = await encodeWebPDirect(img(), 0.72);
    expect(jsq.default).toHaveBeenCalledWith(expect.objectContaining({ width: 4, height: 4 }), { quality: 72 });
    expect(b.type).toBe("image/webp");
    expect(b.size).toBe(4);
  });

  it("inicializa el WASM una sola vez", async () => {
    await encodeWebPDirect(img(), 0.9);
    await encodeWebPDirect(img(), 0.9);
    expect(jsq.init).toHaveBeenCalledTimes(1);
  });

  it(`acepta ${WEBP_MAX_DIM} px y rechaza ${WEBP_MAX_DIM + 1} sin tocar el WASM`, async () => {
    await encodeWebPDirect({ width: WEBP_MAX_DIM, height: 1, data: new Uint8ClampedArray(0) }, 0.9);
    jest.clearAllMocks();
    _resetWasmForTests();
    const e = await failure(encodeWebPDirect({ width: WEBP_MAX_DIM + 1, height: 900, data: new Uint8ClampedArray(0) }, 0.9));
    expect(isWebpEncodeError(e)).toBe(true);
    expect(jsq.init).not.toHaveBeenCalled();
    expect(jsq.default).not.toHaveBeenCalled();
  });

  it("si el encoder lanza (OOM en iOS) devuelve un error WebP, nunca un blob", async () => {
    jsq.default.mockRejectedValueOnce(new Error("RuntimeError: memory access out of bounds"));
    const e = await failure(encodeWebPDirect(img(), 0.9));
    expect(isWebpEncodeError(e)).toBe(true);
  });

  it("si el init falla (offline la 1ª vez) el próximo intento lo vuelve a pedir", async () => {
    jsq.init.mockRejectedValueOnce(new Error("Failed to fetch"));
    expect(isWebpEncodeError(await failure(encodeWebPDirect(img(), 0.9)))).toBe(true);
    const b = await encodeWebPDirect(img(), 0.9);
    expect(b.type).toBe("image/webp");
    expect(jsq.init).toHaveBeenCalledTimes(2);
  });
});

describe("isWebpEncodeError (el error cruza el worker como texto)", () => {
  it("reconoce la marca en Error o en string, y nada más", () => {
    expect(isWebpEncodeError(new Error("WEBP_ENCODE_FAILED: encode: x"))).toBe(true);
    expect(isWebpEncodeError("Error: WEBP_ENCODE_FAILED: load")).toBe(true);
    expect(isWebpEncodeError(new Error("No hay recorte para exportar"))).toBe(false);
    expect(isWebpEncodeError(undefined)).toBe(false);
  });
});
```

Archivo `src/lib/webpEncoder.test.js` (en esta tarea solo con el bloque de detección; la Task 2 le agrega el router):

```js
import { canEncodeWebP, _resetForTests } from "./webpEncoder.js";

function fakeOffscreen(returns) {
  const calls = { convert: 0 };
  global.OffscreenCanvas = class {
    getContext() {
      this.ctx = true;
      return {};
    }
    async convertToBlob({ type }) {
      calls.convert++;
      // Chromium lanza InvalidStateError si nunca se pidió un contexto
      if (!this.ctx) throw new DOMException("no context", "InvalidStateError");
      if (returns === "throw") throw new Error("boom");
      return new Blob([], { type: returns ?? type });
    }
  };
  return calls;
}

afterEach(() => {
  delete global.OffscreenCanvas;
  _resetForTests();
  jest.restoreAllMocks();
});

describe("canEncodeWebP: detección en el contexto que codifica (A3)", () => {
  it("Chromium (devuelve image/webp, con contexto 2D previo) → true", async () => {
    fakeOffscreen("image/webp");
    expect(await canEncodeWebP()).toBe(true);
  });
  it("WebKit (pide WebP y devuelve PNG) → false", async () => {
    fakeOffscreen("image/png");
    expect(await canEncodeWebP()).toBe(false);
  });
  it("memoiza: dos consultas, una sola sonda", async () => {
    const calls = fakeOffscreen("image/webp");
    await canEncodeWebP();
    await canEncodeWebP();
    expect(calls.convert).toBe(1);
  });
  it("si la sonda lanza → false (se usa el encoder propio)", async () => {
    fakeOffscreen("throw");
    expect(await canEncodeWebP()).toBe(false);
  });
  it("sin OffscreenCanvas (Safari < 16.4) mira toDataURL", async () => {
    const real = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "canvas" ? { toDataURL: () => "data:image/png;base64,AAAA" } : real(tag)
    );
    expect(await canEncodeWebP()).toBe(false);
  });
});
```

- [ ] **Paso 3: verificar que fallan.** Corré `npx jest src/lib/webpWasm.test.js src/lib/webpEncoder.test.js`.
Esperado: FAIL con `Cannot find module './webpWasm.js'` / `'./webpEncoder.js'`.

- [ ] **Paso 4: implementar.** Archivo `src/lib/webpWasm.js`. La carga, el `init()` y el encode
**están verificados en el spike** (`spike35/src/webp.js`: `loadJsquash` / `encodeJsquash`, en Chromium
148 y WebKit 26.4, hilo principal y worker, con alfa y caché offline del SW). El límite, los errores y
el reintento del init **no están verificados en navegador**; los cubren los tests de jest de arriba.

```js
// Codificador WebP propio (GROW-35). WebKit devuelve PNG cuando se le pide
// WebP al canvas, así que en ese caso los bytes los produce libwebp en WASM.
// Es el único módulo que toca jSquash, y solo su encoder: el decoder trae
// la superficie de CVE-2023-4863 y no lo necesitamos.

export const WEBP_MAX_DIM = 16383; // máximo del formato por lado
export const WEBP_ERROR = "WEBP_ENCODE_FAILED";

export class WebpEncodeError extends Error {
  constructor(reason) {
    super(`${WEBP_ERROR}: ${reason}`);
    this.name = "WebpEncodeError";
  }
}

// El error cruza workers como texto (postMessage), así que se reconoce por la marca.
export function isWebpEncodeError(e) {
  return String(e?.message ?? e ?? "").includes(WEBP_ERROR);
}

export function toWebpQuality(q01 = 0.92) {
  const q = Number.isFinite(q01) ? q01 : 0.92;
  return Math.round(Math.min(1, Math.max(0, q)) * 100);
}

let encoderLoad = null;
function loadEncoder() {
  encoderLoad ??= import("@jsquash/webp/encode.js")
    .then(async (m) => {
      await m.init();
      return m.default;
    })
    .catch((e) => {
      encoderLoad = null; // sin red la primera vez: el reintento vuelve a pedirlo
      throw e;
    });
  return encoderLoad;
}

export async function encodeWebPDirect(imageData, quality01) {
  const { width, height } = imageData;
  if (width > WEBP_MAX_DIM || height > WEBP_MAX_DIM)
    throw new WebpEncodeError(`${width}×${height} supera ${WEBP_MAX_DIM} px`);
  let encode;
  try {
    encode = await loadEncoder();
  } catch (e) {
    throw new WebpEncodeError(`load: ${e?.message || e}`);
  }
  try {
    const buf = await encode(imageData, { quality: toWebpQuality(quality01) });
    return new Blob([buf], { type: "image/webp" });
  } catch (e) {
    throw new WebpEncodeError(`encode: ${e?.message || e}`);
  }
}

export function _resetWasmForTests() {
  encoderLoad = null;
}
```

Archivo `src/lib/webpEncoder.js` (versión de la Task 1; la sonda **está verificada** en el spike:
`spike35/src/webp.js#canEncodeWebP` y `det.mjs`, que muestra que sin `getContext` Chromium tira
`InvalidStateError` también en el worker):

```js
// API pública del WebP: ¿el canvas de ESTE contexto codifica WebP?, y si no,
// el encoder propio. Ventana y workers cargan cada uno su copia del módulo,
// así que el memo es por contexto (A3): no se pasa lo de uno al otro.
import { isWebpEncodeError } from "./webpWasm.js";

export { isWebpEncodeError };

let nativeProbe = null;

export function canEncodeWebP() {
  nativeProbe ??= probeNative();
  return nativeProbe;
}

async function probeNative() {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const oc = new OffscreenCanvas(1, 1);
      oc.getContext("2d"); // sin contexto Chromium lanza y daría un falso negativo
      const b = await oc.convertToBlob({ type: "image/webp" });
      return b.type === "image/webp";
    }
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export function _resetForTests() {
  nativeProbe = null;
}
```

En `vite.config.js`, dentro del objeto que devuelve `defineConfig`, junto a `worker:`:

```js
    optimizeDeps: {
      // el pre-bundle de Vite rompe la URL del .wasm de jSquash en dev (spike GROW-35)
      exclude: ["@jsquash/webp"],
    },
```

- [ ] **Paso 5: verificar que pasan.** Corré `npx jest src/lib/webpWasm.test.js src/lib/webpEncoder.test.js`.
Esperado: PASS (20 tests).

- [ ] **Paso 6: commit**

```bash
git add package.json package-lock.json vite.config.js src/lib/webpWasm.js src/lib/webpWasm.test.js src/lib/webpEncoder.js src/lib/webpEncoder.test.js
git commit -m "feat(webp): encoder WASM bajo demanda y detección por contexto (GROW-35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Worker dedicado y perezoso para la ventana (A1)

**Archivos:**
- Crear: `src/lib/webpWorker.js`, `src/lib/webpWorker.test.js`, `src/lib/webpEncoder.node.test.js`
- Modificar: `src/lib/webpEncoder.js` (le agrega `encodeWebP`), `src/lib/webpEncoder.test.js` (le agrega el bloque del router)

**Interfaces:**
- Consume: `encodeWebPDirect`, `WebpEncodeError`, `isWebpEncodeError` (Task 1).
- Produce: `encodeWebP(imageData, q01 = 0.92): Promise<Blob /*image/webp*/>`. **Consume** el
  `ImageData` (su buffer se transfiere y queda inutilizable en la ventana). Rechaza siempre con un error
  que cumple `isWebpEncodeError`.
- Protocolo del worker: entra `{id, width, height, buffer, quality}` (buffer transferido) y sale
  `{id, ok:true, buffer}` (transferido) o `{id, ok:false, error:string}`.

- [ ] **Paso 1: Context7.** Buscá en Vite el patrón `new Worker(new URL(...), {type:"module"})` y los
workers anidados. `cutoutWorker` importa `jsEngine`, que importa `webpEncoder`, que contiene
`new Worker(...)`, y Vite lo emite como worker anidado. Confirmá que Vite 5 lo soporta con `worker.format: "es"`.

- [ ] **Paso 2: escribir los tests que fallan.** Agregá al final de `src/lib/webpEncoder.test.js`
(sumá `encodeWebP` e `isWebpEncodeError` al import del principio):

```js
class FakeWorker {
  static instances = [];
  constructor(url, opts) {
    this.url = String(url);
    this.opts = opts;
    this.posted = [];
    FakeWorker.instances.push(this);
  }
  postMessage(msg, transfer) {
    this.posted.push({ msg, transfer });
  }
  reply(i, data) {
    this.onmessage({ data: { id: this.posted[i].msg.id, ...data } });
  }
}
const img = () => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) });

describe("encodeWebP en la ventana: worker dedicado y perezoso (A1)", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    global.Worker = FakeWorker;
  });
  afterEach(() => delete global.Worker);

  it("no crea el worker hasta el primer encode y después lo reutiliza", async () => {
    expect(FakeWorker.instances).toHaveLength(0);
    const p = encodeWebP(img(), 0.8);
    const w = FakeWorker.instances[0];
    expect(w.url).toMatch(/webpWorker\.js/);
    expect(w.opts).toEqual({ type: "module" });
    w.reply(0, { ok: true, buffer: new Uint8Array([1, 2, 3]).buffer });
    const b = await p;
    expect(b.type).toBe("image/webp");
    expect(b.size).toBe(3);
    encodeWebP(img(), 0.8);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("transfiere el buffer de píxeles (no lo copia) y manda la calidad 0–1", () => {
    const im = img();
    encodeWebP(im, 0.8);
    const { msg, transfer } = FakeWorker.instances[0].posted[0];
    expect(transfer).toEqual([im.data.buffer]);
    expect(msg).toMatchObject({ width: 4, height: 4, quality: 0.8 });
  });

  it("un fallo dentro del worker llega como error WebP reconocible", async () => {
    const p = encodeWebP(img(), 0.8);
    FakeWorker.instances[0].reply(0, { ok: false, error: "WEBP_ENCODE_FAILED: encode: OOM" });
    expect(isWebpEncodeError(await p.catch((e) => e))).toBe(true);
  });

  it("si el worker muere (chunk sin red) rechaza lo pendiente y el próximo encode crea otro", async () => {
    const p = encodeWebP(img(), 0.8);
    FakeWorker.instances[0].onerror({ message: "load failed" });
    expect(isWebpEncodeError(await p.catch((e) => e))).toBe(true);
    encodeWebP(img(), 0.8);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("sin module workers (new Worker lanza) → error WebP, no una excepción suelta", async () => {
    global.Worker = class {
      constructor() {
        throw new TypeError("module workers not supported");
      }
    };
    expect(isWebpEncodeError(await encodeWebP(img(), 0.8).catch((e) => e))).toBe(true);
  });
});
```

`src/lib/webpEncoder.node.test.js` (sin `document`, como dentro de `cutoutWorker`):

```js
/** @jest-environment node */
jest.mock("./webpWasm.js", () => ({
  ...jest.requireActual("./webpWasm.js"),
  encodeWebPDirect: jest.fn(async () => new Blob([new Uint8Array(3)], { type: "image/webp" })),
}));
const { encodeWebPDirect } = require("./webpWasm.js");
const { encodeWebP } = require("./webpEncoder.js");

it("dentro de un worker (sin document) codifica directo, sin crear otro worker", async () => {
  global.Worker = jest.fn();
  const im = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
  const b = await encodeWebP(im, 0.6);
  expect(encodeWebPDirect).toHaveBeenCalledWith(im, 0.6);
  expect(global.Worker).not.toHaveBeenCalled();
  expect(b.type).toBe("image/webp");
});
```

`src/lib/webpWorker.test.js`:

```js
/** @jest-environment node */
jest.mock("./webpWasm.js", () => ({ ...jest.requireActual("./webpWasm.js"), encodeWebPDirect: jest.fn() }));
const { encodeWebPDirect, WebpEncodeError } = require("./webpWasm.js");
global.self = { postMessage: jest.fn() };
require("./webpWorker.js");

beforeEach(() => jest.clearAllMocks());

it("codifica los píxeles recibidos y devuelve los bytes transferidos", async () => {
  encodeWebPDirect.mockResolvedValue(new Blob([new Uint8Array([9, 9])], { type: "image/webp" }));
  await self.onmessage({ data: { id: 7, width: 1, height: 1, buffer: new ArrayBuffer(4), quality: 0.5 } });
  expect(encodeWebPDirect).toHaveBeenCalledWith(
    { data: expect.any(Uint8ClampedArray), width: 1, height: 1 },
    0.5
  );
  const [msg, transfer] = self.postMessage.mock.calls[0];
  expect(msg).toMatchObject({ id: 7, ok: true });
  expect(msg.buffer.byteLength).toBe(2);
  expect(transfer).toEqual([msg.buffer]);
});

it("un error del encoder vuelve como ok:false con la marca WebP", async () => {
  encodeWebPDirect.mockRejectedValue(new WebpEncodeError("encode: OOM"));
  await self.onmessage({ data: { id: 8, width: 1, height: 1, buffer: new ArrayBuffer(4), quality: 0.5 } });
  expect(self.postMessage).toHaveBeenCalledWith({
    id: 8,
    ok: false,
    error: expect.stringContaining("WEBP_ENCODE_FAILED"),
  });
});
```

- [ ] **Paso 3: verificar que fallan.** Corré `npx jest src/lib/webpEncoder src/lib/webpWorker`.
Esperado: FAIL (`encodeWebP is not a function` y `Cannot find module './webpWorker.js'`).

- [ ] **Paso 4: implementar** (no verificado en navegador hasta la Task 8). Archivo `src/lib/webpWorker.js`:

```js
// Worker dedicado del encoder WebP para la ventana (A1): una vez llamado, el
// WASM corre sincrónico, y en una foto grande congelaría la UI varios
// segundos. Se crea recién al primer uso.
import { encodeWebPDirect } from "./webpWasm.js";

self.onmessage = async (e) => {
  const { id, width, height, buffer, quality } = e.data;
  try {
    const blob = await encodeWebPDirect({ data: new Uint8ClampedArray(buffer), width, height }, quality);
    const out = await blob.arrayBuffer();
    self.postMessage({ id, ok: true, buffer: out }, [out]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
```

Agregá en `src/lib/webpEncoder.js` (el import pasa a ser
`import { encodeWebPDirect, isWebpEncodeError, WebpEncodeError } from "./webpWasm.js";`):

```js
let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./webpWorker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, ok, buffer, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(new Blob([buffer], { type: "image/webp" }));
    else p.reject(isWebpEncodeError(error) ? new Error(error) : new WebpEncodeError(error));
  };
  worker.onerror = (e) => {
    // p. ej. el chunk del worker no bajó: se rechaza todo y el próximo intento crea otro
    for (const p of pending.values()) p.reject(new WebpEncodeError(`worker: ${e?.message || "error"}`));
    pending.clear();
    worker = null;
  };
  return worker;
}

/** Codifica a WebP con el encoder propio. Transfiere (consume) el buffer de `imageData`. */
export function encodeWebP(imageData, quality01 = 0.92) {
  // sin document estamos en un worker (cutoutWorker): no se anida otro
  if (typeof document === "undefined") return encodeWebPDirect(imageData, quality01);
  return new Promise((resolve, reject) => {
    let w;
    try {
      w = getWorker();
    } catch (e) {
      reject(new WebpEncodeError(`worker: ${e?.message || e}`));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    const { width, height, data } = imageData;
    w.postMessage({ id, width, height, buffer: data.buffer, quality: quality01 }, [data.buffer]);
  });
}
```
En `_resetForTests()` agregá también: `worker = null; pending.clear();`.

- [ ] **Paso 5: verificar.** Corré `npx jest src/lib/webp` y esperá PASS. Después corré
`npm run build && ls dist/assets | grep -Ei "webp"`. Esperado: el build no falla y aparecen
`webpWorker-*.js`, `webp_enc-*.wasm` y `webp_enc_simd-*.wasm`. Si Vite rechaza el worker anidado,
**frená** y devolvé el ticket con el error. No reestructures por tu cuenta.

- [ ] **Paso 6: commit**

```bash
git add src/lib/webpWorker.js src/lib/webpWorker.test.js src/lib/webpEncoder.js src/lib/webpEncoder.test.js src/lib/webpEncoder.node.test.js
git commit -m "feat(webp): worker dedicado y perezoso para codificar desde la ventana (GROW-35 A1)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: `canvasToBlob` usa el encoder cuando el canvas no sabe codificar WebP

**Archivos:**
- Modificar: `src/lib/jsEngine.js:986-997` (y el import del principio)
- Crear: `src/lib/jsEngine.canvasToBlob.test.js`

**Interfaces:**
- Consume: `canEncodeWebP`, `encodeWebP` (Tasks 1 y 2).
- Produce: `canvasToBlob(canvas, type, quality): Promise<Blob>` sigue siendo async. Ahora el `blob.type`
  es SIEMPRE el real, y si el encoder WebP falla, rechaza (no cae a PNG). No cambian los llamadores
  (`composite`/`compositeBlur`/`compositePreset` ya hacen `return canvasToBlob(...)`).

- [ ] **Paso 1: escribir el test que falla.** Archivo `src/lib/jsEngine.canvasToBlob.test.js`:

```js
jest.mock("./webpEncoder.js", () => ({ canEncodeWebP: jest.fn(), encodeWebP: jest.fn() }));
import { canEncodeWebP, encodeWebP } from "./webpEncoder.js";
import { canvasToBlob } from "./jsEngine.js";

// OffscreenCanvas falso. `engineType` simula el motor: WebKit devuelve PNG aunque se pida WebP.
function offscreen(engineType) {
  const img = { width: 4, height: 3, data: new Uint8ClampedArray(48) };
  const ctx = { getImageData: jest.fn(() => img) };
  return {
    width: 4,
    height: 3,
    img,
    ctx,
    getContext: jest.fn(() => ctx),
    convertToBlob: jest.fn(async ({ type }) => new Blob([], { type: engineType ?? type })),
  };
}

beforeEach(() => jest.clearAllMocks());

describe("canvasToBlob — WebP real en cualquier motor (GROW-35)", () => {
  it("con WebP nativo usa el canvas y jamás el WASM (regresión G6)", async () => {
    canEncodeWebP.mockResolvedValue(true);
    const c = offscreen();
    const b = await canvasToBlob(c, "image/webp", 0.8);
    expect(c.convertToBlob).toHaveBeenCalledWith({ type: "image/webp", quality: 0.8 });
    expect(encodeWebP).not.toHaveBeenCalled();
    expect(b.type).toBe("image/webp");
  });

  it("sin WebP nativo: getImageData del lienzo entero + encodeWebP con la calidad pedida", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const c = offscreen("image/png");
    const b = await canvasToBlob(c, "image/webp", 0.7);
    expect(c.ctx.getImageData).toHaveBeenCalledWith(0, 0, 4, 3);
    expect(encodeWebP).toHaveBeenCalledWith(c.img, 0.7);
    expect(c.convertToBlob).not.toHaveBeenCalled();
    expect(b.type).toBe("image/webp");
  });

  it("sin calidad explícita usa 0.92", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const c = offscreen("image/png");
    await canvasToBlob(c, "image/webp");
    expect(encodeWebP).toHaveBeenCalledWith(c.img, 0.92);
  });

  it("HTMLCanvas (camino inline) sin WebP nativo también pasa por el encoder", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const img = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const c = { width: 2, height: 2, getContext: () => ({ getImageData: () => img }), toDataURL: jest.fn() };
    await canvasToBlob(c, "image/webp", 0.5);
    expect(c.toDataURL).not.toHaveBeenCalled();
    expect(encodeWebP).toHaveBeenCalledWith(img, 0.5);
  });

  it("si el encoder falla, rechaza: nunca entrega un PNG en su lugar (A4)", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: 16384×900 supera 16383 px"));
    const c = offscreen("image/png");
    await expect(canvasToBlob(c, "image/webp", 0.9)).rejects.toThrow(/WEBP_ENCODE_FAILED/);
    expect(c.convertToBlob).not.toHaveBeenCalled();
  });

  it("PNG y JPEG ni consultan el detector", async () => {
    const c = offscreen();
    await canvasToBlob(c, "image/png");
    await canvasToBlob(c, "image/jpeg", 0.9);
    expect(canEncodeWebP).not.toHaveBeenCalled();
  });
});
```

- [ ] **Paso 2: verificar que falla.** Corré `npx jest src/lib/jsEngine.canvasToBlob.test.js`.
Esperado: FAIL con `Cannot find module './webpEncoder.js' from 'src/lib/jsEngine.canvasToBlob.test.js'` si
corrés contra `main`. Sobre esta rama lo esperado son los casos «sin WebP nativo» en rojo, porque hoy
se llama a `convertToBlob`.

- [ ] **Paso 3: implementar.** En `src/lib/jsEngine.js`, agregá arriba
`import { canEncodeWebP, encodeWebP } from "./webpEncoder.js";` y reemplazá la función:

```js
export async function canvasToBlob(canvas, type = "image/png", quality) {
  // WebKit devuelve PNG cuando se le pide WebP: ahí los bytes los pone el
  // encoder propio. El tipo del blob es siempre el real (GROW-35).
  if (type === "image/webp" && !(await canEncodeWebP())) {
    const img = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    return encodeWebP(img, quality ?? 0.92);
  }
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality }); // OffscreenCanvas
  // HTMLCanvas (fallback sin worker): síncrono vía dataURL — toBlob programa
  // el encode en otro hilo y su callback es frágil en headless/virtual-time.
  const dataUrl = canvas.toDataURL(type, quality);
  const [head, b64] = dataUrl.split(",");
  const mime = head.slice(5, head.indexOf(";"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type: mime });
}
```

- [ ] **Paso 4: verificar.** Corré `npx jest src/lib/jsEngine.canvasToBlob.test.js` (esperado: PASS, 6 tests)
y después `npm run test:unit` (esperado: todo verde).

- [ ] **Paso 5: commit**

```bash
git add src/lib/jsEngine.js src/lib/jsEngine.canvasToBlob.test.js
git commit -m "fix(export): canvasToBlob produce WebP real sin soporte nativo (GROW-35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `reencodeToBlob` (pestaña Archivo) y `formatFromMime`

**Archivos:**
- Modificar: `src/lib/metadata.js` (`OUTPUT_FORMATS`, `reencodeToBlob`), `src/lib/metadata.test.js`

**Interfaces:**
- Produce: `formatFromMime(mime): "png"|"jpeg"|"webp"|null`. `reencodeToBlob` pasa a ser `async` y en
  WebP sin soporte devuelve el blob del encoder (con el `getImageData` del canvas ya redimensionado).
  En ese camino delega en el worker de la ventana (Task 2), así que no bloquea la UI (A1).

- [ ] **Paso 1: escribir los tests que fallan.** Arriba de `src/lib/metadata.test.js`, antes de los imports:

```js
jest.mock("./webpEncoder.js", () => ({ canEncodeWebP: jest.fn(async () => true), encodeWebP: jest.fn() }));
import { canEncodeWebP, encodeWebP } from "./webpEncoder.js";
```
Sumá `formatFromMime` al import de `./metadata.js`. En el `beforeEach` de `describe("reencodeToBlob / OUTPUT_FORMATS")`
agregá `canEncodeWebP.mockResolvedValue(true);` y cambiá el `getImageData` del canvas falso por:

```js
          getImageData: (...a) => {
            calls.ops.push(["getImageData", ...a]);
            return { width: a[2], height: a[3], data: new Uint8ClampedArray(40 * 30 * 4).fill(255) };
          },
```
Dentro del mismo `describe` agregá:

```js
  it("webp sin soporte nativo: no usa toBlob y codifica los píxeles al tamaño pedido", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const b = await reencodeToBlob(img, { format: "webp", quality: 0.4, width: 20, height: 15 });
    expect(calls.toBlob).toHaveLength(0);
    expect(calls.ops).toContainEqual(["getImageData", 0, 0, 20, 15]);
    expect(encodeWebP).toHaveBeenCalledWith(expect.objectContaining({ width: 20, height: 15 }), 0.4);
    expect(b.type).toBe("image/webp");
  });

  it("png y jpeg ni consultan el detector de WebP", async () => {
    await reencodeToBlob(img, { format: "png" });
    await reencodeToBlob(img, { format: "jpeg", quality: 0.5 });
    expect(canEncodeWebP).not.toHaveBeenCalled();
  });

  it("formatFromMime traduce el tipo real a la clave de formato", () => {
    expect(formatFromMime("image/webp")).toBe("webp");
    expect(formatFromMime("image/png")).toBe("png");
    expect(formatFromMime("image/jpeg")).toBe("jpeg");
    expect(formatFromMime("image/gif")).toBeNull();
    expect(formatFromMime("")).toBeNull();
  });
```

- [ ] **Paso 2: verificar que fallan.** Corré `npx jest src/lib/metadata.test.js`. Esperado: FAIL en los
3 nuevos (`formatFromMime is not a function`; `toBlob` llamado con webp). El resto debe seguir en verde.

- [ ] **Paso 3: implementar.** En `src/lib/metadata.js` agregá
`import { canEncodeWebP, encodeWebP } from "./webpEncoder.js";` arriba y, debajo de `OUTPUT_FORMATS`:

```js
/** Clave de OUTPUT_FORMATS para un MIME real (el de un Blob), o null si no es uno nuestro. */
export function formatFromMime(mime) {
  return Object.keys(OUTPUT_FORMATS).find((k) => OUTPUT_FORMATS[k].mime === mime) || null;
}
```
`reencodeToBlob` pasa a `export async function reencodeToBlob(img, opts = {})`. Justo después del
`ctx.drawImage(...)` y antes del `return new Promise(...)` va:

```js
  // WebKit devuelve PNG cuando se le pide WebP: ahí codifica el encoder propio,
  // en su worker para no congelar la UI con fotos grandes (GROW-35, A1)
  if (fmt.mime === "image/webp" && !(await canEncodeWebP())) {
    return encodeWebP(ctx.getImageData(0, 0, canvas.width, canvas.height), quality);
  }
```
Refactor de reutilización: `stripToBlob` pasa a `const format = formatFromMime(mime) || "jpeg";`.

- [ ] **Paso 4: verificar.** Corré `npx jest src/lib/metadata.test.js`. Esperado: PASS (los 3 nuevos y los existentes).

- [ ] **Paso 5: commit**

```bash
git add src/lib/metadata.js src/lib/metadata.test.js
git commit -m "fix(archivo): reencodeToBlob produce WebP real sin soporte nativo + formatFromMime (GROW-35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: `useExport` nombra, mide y cuenta por el tipo real (A2)

**Archivos:**
- Modificar: `src/features/cutout/hooks/useExport.js:86-116`, `src/features/cutout/hooks/useExport.test.js`, `src/lib/i18n.js`

**Interfaces:**
- Consume: `formatFromMime`, `OUTPUT_FORMATS` (Task 4). `backend.export*` NO cambia.
- Produce: la clave i18n `export.formatFallback` con `{want, got}` en mayúsculas (`PNG`/`JPEG`/`WEBP`,
  los mismos rótulos que los chips).

- [ ] **Paso 1: escribir los tests que fallan.** En `useExport.test.js`:
1. Debajo de los `jest.mock` existentes: `jest.mock("../../../utils/save.js", () => ({ saveExport: jest.fn(async () => true) }));`
2. Reemplazá el mock de `fetch` por uno que también devuelva el tipo (las aserciones existentes no cambian):

```js
const sizes = {};
const types = {};
global.fetch = jest.fn(async (url) => ({
  blob: async () => ({ size: sizes[url] ?? 1000, type: types[url] ?? "" }),
}));
```
3. Agregá `import { t } from "../../../lib/i18n.js";` y este bloque al final:

```js
describe("useExport — el archivo se nombra por lo que ES (GROW-35)", () => {
  const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
  const EXT = { png: "png", jpeg: "jpg", webp: "webp" };
  beforeEach(() => {
    for (const k of Object.keys(types)) delete types[k];
    for (const k of Object.keys(sizes)) delete sizes[k];
  });
  afterEach(() => backend.exportTransparent.mockImplementation(async () => "blob:t"));

  it("el nombre siempre coincide con el contenido, pida lo que pida", async () => {
    const { downloadDataUrl } = require("../../../utils/dom.js");
    const { result } = setup();
    act(() => result.current.setExportMode("solid"));
    for (const asked of ["png", "jpeg", "webp"])
      for (const got of ["png", "jpeg", "webp"]) {
        types["blob:s"] = MIME[got];
        act(() => result.current.setFormat(asked));
        await act(() => result.current.handleDownload());
        expect(downloadDataUrl).toHaveBeenLastCalledWith("blob:s", `photocut-solid.${EXT[got]}`);
      }
  });

  it("pedí WebP y el navegador dio PNG: baja .png, avisa y la analítica cuenta PNG", async () => {
    types["blob:t"] = "image/png";
    const { result, toast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    const { trackEvent } = require("../../../services/analytics.js");
    expect(downloadDataUrl).toHaveBeenCalledWith("blob:t", "photocut-transparent.png");
    expect(toast).toHaveBeenCalledWith(t("export.formatFallback", { want: "WEBP", got: "PNG" }), "error");
    expect(trackEvent).toHaveBeenCalledWith("export", { kind: "transparent", format: "png" });
  });

  it("sticker WhatsApp en un motor que da PNG: .png y aviso de formato, no de peso", async () => {
    backend.exportTransparent.mockImplementation(async (o) => `blob:q${o.quality.toFixed(2)}`);
    for (const q of ["0.92", "0.82", "0.72", "0.62", "0.52", "0.42", "0.32"]) {
      sizes[`blob:q${q}`] = 164 * 1024;
      types[`blob:q${q}`] = "image/png";
    }
    const { result, toast } = setup();
    act(() => result.current.setPresetId("sticker-whatsapp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), "photocut-transparent.png");
    expect(toast).toHaveBeenCalledWith(t("export.formatFallback", { want: "WEBP", got: "PNG" }), "error");
    expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/164 KB/), "error");
  });

  it("en escritorio el nombre (y con él el filtro del diálogo) sale del tipo real", async () => {
    const { saveExport } = require("../../../utils/save.js");
    backend.isDesktop = true;
    try {
      types["blob:t"] = "image/png";
      const { result } = setup();
      act(() => result.current.setFormat("webp"));
      await act(() => result.current.handleDownload());
      expect(saveExport).toHaveBeenCalledWith("blob:t", "photocut-transparent.png");
    } finally {
      backend.isDesktop = false;
    }
  });
});
```

- [ ] **Paso 2: verificar que fallan.** Corré `npx jest src/features/cutout/hooks/useExport.test.js`.
Esperado: FAIL en los 4 nuevos (el nombre sale de `effFormat`) y PASS en los 14 existentes.

- [ ] **Paso 3: implementar.** En `useExport.js`, importá
`import { OUTPUT_FORMATS, formatFromMime } from "../../../lib/metadata.js";` y reemplazá desde `let url;`
hasta `trackEvent(...)` por:

```js
        let url;
        let realType;
        let notice = null;
        if (preset?.maxBytes) {
          const fit = await fitWithinBytes(
            async (q) => {
              const u = await run(q);
              const b = await (await fetch(u)).blob();
              return { url: u, bytes: b.size, type: b.type };
            },
            { maxBytes: preset.maxBytes }
          );
          url = fit.url;
          realType = fit.type;
          const kb = Math.round(fit.bytes / 1024);
          const max = Math.round(preset.maxBytes / 1024);
          if (!fit.fits) notice = [t("export.overLimit", { kb, max }), "error"];
          else if (fit.reduced)
            notice = [t("export.qualityReduced", { q: Math.round(fit.quality * 100), kb, max }), "ok"];
        } else {
          url = await run(0.92);
          realType = (await (await fetch(url)).blob()).type;
        }
        // el archivo se nombra por lo que ES, no por lo que se pidió (GROW-35);
        // si el motor dio otro formato, ese aviso pesa más que el del peso
        const realFormat = formatFromMime(realType) || effFormat;
        if (realFormat !== effFormat)
          notice = [
            t("export.formatFallback", { want: effFormat.toUpperCase(), got: realFormat.toUpperCase() }),
            "error",
          ];
        const name = `photocut-${kind}.${OUTPUT_FORMATS[realFormat].ext}`;
        if (backend.isDesktop) {
          // diálogo nativo "Guardar como"
          const saved = await saveExport(url, name);
          if (!saved) return; // usuario canceló: sin toast de éxito
        } else {
          downloadDataUrl(url, name);
        }
        trackEvent("export", { kind, format: realFormat });
```
(`formatFromMime(...) || effFormat` solo entra en juego cuando el blob no trae tipo. Eso pasa con los
mocks de jsdom; los Blobs del navegador siempre lo traen.)

En `src/lib/i18n.js`, al lado de `export.overLimit` en cada idioma:
- es: `"export.formatFallback": "Tu navegador no generó {want}: se descargó como {got}",`
- en: `"export.formatFallback": "Your browser didn't produce {want}: it was downloaded as {got}",`
- pt: `"export.formatFallback": "Seu navegador não gerou {want}: foi baixado como {got}",`

- [ ] **Paso 4: verificar.** Corré `npx jest src/features/cutout/hooks/useExport.test.js src/lib/i18n.test.js`.
Esperado: PASS (18 tests de useExport y la paridad de i18n).

- [ ] **Paso 5: commit**

```bash
git add src/features/cutout/hooks/useExport.js src/features/cutout/hooks/useExport.test.js src/lib/i18n.js
git commit -m "fix(export): nombre, analítica y aviso salen del tipo real del blob (GROW-35 A2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: `useReencode` descarga por el tipo real y no apila encodes (A1)

**Archivos:**
- Crear: `src/lib/latestRunner.js`, `src/lib/latestRunner.test.js`, `src/features/metadata/hooks/useReencode.test.js`
- Modificar: `src/features/metadata/hooks/useReencode.js`, `src/features/metadata/MetadataPage.jsx:33`

**Interfaces:**
- Produce: `createLatestRunner(): { run(job: () => Promise<T>): Promise<{stale:false, value:T} | {stale:true}> }`.
  Rechaza si `job` rechaza.
- `useReencode({ imgRef, info, onToast })`: el parámetro `onToast(text, kind)` es nuevo y opcional.

- [ ] **Paso 1: escribir los tests que fallan.** `src/lib/latestRunner.test.js`:

```js
import { createLatestRunner } from "./latestRunner.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((r, j) => ((resolve = r), (reject = j)));
  return { promise, resolve, reject };
};

it("sin carrera corre la tarea y devuelve su valor", async () => {
  const r = createLatestRunner();
  expect(await r.run(async () => 5)).toEqual({ stale: false, value: 5 });
});

it("con una en vuelo, de tres pedidos solo corre el último; los intermedios salen stale", async () => {
  const r = createLatestRunner();
  const first = deferred();
  const ran = [];
  const p1 = r.run(() => (ran.push(1), first.promise));
  const p2 = r.run(async () => (ran.push(2), 2));
  const p3 = r.run(async () => (ran.push(3), 3));
  const p4 = r.run(async () => (ran.push(4), 4));
  await Promise.resolve();
  expect(ran).toEqual([1]);
  first.resolve(1);
  expect(await p1).toEqual({ stale: false, value: 1 });
  expect(await p2).toEqual({ stale: true });
  expect(await p3).toEqual({ stale: true });
  expect(await p4).toEqual({ stale: false, value: 4 });
  expect(ran).toEqual([1, 4]);
});

it("un error rechaza solo esa tarea y la que espera corre igual", async () => {
  const r = createLatestRunner();
  const first = deferred();
  const p1 = r.run(() => first.promise);
  const p2 = r.run(async () => "ok");
  first.reject(new Error("WEBP_ENCODE_FAILED: x"));
  await expect(p1).rejects.toThrow(/WEBP/);
  expect(await p2).toEqual({ stale: false, value: "ok" });
});
```

`src/features/metadata/hooks/useReencode.test.js`:

```js
jest.mock("../../../lib/metadata.js", () => ({
  ...jest.requireActual("../../../lib/metadata.js"),
  reencodeToBlob: jest.fn(),
  hasTransparency: jest.fn(() => false),
}));
import { renderHook, act } from "@testing-library/react";
import { reencodeToBlob } from "../../../lib/metadata.js";
import { t } from "../../../lib/i18n.js";
import { useReencode } from "./useReencode.js";

const INFO = { name: "foto.png", type: "image/png", width: 40, height: 30, bytes: 5000 };
const blobOf = (type) => new Blob([new Uint8Array(10)], { type });
let clicked;

beforeEach(() => {
  jest.clearAllMocks();
  clicked = [];
  global.URL.createObjectURL = jest.fn(() => "blob:x");
  global.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    clicked.push(this.download);
  });
  reencodeToBlob.mockResolvedValue(blobOf("image/png"));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function setup() {
  const onToast = jest.fn();
  const imgRef = { current: { naturalWidth: 40, naturalHeight: 30 } };
  const hook = renderHook(() => useReencode({ imgRef, info: INFO, onToast }));
  return { ...hook, onToast };
}

describe("useReencode — la descarga se nombra por lo que ES (GROW-35)", () => {
  it("pedí WebP y vino PNG: baja foto.png y avisa", async () => {
    const { result, onToast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.download());
    expect(clicked).toEqual(["foto.png"]);
    expect(onToast).toHaveBeenCalledWith(t("export.formatFallback", { want: "WEBP", got: "PNG" }), "error");
  });

  it("WebP real: baja foto.webp sin aviso", async () => {
    reencodeToBlob.mockResolvedValue(blobOf("image/webp"));
    const { result, onToast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.download());
    expect(clicked).toEqual(["foto.webp"]);
    expect(onToast).not.toHaveBeenCalled();
  });
});

describe("useReencode — estimación sin apilar codificaciones (A1)", () => {
  it("con una en vuelo, los cambios intermedios no lanzan otra: corre solo la última", async () => {
    jest.useFakeTimers();
    let release;
    reencodeToBlob.mockImplementationOnce(() => new Promise((r) => (release = r)));
    reencodeToBlob.mockResolvedValue(blobOf("image/webp"));
    const { result } = setup();
    await act(async () => jest.advanceTimersByTime(250)); // la 1ª queda en vuelo
    for (const q of [70, 60, 50]) {
      act(() => result.current.setQuality(q));
      await act(async () => jest.advanceTimersByTime(250));
    }
    expect(reencodeToBlob).toHaveBeenCalledTimes(1);
    await act(async () => release(blobOf("image/png")));
    expect(reencodeToBlob).toHaveBeenCalledTimes(2);
    expect(reencodeToBlob.mock.calls[1][1].quality).toBe(0.5);
  });
});
```

- [ ] **Paso 2: verificar que fallan.** Corré `npx jest src/lib/latestRunner.test.js src/features/metadata/hooks/useReencode.test.js`.
Esperado: FAIL (no existe `latestRunner.js`; `foto.webp` en vez de `foto.png`; 4 llamadas en vez de 1).

- [ ] **Paso 3: implementar.** `src/lib/latestRunner.js`:

```js
// Una tarea por vez. Si llegan más mientras una corre, solo la ÚLTIMA espera
// turno y las de en medio se descartan (salen como stale). El encoder WASM
// trabaja de a una: encolar cada paso del slider lo dejaría segundos atrás
// (GROW-35, A1).
export function createLatestRunner() {
  let running = false;
  let next = null;
  const start = (entry) => {
    running = true;
    Promise.resolve()
      .then(entry.job)
      .then((value) => entry.resolve({ stale: false, value }), entry.reject)
      .finally(() => {
        running = false;
        if (next) {
          const n = next;
          next = null;
          start(n);
        }
      });
  };
  return {
    run(job) {
      return new Promise((resolve, reject) => {
        const entry = { job, resolve, reject };
        if (!running) return start(entry);
        next?.resolve({ stale: true });
        next = entry;
      });
    },
  };
}
```

En `useReencode.js`:
- Imports: `import { reencodeToBlob, hasTransparency, fitSize, OUTPUT_FORMATS, formatFromMime } from "../../../lib/metadata.js";`,
  `import { createLatestRunner } from "../../../lib/latestRunner.js";` y `import { t } from "../../../lib/i18n.js";`.
- Firma: `export function useReencode({ imgRef, info, onToast })`. Debajo de `runId`:
  `const runnerRef = useRef(null); runnerRef.current ??= createLatestRunner();`
- La `match` del efecto de imagen nueva pasa a `const match = formatFromMime(info.type);`, y `origFormat`
  pasa a `const origFormat = formatFromMime(info?.type);`.
- El cuerpo del `setTimeout` de la estimación queda así:

```js
    const timer = setTimeout(async () => {
      let res;
      try {
        res = await runnerRef.current.run(() =>
          reencodeToBlob(img, {
            format,
            quality: quality / 100,
            width: width || undefined,
            height: height || undefined,
          })
        );
      } catch (e) {
        if (id !== runId.current) return;
        setEstimate(null);
        setEstimating(false);
        reportFailure(e);
        return;
      }
      if (res.stale || id !== runId.current) return; // llegó tarde: hay otro cambio en curso
      const blob = res.value;
      setEstimate(blob ? blob.size : null);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const purl = blob ? URL.createObjectURL(blob) : null;
      previewUrlRef.current = purl;
      setConvertedUrl(purl);
      setEstimating(false);
    }, DEBOUNCE_MS);
```
- `reportFailure` (antes del efecto) va **en la Task 7**. En esta tarea dejá
  `const reportFailure = useCallback((e) => onToast?.(String(e), "error"), [onToast]);` y agregalo a las deps del efecto.
- `download`:

```js
  const download = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;
    const blob = await reencodeToBlob(img, {
      format,
      quality: quality / 100,
      width: width || undefined,
      height: height || undefined,
    });
    if (!blob) return;
    // se nombra por lo que ES (GROW-35): nunca un .webp con PNG adentro
    const real = formatFromMime(blob.type) || format;
    if (real !== format)
      onToast?.(t("export.formatFallback", { want: format.toUpperCase(), got: real.toUpperCase() }), "error");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const base = info?.name?.replace(/\.[^.]+$/, "") || "imagen";
    a.download = `${base}.${OUTPUT_FORMATS[real].ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [imgRef, info, format, quality, width, height, onToast]);
```
- En `MetadataPage.jsx:33`: `const r = useReencode({ imgRef: m.imgRef, info: m.info, onToast });`

- [ ] **Paso 4: verificar.** Corré `npx jest src/lib/latestRunner.test.js src/features/metadata` y después
`npm run test:unit`. Esperado: PASS.

- [ ] **Paso 5: commit**

```bash
git add src/lib/latestRunner.js src/lib/latestRunner.test.js src/features/metadata/hooks/useReencode.js src/features/metadata/hooks/useReencode.test.js src/features/metadata/MetadataPage.jsx
git commit -m "fix(archivo): descarga por el tipo real y estimación sin apilar encodes (GROW-35 A1)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Camino de error del encoder (A4) en Exportar y Archivo

**Archivos:**
- Modificar: `src/features/cutout/hooks/useExport.js` (catch), `src/features/metadata/hooks/useReencode.js` (`reportFailure`, try en `download`), `src/lib/i18n.js`, los dos tests de hooks

**Interfaces:**
- Consume: `isWebpEncodeError` (de `webpEncoder.js`).
- Produce: la clave i18n `export.webpFailed`.

- [ ] **Paso 1: escribir los tests que fallan.** Al final de `useExport.test.js`
(`import { setLang } from "../../../lib/i18n.js";` junto al `t`):

```js
describe("useExport — si el encoder WebP falla (GROW-35, A4)", () => {
  afterEach(() => {
    backend.exportTransparent.mockImplementation(async () => "blob:t");
    setLang("es");
  });

  it("no descarga nada, avisa en el idioma de la UI y el panel queda igual", async () => {
    backend.exportTransparent.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: load: Failed to fetch"));
    const { result, toast } = setup();
    act(() => setLang("en"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith("Couldn't prepare the WebP. Try again with a connection or choose PNG", "error");
    expect(result.current.presetId).toBe("sticker-whatsapp");
    expect(result.current.format).toBe("webp");
    expect(result.current.exportMode).toBe("transparent");
  });

  it("una imagen de más de 16383 px tampoco cae a PNG: mismo aviso, sin archivo", async () => {
    backend.exportTransparent.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: 16384×900 supera 16383 px"));
    const { result, toast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith(t("export.webpFailed"), "error");
  });
});
```
Al final de `useReencode.test.js`:

```js
describe("useReencode — si el encoder WebP falla (A4)", () => {
  it("al descargar: no baja nada y avisa", async () => {
    reencodeToBlob.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: encode: memory access out of bounds"));
    const { result, onToast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.download());
    expect(clicked).toEqual([]);
    expect(onToast).toHaveBeenCalledWith(t("export.webpFailed"), "error");
  });

  it("al estimar: sin estimado, sin spinner colgado y con aviso", async () => {
    jest.useFakeTimers();
    reencodeToBlob.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: load: offline"));
    const { result, onToast } = setup();
    await act(async () => jest.advanceTimersByTime(250));
    expect(result.current.estimate).toBeNull();
    expect(result.current.estimating).toBe(false);
    expect(onToast).toHaveBeenCalledWith(t("export.webpFailed"), "error");
  });
});
```

- [ ] **Paso 2: verificar que fallan.** Corré `npx jest src/features/cutout/hooks/useExport.test.js src/features/metadata`.
Esperado: FAIL en los 4 nuevos (hoy el toast es `String(e)` y `download` revienta sin aviso).

- [ ] **Paso 3: implementar.**
- i18n, al lado de `export.formatFallback`:
  - es: `"export.webpFailed": "No se pudo preparar el WebP. Reintentá con conexión o elegí PNG",`
  - en: `"export.webpFailed": "Couldn't prepare the WebP. Try again with a connection or choose PNG",`
  - pt: `"export.webpFailed": "Não foi possível preparar o WebP. Tente de novo com conexão ou escolha PNG",`
- `useExport.js`: importá `import { isWebpEncodeError } from "../../../lib/webpEncoder.js";` y el catch queda:

```js
      } catch (e) {
        // el encoder WebP no pudo (sin red la 1ª vez, >16383 px, sin memoria):
        // no se descarga nada, nunca un PNG disfrazado
        toast(isWebpEncodeError(e) ? t("export.webpFailed") : String(e), "error");
      }
```
- `useReencode.js`: importá `isWebpEncodeError` igual. `reportFailure` queda:

```js
  const reportFailure = useCallback(
    (e) => onToast?.(isWebpEncodeError(e) ? t("export.webpFailed") : String(e), "error"),
    [onToast]
  );
```
  Y en `download`, la llamada a `reencodeToBlob` va envuelta:

```js
    let blob;
    try {
      blob = await reencodeToBlob(img, {
        format,
        quality: quality / 100,
        width: width || undefined,
        height: height || undefined,
      });
    } catch (e) {
      reportFailure(e);
      return;
    }
```
  (sumá `reportFailure` a las deps de `download`).

- [ ] **Paso 4: verificar.** Corré `npm run test:unit`. Esperado: todo PASS (paridad de i18n incluida).

- [ ] **Paso 5: commit**

```bash
git add src/features/cutout/hooks/useExport.js src/features/cutout/hooks/useExport.test.js src/features/metadata/hooks/useReencode.js src/features/metadata/hooks/useReencode.test.js src/lib/i18n.js
git commit -m "fix(webp): si el encoder falla no se descarga nada y se avisa en es/en/pt (GROW-35 A4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Harness real, corrida WebKit, privacidad y guarda de carga diferida

**Archivos:**
- Crear: `test/webp-test.html`, `test/webp-test.js`, `scripts/lib/webp-lazy.test.mjs`
- Modificar: `test/run-tests.mjs`, `test/reencode-test.js:76-84`, `.github/workflows/ci.yml`

**WebKit de Playwright (dónde y cómo):** `playwright-core@1.60.0` no descarga navegadores solo. En esta
Mac ya está instalado el build que corresponde (`~/Library/Caches/ms-playwright/webkit_mac14_special-2251`,
el override `mac14` de `browsers.json` 1.60.0, verificado). Si no estuviera, se instala con
`npx playwright-core install webkit` (sin `sudo`, en el caché de usuario). En CI (Ubuntu) se instala
con `npx playwright-core install --with-deps webkit`; las dos opciones están verificadas con `--help`.
La suite Chrome no cambia: misma lista y mismo `channel:"chrome"`. WebKit corre después, sobre el
mismo Vite y con su propio contexto.

- [ ] **Paso 1: Context7 (Playwright).** Confirmá que `BrowserContext.on("request")` incluye los requests
de los dedicated workers en Chromium y WebKit (el runner del spike, `pw35.mjs`, se apoyó en eso).
Si no los incluye, sumá `page.on("worker")` y `worker.on("request")` donde haga falta.

- [ ] **Paso 2: escribir los tests que fallan.** `test/webp-test.html` (copia de `sticker-test.html`
con título `webp test` y `src="./webp-test.js"`). `test/webp-test.js`:

```js
// GROW-35: WebP real en cualquier motor. Corre en Chrome (nativo) y en WebKit
// (sin WebP en canvas, así que codifica el WASM). Mira los BYTES: cabecera
// RIFF/WEBP, flag de alfa, tamaño y peso, y que el tipo declarado sea el
// contenido. El nombre de archivo sale del tipo, y eso lo cubre jest.
import { backend } from "../src/lib/backend.js";
import { EXPORT_PRESETS, fitWithinBytes } from "../src/lib/presets.js";
import { reencodeToBlob } from "../src/lib/metadata.js";
import { canEncodeWebP } from "../src/lib/webpEncoder.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[webp-test]", s);
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const str = (u, a, b) => String.fromCharCode(...u.slice(a, b));
const magic = (u) =>
  str(u, 0, 4) === "RIFF" && str(u, 8, 12) === "WEBP" ? "webp"
    : u[0] === 0x89 && str(u, 1, 4) === "PNG" ? "png"
    : u[0] === 0xff && u[1] === 0xd8 ? "jpeg"
    : "?";

async function inspect(blob) {
  const u = new Uint8Array(await blob.arrayBuffer());
  const vp8x = str(u, 12, 16) === "VP8X";
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none" });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0);
  const a = (x, y) => g.getImageData(x, y, 1, 1).data[3];
  const W = bmp.width - 1, H = bmp.height - 1;
  return {
    kind: magic(u), vp8x, alphaFlag: vp8x && !!(u[20] & 0x10),
    w: bmp.width, h: bmp.height, bytes: u.length,
    corners: [a(0, 0), a(W, 0), a(0, H), a(W, H)],
  };
}
const blobOf = async (url) => (await fetch(url)).blob();

// mitad izquierda transparente, derecha roja (fuente de la pestaña Archivo)
function source(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#ff0000";
  g.fillRect(w / 2, 0, w / 2, h);
  return c;
}

async function main() {
  const native = await canEncodeWebP();
  log(`ruta=${native ? "nativa" : "wasm"}`);

  const src = await blobOf("/media/guias/quitar-fondo-antes.jpg");
  const dataUrl = await new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(src);
  });
  await backend.loadImage(dataUrl);
  await backend.autoCut();

  // 1. Sticker WhatsApp con el mismo ajuste de peso que el editor
  const WA = EXPORT_PRESETS.find((p) => p.id === "sticker-whatsapp").preset;
  const fit = await fitWithinBytes(
    async (quality) => {
      const url = await backend.exportTransparent({ format: "webp", quality, preset: WA });
      const b = await blobOf(url);
      return { url, bytes: b.size, type: b.type };
    },
    { maxBytes: WA.maxBytes }
  );
  const wa = await inspect(await blobOf(fit.url));
  log(`sticker: ${wa.kind} ${wa.w}×${wa.h} ${(wa.bytes / 1024).toFixed(1)} KB q=${fit.quality}`);
  assert(wa.kind === "webp" && fit.type === "image/webp", `sticker: bytes WebP y tipo image/webp (${wa.kind}, ${fit.type})`);
  assert(wa.vp8x && wa.alphaFlag, "sticker: cabecera VP8X con flag de alfa");
  assert(wa.w === 512 && wa.h === 512, `sticker: 512×512 (${wa.w}×${wa.h})`);
  assert(wa.corners.every((v) => v === 0), `sticker: esquinas alfa 0 (${wa.corners.join(",")})`);
  assert(wa.bytes <= 100 * 1024, `sticker: ≤100 KB (${(wa.bytes / 1024).toFixed(1)} KB)`);

  // 2. chip WebP de Exportar, sin preset
  const plain = await inspect(await blobOf(await backend.exportTransparent({ format: "webp", quality: 0.92 })));
  assert(plain.kind === "webp" && plain.alphaFlag, "exportar WebP sin preset: WebP real con alfa");

  // 3. pestaña Archivo → WebP
  const s = source(80, 40);
  const arch = await reencodeToBlob(s, { format: "webp", quality: 0.8 });
  const ai = await inspect(arch);
  assert(arch.type === "image/webp" && ai.kind === "webp", `archivo: WebP real (${arch.type}, ${ai.kind})`);
  assert(ai.corners[0] < 128, `archivo: conserva la transparencia (alfa ${ai.corners[0]})`);

  // 4. el tipo declarado es el contenido, en los tres formatos y en los dos productores
  for (const f of ["png", "jpeg", "webp"]) {
    const e = await blobOf(await backend.exportSolid([255, 255, 255, 255], { format: f }));
    const ek = magic(new Uint8Array(await e.arrayBuffer()));
    assert(ek === f && e.type === MIME[ek], `editor ${f}: tipo ${e.type} = bytes ${ek}`);
    const r = await reencodeToBlob(s, { format: f, quality: 0.8 });
    const rk = magic(new Uint8Array(await r.arrayBuffer()));
    assert(rk === f && r.type === MIME[rk], `archivo ${f}: tipo ${r.type} = bytes ${rk}`);
  }
  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });
```

En `test/reencode-test.js:76-84` el `if/else` con `SKIP` sale y queda una aserción (endurecer, no aflojar):

```js
  const webp = await reencodeToBlob(src, { format: "webp", quality: 0.9 });
  assert(webp && webp.type === "image/webp", `webp: el resultado ES WebP (${webp?.type})`);
  {
    const { ctx } = await decode(webp);
    const a = px(ctx, 5, 20)[3];
    assert(a < 128, `webp: conserva la transparencia (alpha=${a})`);
  }
```

`scripts/lib/webp-lazy.test.mjs` (guarda del build, para que el WASM solo baje bajo demanda):

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDist } from "./ensure-dist.mjs";

// GROW-35: el encoder WebP es para navegadores sin soporte nativo y se pide
// recién al exportar. Si alguien lo importa estático, entra a la carga de todos.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dist = ensureDist(root);
const assets = fs.readdirSync(path.join(dist, "assets"));

test("el encoder WebP se publica como .wasm aparte", () => {
  assert.ok(assets.some((f) => /^webp_enc(_simd)?-.+\.wasm$/.test(f)), assets.join(" "));
});

test("ninguna página carga el encoder WebP de entrada", () => {
  for (const page of ["index.html", "editor/index.html"]) {
    const html = fs.readFileSync(path.join(dist, page), "utf8");
    const refs = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) assert.doesNotMatch(r, /webp_enc|webpWorker/, `${page} → ${r}`);
    for (const r of refs.filter((x) => x.endsWith(".js"))) {
      const js = fs.readFileSync(path.join(dist, "assets", r), "utf8");
      assert.doesNotMatch(js, /from\s*["']\.\/webp_enc/, `${r} importa el encoder estático`);
    }
  }
});
```

- [ ] **Paso 3: cambiar el runner.** En `test/run-tests.mjs`:
- `import { chromium, webkit } from "playwright-core";`. Sumá `"webp-test"` a `TESTS`.
- Debajo de `TESTS`:

```js
// GROW-35: lo que depende del códec corre también en WebKit (el motor de Safari
// no codifica WebP en canvas). Es la corrida que le faltó a GROW-34.
const WEBKIT_TESTS = ["webp-test", "reencode-test"];
const ORIGIN = `http://localhost:${PORT}`;
const ENCODER_WASM = /webp_enc[^/]*\.wasm/;

// Chrome tiene WebP nativo: si pide el encoder, se rompió la detección (y el peso).
const checkChrome = (name, reqs) =>
  name === "webp-test" && reqs.some((u) => ENCODER_WASM.test(u))
    ? [`Chrome pidió el encoder WASM: ${reqs.filter((u) => ENCODER_WASM.test(u)).join(", ")}`]
    : [];

// WebKit: cero requests fuera del origen (privacidad) y, en macOS, la ruta WASM probada de verdad.
const checkWebkit = (name, reqs, txt) => {
  const msgs = [];
  const foreign = reqs.filter((u) => !u.startsWith(ORIGIN) && !/^(blob|data):/.test(u));
  if (foreign.length) msgs.push(`requests fuera del origen: ${foreign.join(", ")}`);
  if (name === "webp-test" && process.platform === "darwin" && !txt.includes("ruta=wasm"))
    msgs.push("en WebKit/macOS se esperaba la ruta WASM (¿la detección dio true?)");
  return msgs;
};

async function runSuite(browser, names, tag, check) {
  let bad = 0;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const reqs = [];
  ctx.on("request", (r) => reqs.push(r.url()));
  page.on("pageerror", (e) => console.error(`  [${tag} pageerror]`, e.message));
  for (const name of names) {
    process.stdout.write(`\n■ ${name}${tag === "chrome" ? "" : ` [${tag}]`}\n`);
    reqs.length = 0;
    await page.setViewportSize(VIEWPORTS[name] || DESKTOP);
    await page.goto(`${ORIGIN}/test/${name}.html`);
    try {
      await page.waitForFunction(
        () => /ALL_DONE|ERROR/.test(document.getElementById("out")?.textContent || ""),
        { timeout: 120000 }
      );
    } catch {
      console.error("  TIMEOUT esperando ALL_DONE");
      bad++;
      continue;
    }
    const txt = await page.textContent("#out");
    for (const line of txt.trim().split("\n")) console.log(`  ${line}`);
    const extra = check(name, reqs, txt);
    for (const m of extra) console.log(`  FAIL: ${m}`);
    if (/FAIL|ERROR/.test(txt) || extra.length) bad++;
  }
  await ctx.close();
  return bad;
}
```
- Dentro del `try`, el `for` que había se reemplaza por:

```js
  failed += await runSuite(browser, TESTS, "chrome", checkChrome);

  let wk = null;
  try {
    wk = await webkit.launch({ headless: true });
  } catch (e) {
    if (process.env.SKIP_WEBKIT === "1")
      console.warn("\n⚠ WebKit saltado a pedido (SKIP_WEBKIT=1): los casos WebP de Safari NO se probaron");
    else {
      console.error(`\n✗ No arrancó WebKit de Playwright: ${e.message.split("\n")[0]}`);
      console.error("  Instalalo con: npx playwright-core install webkit");
      failed++;
    }
  }
  if (wk) {
    try {
      failed += await runSuite(wk, WEBKIT_TESTS, "webkit", checkWebkit);
    } finally {
      await wk.close();
    }
  }
```
- `.github/workflows/ci.yml`, job `web`, después de `- run: npm ci`: `- run: npx playwright-core install --with-deps webkit`.
  Actualizá el comentario de cabecera: «… + suites en Chrome headless y casos WebP en WebKit …».

- [ ] **Paso 4: verificar que falla contra `main` y pasa en la rama.**
- Corré `git stash -- src && npm run test:web; git stash pop`, sin los cambios de `src/`. Esperado:
  `webp-test [webkit]` FAIL en «sticker: bytes WebP» (sale `png`) y `reencode-test [webkit]` FAIL en «webp: el resultado ES WebP».
- En la rama: `npm run build && npm test` (esperado: verde, `webp-lazy` incluido) y
  `npm run test:web` (esperado: «✓ todo verde», `ruta=wasm` en `webp-test [webkit]`, `ruta=nativa` en Chrome).
- **No verificado:** el modo dev de Vite con jSquash en WebKit (el spike midió sobre `vite preview`).
  Si `webp-test [webkit]` falla al cargar el `.wasm` en dev, aplicá P-15 (`superpowers:systematic-debugging`)
  y, si no se resuelve, devolvé el ticket. No lo saltees.

- [ ] **Paso 5: commit**

```bash
git add test/webp-test.html test/webp-test.js test/reencode-test.js test/run-tests.mjs scripts/lib/webp-lazy.test.mjs .github/workflows/ci.yml
git commit -m "test(webp): corrida WebKit en el harness, bytes reales, privacidad y guarda de carga diferida (GROW-35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: D2. Salir de un preset de sticker devuelve el formato previo (independiente, se puede hacer en paralelo)

No depende de las tareas 1 a 8. Si demora la cadena WebP, se parte a un ticket propio (ver §QUÉ, Alcance).

**Archivos:** modificar `src/features/cutout/hooks/useExport.js:25-48`, `useExport.test.js` y `src/lib/i18n.js`.

- [ ] **Paso 1: escribir los tests que fallan.** Al final de `useExport.test.js`:

```js
describe("useExport — D2: el formato que impone un sticker no queda pegado", () => {
  it("Sticker WhatsApp → Original vuelve al formato previo y avisa en los dos cambios", () => {
    const { result, toast } = setup();
    act(() => result.current.setFormat("jpeg"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    expect(result.current.format).toBe("webp");
    expect(toast).toHaveBeenCalledWith(t("export.presetFormat", { fmt: "WEBP" }), "ok");
    act(() => result.current.setPresetId("original"));
    expect(result.current.format).toBe("jpeg");
    expect(toast).toHaveBeenLastCalledWith(t("export.formatRestored", { fmt: "JPEG" }), "ok");
  });

  it("WhatsApp → Telegram → Original vuelve al formato de ANTES del primer sticker", () => {
    const { result } = setup();
    act(() => result.current.setFormat("jpeg"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("sticker-telegram"));
    expect(result.current.format).toBe("png");
    act(() => result.current.setPresetId("original"));
    expect(result.current.format).toBe("jpeg");
  });

  it("pasar de un sticker a un preset sin formato (Amazon) también lo devuelve", () => {
    const { result } = setup();
    act(() => result.current.setFormat("jpeg"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("amazon"));
    expect(result.current.format).toBe("jpeg");
  });

  it("si el formato previo ya era el del preset, no hay aviso de formato", () => {
    const { result, toast } = setup();
    act(() => result.current.setFormat("webp"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("original"));
    expect(toast).not.toHaveBeenCalledWith(t("export.presetFormat", { fmt: "WEBP" }), "ok");
    expect(toast).not.toHaveBeenCalledWith(t("export.formatRestored", { fmt: "WEBP" }), "ok");
    expect(result.current.format).toBe("webp");
  });
});
```

- [ ] **Paso 2: verificar que fallan.** Corré `npx jest src/features/cutout/hooks/useExport.test.js -t D2`.
Esperado: FAIL (hoy queda `webp`/`png` y no hay aviso).

- [ ] **Paso 3: implementar.** En `useExport.js` (sumá `useRef` al import de react). Encima de `setPresetId`
va `const formatBeforePreset = useRef(null); // formato del usuario antes del 1er preset que lo impuso`.
`setPresetId` queda así:

```js
  const setPresetId = useCallback((id) => {
    setPresetIdRaw(id);
    const preset = EXPORT_PRESETS.find((p) => p.id === id)?.preset;
    if (preset?.format) {
      // se guarda el del usuario una sola vez: WhatsApp → Telegram no lo pisa
      if (formatBeforePreset.current == null) formatBeforePreset.current = format;
      if (preset.format !== format)
        toast(t("export.presetFormat", { fmt: preset.format.toUpperCase() }), "ok");
      setFormat(preset.format);
    } else if (formatBeforePreset.current != null) {
      // salir del preset que imponía formato devuelve el que tenía el usuario (D2)
      const prev = formatBeforePreset.current;
      formatBeforePreset.current = null;
      if (prev !== format) toast(t("export.formatRestored", { fmt: prev.toUpperCase() }), "ok");
      setFormat(prev);
    }
    if (!preset) return;
    if (preset.bg) {
      // (bloque de fondo existente, sin cambios)
    } else {
      // (bloque existente, sin cambios)
    }
  }, [exportMode, bgColor, format, toast]);
```
Sale la línea vieja `if (preset.format) setFormat(preset.format);`, y los dos bloques de fondo quedan
idénticos a como están. i18n:
- es: `"export.presetFormat": "El preset fija el formato {fmt}",` y `"export.formatRestored": "Volvió tu formato: {fmt}",`
- en: `"export.presetFormat": "The preset sets the format to {fmt}",` y `"export.formatRestored": "Your format is back: {fmt}",`
- pt: `"export.presetFormat": "O preset fixa o formato {fmt}",` y `"export.formatRestored": "Seu formato voltou: {fmt}",`

- [ ] **Paso 4: verificar.** Corré `npm run test:unit`. Esperado: PASS, con los 4 tests de D2 y los de sticker existentes.

- [ ] **Paso 5: commit**

```bash
git add src/features/cutout/hooks/useExport.js src/features/cutout/hooks/useExport.test.js src/lib/i18n.js
git commit -m "fix(export): salir de un preset de sticker devuelve el formato previo y avisa (GROW-35 D2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: D3. Sticker Studio fuera de `docs/ROADMAP.md`

Son docs internas y no llevan test automático. Se verifica con grep.

- [ ] **Paso 1: reemplazar** `docs/ROADMAP.md:25-26` por
`> - **Sticker Studio** retirado en GROW-34: los stickers salen de los presets «Sticker WhatsApp/Telegram 512» de Exportar.`
y el bullet de `:117-118` por
`- **Pack de stickers**: varios stickers en ZIP + ícono de bandeja 96 para WhatsApp (los presets de 512 ya existen)`.
- [ ] **Paso 2: verificar.** Corré `grep -n "STICKERS_ENABLED\|Sticker Studio\*\* (ya\|oculto tras" docs/ROADMAP.md`.
Esperado: sin salida.
- [ ] **Paso 3: commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): quitar Sticker Studio y STICKERS_ENABLED (GROW-35 D3)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Licencias (libwebp BSD-3-Clause, @jsquash/webp y wasm-feature-detect Apache-2.0)

**Archivos:** crear `scripts/licenses.test.mjs` y `public/licenses/libwebp-COPYING.txt`; modificar
`scripts/gen-licenses.mjs` y `src/generated/licenses.json`.

`@jsquash/webp` ya entra solo, porque `gen-licenses` recorre `dependencies`. Faltan dos cosas.
`wasm-feature-detect` es transitiva y viaja en el bundle. libwebp va compilada adentro del `.wasm` y su
BSD-3 exige reproducir el aviso de copyright en distribuciones binarias, así que el texto se publica
como archivo estático y se referencia desde la entrada. La pantalla «Acerca de» ya lista `licenses.json`
y los Términos remiten a ella, así que no hace falta UI nueva.

- [ ] **Paso 1: escribir el test que falla.** `scripts/licenses.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { entries } = JSON.parse(fs.readFileSync(path.join(root, "src/generated/licenses.json"), "utf8"));
const find = (re) => entries.find((e) => re.test(e.name));

test("licencias del encoder WebP (GROW-35)", () => {
  assert.equal(find(/^@jsquash\/webp$/)?.license, "Apache-2.0");
  assert.equal(find(/^wasm-feature-detect$/)?.license, "Apache-2.0");
  const libwebp = find(/^libwebp/);
  assert.match(libwebp?.license ?? "", /BSD-3-Clause/);
  assert.match(libwebp.license, /\/licenses\/libwebp-COPYING\.txt/);
  const txt = fs.readFileSync(path.join(root, "public/licenses/libwebp-COPYING.txt"), "utf8");
  assert.match(txt, /Copyright \(c\) 2010, Google Inc\./);
  assert.match(txt, /Redistribution and use in source and binary forms/);
});
```
- [ ] **Paso 2: verificar que falla.** Corré `node --test scripts/licenses.test.mjs`. Esperado: FAIL (falta `@jsquash/webp` en el json).
- [ ] **Paso 3: implementar.**
- `public/licenses/libwebp-COPYING.txt`: copiá el texto EXACTO de `COPYING` de libwebp, tomado de la
  fuente oficial (`https://chromium.googlesource.com/webm/libwebp/+/refs/tags/v1.1.0/COPYING`). No
  sale de memoria (P-1.6). Agregá debajo el `PATENTS` del mismo tag, con una línea en blanco de separación.
- `scripts/gen-licenses.mjs`: después del `for` de `pkg.dependencies` va:

```js
// Lo que viaja DENTRO del bundle sin figurar en package.json (GROW-35): la
// dependencia transitiva de @jsquash/webp y libwebp, compilada en su .wasm.
// El aviso BSD de libwebp se publica completo en /licenses/.
const depVersion = (name) => {
  try {
    return JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version;
  } catch {
    return "?";
  }
};
entries.push(
  { name: "wasm-feature-detect", version: depVersion("wasm-feature-detect"), license: "Apache-2.0", source: "npm" },
  {
    name: "libwebp (en @jsquash/webp)",
    version: "1.1.0",
    license: "BSD-3-Clause (texto: /licenses/libwebp-COPYING.txt)",
    source: "embebido",
  }
);
```
- Corré `npm run licenses`.
- [ ] **Paso 4: verificar.** Corré `node --test scripts/licenses.test.mjs` (esperado: PASS) y `npm test` (esperado: verde).
- [ ] **Paso 5: commit**

```bash
git add scripts/gen-licenses.mjs scripts/licenses.test.mjs src/generated/licenses.json public/licenses/libwebp-COPYING.txt
git commit -m "chore(licencias): libwebp BSD-3 (aviso completo), @jsquash/webp y wasm-feature-detect (GROW-35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Guía de stickers ES/EN/PT re-medida en Chrome **y** WebKit

**Archivos:** modificar `scripts/pruebas/lib.mjs`, `scripts/pruebas/tests-d.mjs:96-160`, `scripts/pruebas.json`,
`public/guias/stickers-de-whatsapp-y-telegram.html`, `public/en/guides/whatsapp-and-telegram-stickers.html`
y `public/pt/guias/figurinhas-de-whatsapp-e-telegram.html`.

Hoy el arnés de «Lo probamos» es solo Chrome (`lib.launch()` usa `channel:"chrome"`). Para el slug de
stickers se suma una segunda medición en WebKit dentro del mismo test. El JSON sigue teniendo una
entrada por slug, y `browser` pasa a decir `Chrome X + WebKit Y`; el byline lo muestra tal cual
(`render-pruebas.mjs:119` solo le quita el prefijo `Chrome `). El verificador ya corrió Recorte IA en
Playwright WebKit (qa/GROW-34-verifier.md, D1), así que el flujo con IA anda en ese motor.

- [ ] **Paso 1: test que falla.** En `scripts/pruebas.test.mjs`, sumá un test (y si el archivo ya tiene
helpers de lectura del JSON, usalos):

```js
test("stickers: medido también en WebKit y WebP real en los dos motores (GROW-35)", () => {
  const e = JSON.parse(fs.readFileSync(path.join(root, "scripts/pruebas.json"), "utf8"))["stickers-de-whatsapp-y-telegram"];
  assert.match(e.browser, /^Chrome .+ \+ WebKit /);
  assert.equal(e.result.whatsapp.format, "webp");
  assert.equal(e.result.webkit.whatsapp.format, "webp");
  assert.ok(e.result.webkit.whatsapp.kb <= 100);
  assert.deepEqual(e.result.webkit.whatsapp.cornersAlpha, [0, 0, 0, 0]);
});
```
(Ajustá `fs`, `path` y `root` a lo que ya importa ese archivo.) Corré `node --test scripts/pruebas.test.mjs`
y esperá FAIL (no hay `result.webkit`).

- [ ] **Paso 2: arnés.** En `scripts/pruebas/lib.mjs`: `import { chromium, webkit } from "playwright-core";`
y `export async function launchWebKit() { return webkit.launch({ headless: true }); }`.
En `tests-d.mjs`, el cuerpo de `TESTS["stickers-de-whatsapp-y-telegram"]` se parte en una función
`measureStickers(browser)`, con el mismo código que hoy (abrir editor, IA, contorno, `ref`, `wa`, `tg`),
que devuelve `{ ai, ref, wa, tg }`. El test queda así:

```js
TESTS["stickers-de-whatsapp-y-telegram"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const ch = await measureStickers(browser, file);
  const wk = await L.launchWebKit();
  let sf;
  try {
    sf = await measureStickers(wk, file);
  } finally {
    await wk.close();
  }
  // ... return con lo de Chrome exactamente igual que hoy, más:
  //   browser: `Chrome ${browser.version()} + WebKit ${wkVersion}`,   (guardá wk.version() antes del close)
  //   result: { ...igual, webkit: { whatsapp: sf.wa, telegram: sf.tg } },
  //   findings: [...los 3 de hoy, uno nuevo con los números de WebKit]:
  //   `En WebKit ${wkVersion} (el motor de Safari): Sticker WhatsApp ${sf.wa.format === "webp" ? "WebP" : sf.wa.format} de ${sf.wa.w} × ${sf.wa.h} px y ${f(sf.wa.kb, 1)} KB, alfa ${sf.wa.cornersAlpha.join(", ")} en las esquinas; ese motor no crea WebP por sí solo y el archivo lo armó el codificador propio del editor.`
};
```
Agregá a `steps` la línea: «Repetí todo en WebKit (el motor de Safari) para comprobar que el WebP sale igual.»

- [ ] **Paso 3: medir.** Corré `npm run build && (npx vite preview --port 4399 &) && node scripts/pruebas/run.mjs stickers-de-whatsapp-y-telegram`.
Esperado: `ok` con `whatsapp.format: "webp"` en los dos motores. **Si WebKit no puede correr el arnés**
(IA, descargas o lo que sea), no se inventan números: el finding de WebKit sale, `result.webkit` queda
en `null`, el test del Paso 1 se adapta para exigir que el caveat lo diga (y no se debilita lo de Chrome),
y el caveat lo explica.

- [ ] **Paso 4: caveat y traducciones (los escribe una persona, P-23).** En `scripts/pruebas.json` →
`caveat` ES y `i18n.en` / `i18n.pt` (`caveat`, el finding nuevo y el step nuevo) va: «Medí en Chrome y en
WebKit de Playwright sobre macOS, no en un iPhone ni en Safari reales. El peso del WebP cambia según el
motor (X KB en Chrome, Y KB en WebKit) porque no es el mismo codificador.» Después siguen las
limitaciones actuales (100 KB no alcanzados, sin ícono de 96 y pack no probado dentro de las apps).
Corré `node scripts/render-pruebas.mjs stickers-de-whatsapp-y-telegram`.

- [ ] **Paso 5: copy de la guía.** En los tres idiomas, en el párrafo «Para WhatsApp», después de
«el panel solo deja el formato WEBP» / «only offers the WEBP format» / «só deixa o formato WEBP»:
- ES: «Sale WebP en cualquier navegador: si el tuyo no sabe crearlo (le pasa al motor de Safari), el editor usa su propio codificador, que se descarga una vez y queda guardado.»
- EN: «You get a WebP in any browser: if yours can't create one (Safari's engine can't), the editor uses its own encoder, which downloads once and stays cached.»
- PT: «Sai WebP em qualquer navegador: se o seu não sabe criá-lo (acontece com o motor do Safari), o editor usa o próprio codificador, que é baixado uma vez e fica guardado.»
Ningún texto fuera de «Lo probamos» cita KB de un solo motor como si valiera para todos (regla del arquitecto).
- [ ] **Paso 6: verificar.** Corré `node --test scripts/` (esperado: verde) y `grep -c "WebKit" public/guias/stickers-de-whatsapp-y-telegram.html public/en/guides/whatsapp-and-telegram-stickers.html public/pt/guias/figurinhas-de-whatsapp-e-telegram.html` (esperado: ≥1 en cada archivo).
- [ ] **Paso 7: commit**

```bash
git add scripts/pruebas/lib.mjs scripts/pruebas/tests-d.mjs scripts/pruebas.test.mjs scripts/pruebas.json public/guias/stickers-de-whatsapp-y-telegram.html public/en/guides/whatsapp-and-telegram-stickers.html public/pt/guias/figurinhas-de-whatsapp-e-telegram.html
git commit -m "docs(guias): stickers re-medidos en Chrome y WebKit; WebP en cualquier navegador (GROW-35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: A5. Smoke en el escritorio (Tauri, macOS WKWebView)

Tauri usa el mismo motor JS y su CSP ya permite `'wasm-unsafe-eval'`, `worker-src 'self' blob:` y
`connect-src 'self'`. No hay test automático: es un smoke manual con evidencia en bytes.
- [ ] **Paso 1:** corré `npm run tauri dev` (requiere toolchain Rust). Después abrí
`public/media/guias/quitar-fondo-antes.jpg` y aplicá Recorte automático. Primero, preset «Sticker WhatsApp» → Guardar
`a.webp`. Segundo, Original con chip WEBP → Guardar `b.webp`. Tercero, pestaña Archivo con WebP → Descargar `c.webp`.
Por último, cortá la red y exportá WebP en una sesión limpia: debe aparecer el toast de error y no debe abrirse ningún diálogo.
- [ ] **Paso 2: verificar.** Corré `for f in a b c; do xxd -l 16 ~/Downloads/$f.webp; done` (o la ruta elegida).
Esperado: `RIFF....WEBPVP8X` en los tres, y el filtro del diálogo «WebP». Fijate también que la consola
de devtools no muestre violaciones de CSP por `fetch(blob:)` (ya pasa por ese camino hoy en `saveExport`).
- [ ] **Paso 3:** el resultado va al handoff de retorno. **Si no se puede correr** (sin toolchain o sin
macOS), se declara «A5 NO VERIFICADO» en el handoff y en `engram/qa/_debt.md` (Task 14). Nunca «asumido».

### Task 14: Deuda, lastmod y cierre

- [ ] **Paso 1: deuda.** Agregá a `engram/qa/_debt.md`:

```markdown
- **GROW-35 (2026-10-10) — riesgos aceptados del encoder WebP propio** (revisión del arquitecto):
  - libwebp 1.1.0 (dentro de @jsquash/webp 1.5.0, solo encoder; decoder CVE-2023-4863 excluido). La entrada son píxeles propios: superficie baja. Revisar CVEs del encoder al subir de versión.
  - Alfa premultiplicado: getImageData des-premultiplica y pierde precisión RGB en bordes de alfa muy bajo. Igual que el camino nativo de Chromium; visualmente nulo.
  - El peso del WebP difiere entre motores para la misma calidad: los criterios piden «≤100 KB», no bytes exactos, y la guía no cita KB de un motor como universales.
  - Camino inline (Safari < 16.4, sin OffscreenCanvas): la composición sigue en el hilo principal (solo el encode va al worker), y en Safari < 15 (sin module workers) WebP da el aviso de error en vez del archivo.
  - Medido en WebKit de Playwright (macOS), no en Safari ni iPhone reales. El CI de Linux usa el WebKit de Playwright para Linux, donde la ruta WASM puede no ejercitarse (el chequeo `ruta=wasm` es solo darwin).
  - A5 escritorio: <VERIFICADO con evidencia | NO VERIFICADO: motivo> (completar desde la Task 13).
```
- [ ] **Paso 2: verificación completa.** Corré `npm run build && npm test && npm run test:web`. Esperado:
jest verde, `node --test scripts/` verde y «✓ todo verde», con `[webkit]` en `webp-test` y `reencode-test`.
- [ ] **Paso 3: lastmod** (se tocaron 3 páginas en la Task 12). Corré `npm run lastmod` y después:

```bash
git add scripts/lastmod.json engram/qa/_debt.md
git commit -m "chore: lastmod de la guía de stickers ES/EN/PT + deuda GROW-35 [lastmod-skip]" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Paso 4: entrega.** El ticket pasa a «En revisión QA» (nunca «Done»). El handoff de retorno (≤6 líneas,
P-1) lleva status, archivos, riesgos (incluido el estado de A5) y cómo probar: `npm run test:web`.
Además, la regresión G6 de bytes la mide QA/verifier: `vite preview` de `main` (:4400) contra la rama
(:4399) en Chrome, comparando el hash de transparente PNG/WebP, Color PNG/JPEG y desenfoque PNG, que
tiene que dar idéntico. No se pushea sin pedido del orquestador. Si se pushea, hay que mirar el CI.

---

**Criterios de aceptación (Gherkin del §QUÉ) → dónde se cumplen**

| Criterio | Tarea | Evidencia |
|---|---|---|
| Sin WebP nativo, «Sticker WhatsApp» da `RIFF....WEBPVP8X`, flag alfa, esquinas 0, 512², ≤100 KB y nombre `*.webp` | 3, 5, 8 | jest `canvasToBlob` (detector=false → encoder); jest useExport (nombre por tipo); `webp-test [webkit]` (bytes) |
| Ídem chip WebP sin preset y pestaña Archivo → WebP | 3, 4, 6, 8 | `webp-test` §2 y §3 en WebKit; jest `reencodeToBlob` y `useReencode` |
| Encoder falla → ninguna descarga y aviso en el idioma de la UI | 1, 2, 7 | jest webpWasm (OOM, init, >16383), router (worker muere, sin module workers), useExport (en) y useReencode |
| Chrome: bytes idénticos a main (G6) y sin request al `.wasm` | 3, 8, 14 | jest «con WebP nativo jamás el WASM»; `checkChrome` en el runner; hash main contra rama (QA) |
| El nombre SIEMPRE coincide con los magic bytes (PNG/JPEG/WebP) | 4, 5, 6, 8 | jest «el nombre siempre coincide…» (3×3); `webp-test` §4 (tipo = bytes, editor y Archivo) |
| D2: Sticker WhatsApp → Original devuelve el formato previo (+ aviso) | 9 | jest D2 (4 casos) |
| `npm run test:web` con corrida WebKit para los casos WebP | 8 | `WEBKIT_TESTS`, CI con `install --with-deps webkit` |
| Guía de stickers re-medida en WebKit además de Chrome (o caveat) | 12 | `pruebas.json` → `result.webkit`, test del arnés y caveat |
| Privacidad: 0 requests fuera del origen durante el export WebP en WebKit | 8 | `checkWebkit` (foreign = []) |
| A1 Archivo fuera del hilo principal y la última gana | 2, 6 | jest router/worker y `latestRunner`; jest useReencode (1 en vuelo) |
| A3 detección por contexto + `optimizeDeps.exclude` | 1, 2 | memo por módulo; test node env (worker directo); `vite.config.js` |
| A4 >16383 / OOM → error y mapeo de calidad testeado | 1, 3, 7 | `toWebpQuality` it.each; límite 16383/16384 |
| A5 Desktop | 13 | smoke `xxd` o «NO VERIFICADO» en deuda |
| D3 | 10 | grep vacío |
| Licencias | 11 | `scripts/licenses.test.mjs` |

**Qué está verificado y qué no:** lo verificado en el spike son la sonda `canEncodeWebP` (Chromium 148 y
WebKit 26.4, ventana y worker), `import("@jsquash/webp/encode.js")` + `init()` + `encode(imageData,{quality})`
(ventana y worker, alfa intacto, SW cacheando el `.wasm` offline), la ausencia de requests fuera del origen
y que hace falta `optimizeDeps.exclude`. Que el encoder acepta `{data,width,height}` plano (Task 2, worker)
está verificado leyendo `encode.js` (`module.encode(data.data, data.width, data.height, …)`).
Sin verificar hasta ejecutar este plan: el worker anidado en el build (Task 2, Paso 5), el modo dev de
Vite con jSquash en WebKit (Task 8), WebKit de Playwright en Linux/CI (ruta nativa o WASM), Safari/iOS
reales y Tauri (Task 13).

**Aprobado por:** nerv-web · tech lead web · 2026-10-10

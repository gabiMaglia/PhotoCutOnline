# Plan — GROW-36 · Recorte IA: BiRefNet-lite (WebGPU) con u2netp de respaldo

**Nivel (P-11):** Strong. Cambia el modelo y el runtime de IA que usan Recorte IA, Lote e Icon Studio
(115 MB de modelo en el camino GPU, runtime WebGPU nuevo), agrega selección por capacidad del
navegador, red de seguridad con aviso, cambia el post-proceso del matte, licencias y textos públicos.
No agrega dependencias npm (el runtime WebGPU es del mismo `onnxruntime-web` 1.26 ya instalado).

## Historial de decisiones
- **2026-10-16 (1):** el PO eligió ISNet general-use int8 (oreja del perro). Se implementó en la rama
  `feat/GROW-36-isnet` (hasta f09172a).
- **2026-10-16 (2), vigente:** el benchmark completo mostró a ISNet int8 roto en imágenes de fondo liso
  (manchas en manzana/logo/firma, huecos en el logo y la taza). **Decisión nueva del PO («si»):
  BiRefNet-lite fp16 sobre WebGPU cuando el navegador tenga GPU; u2netp (WASM, como hoy) cuando no.**
  ISNet queda descartado. Esta rama (`feat/GROW-36-birefnet`) sale de `main` limpia: el `.onnx` de
  ISNet no está en ningún commit suyo. De la rama ISNet se reaplica lo reutilizable: tabla de modelos,
  red de seguridad a u2netp con aviso, canal del aviso hasta la UI, regla de nombre nuevo + test del
  SW, generador de licencias y `test/ai-quality-test`.

## QUÉ — diseño

### Datos de partida (benchmark del spike: Chrome 155, AMD RDNA-1, ORT web 1.26, esta Mac)
| | u2netp (WASM) | BiRefNet-lite fp16 (WebGPU) |
|---|---|---|
| Archivo | 4 574 861 B | 114 834 127 B (sha256 `40598960…c0d964a`… ver abajo) |
| Entrada | `input` 1×3×320×320, ImageNet | `input_image` 1×3×1024×1024 float32, squish, ImageNet mean/std |
| Salida | min-max | `output_image` 1×1×1024×1024 float32 **logits** → sigmoid (sin min-max) |
| Crear sesión | 0,5 s | 21 s (compila shaders) |
| Inferencia | ~2,6 s | 1.ª 15 s, luego ~3,4–5 s |
| Memoria wasm | 227 MB | 535 MB (80 nodos `Gather` siguen en CPU, según la model card) |
| Calidad | corta la oreja del perro, pierde el texto del logo | la mejor en las 7 láminas (perro, persona, sticker, logo con texto, firma, manzana, taza) |

sha256 completo: `4059896039dfccb0f15b9080ff06d11d90e499449bb045e797055eb8901cf5f4` (coincide con la
«Provenance» de la model card).

### Licencia (leída la model card del export, 2026-10-16)
- Export: `huggingface.co/jiabins0303/birefnet-lite-1024-webgpu`, `onnx/model_fp16.onnx`. Metadata del
  repo y card: **MIT**, «that covers the **weights**». Es un reescrito de topología (Split en árboles,
  GatherND→Gather) del export `onnx-community/BiRefNet_lite-ONNX`; pesos sin cambios.
- Modelo original: **BiRefNet** (ZhengPeng7/BiRefNet, Peng Zheng et al., MIT). Se cita a los autores.
- **Salvedad que la propia card declara:** BiRefNet_lite se entrenó con **DIS5K** entre otros, y los
  términos de DIS5K restringen el uso comercial del *dataset*; la card dice que eso es una pregunta
  abierta que un MIT aguas abajo no resuelve. El sitio tiene anuncios ⇒ **queda anotado para el PO**
  (no bloquea la implementación; se publica la salvedad en el aviso de licencias, sin afirmar más).
- u2netp (U²-Net, xuebinqin, Apache-2.0) se sigue sirviendo: va también en el aviso.

### Enfoque
1. **Selección (dentro del worker, donde corre la IA):**
   `navigator.gpu` → `requestAdapter()` con adapter → `adapter.limits.maxStorageBuffersPerShaderStage
   ≥ 8` (requisito de la model card) ⇒ BiRefNet sobre WebGPU. Cualquier otra cosa ⇒ u2netp sobre WASM,
   exactamente como hoy (mismo runtime, mismo peso: quien no tiene GPU no baja nada nuevo).
   - **WebGPU en Worker, verificado (2026-10-16, Playwright):** Chrome 155 headless expone
     `navigator.gpu` en página **y en worker**, con el mismo adapter (amd rdna-1,
     maxStorageBuffersPerShaderStage 10, shader-f16). WebKit de Playwright 26.4: `navigator.gpu`
     ausente en página y en worker. **Safari 26.6.1 real no se pudo automatizar** (safaridriver exige
     «Allow remote automation», que no está habilitado en esta Mac): queda sin verificar si Safari 26
     expone WebGPU en workers. **Decisión: la IA sigue corriendo en el worker.** Justificación: Chrome
     (la mayoría del tráfico) lo soporta en worker; la UI no se congela durante 21 s de compilación y
     3–15 s de inferencia; y la detección corre en el mismo contexto que la inferencia, así que si un
     navegador no expone WebGPU en workers cae a u2netp sin romperse (peor calidad, no un error).
     Correr en el hilo principal bloquearía la UI y obligaría a duplicar la sesión de recorte.
2. **Modelo partido en 2 partes same-origin** (GitHub rechaza > 100 MB):
   `public/models/birefnet-lite-1024-fp16.onnx.part0` y `.part1` (< 60 MB c/u). Nombre versionado (el SW
   cachea por nombre). `scripts/split-model.mjs` regenera las partes y `src/lib/modelParts.json`
   (bytes por parte + sha256 del total); test que ata partes ↔ JSON ↔ sha. En el worker:
   fetch en streaming de cada parte escribiendo directo en un `Uint8Array(total)` (sin duplicar
   memoria), progreso sumado sobre el total, **sha256 (`crypto.subtle`) del total antes de crear la
   sesión**; si no coincide (o no hay `crypto.subtle`) ⇒ error ⇒ red de seguridad a u2netp.
   El SW no lo precachea (`keep`, no `shell`) — test.
3. **Runtime WebGPU:** `import("onnxruntime-web/webgpu")` (bundle 113 KB) solo en el camino GPU, con
   `wasmPaths` al `ort-wasm-simd-threaded.asyncify.{wasm,mjs}` de la misma versión. El paquete 1.26 ya
   exporta esos archivos en `exports`, así que se importan con `?url` desde el paquete (no hace falta
   vendorear 24 MB en git); `ort-runtime/LEEME.md` lo documenta. El camino sin GPU sigue con el wasm
   vendoreado de siempre. Medir el peso (sin comprimir y Brotli, Vercel comprime `wasm`).
4. **Red de seguridad:** si BiRefNet falla al descargar/verificar/crear/correr (OOM, device lost, sha),
   se libera su sesión, se pasa a u2netp (runtime WASM, instancia separada) y la misma imagen se corta
   con u2netp; pegajoso para la vida del worker; aviso i18n es/en/pt una sola vez (canal de progreso,
   ya probado en la rama ISNet). Si u2netp también falla, se propaga el error original.
   Limitación: si el navegador mata la pestaña por memoria no hay excepción que atrapar.
5. **`refineMatte` por modelo:** el filtro de componentes «≥ 12 % del mayor» borra las letras de un logo
   (medido en «Lo probamos»: banda del texto 33 % → 0 %). Para BiRefNet: sin estiramiento 50..205 (su
   sigmoid ya es casi binario) y el filtro pasa a un mínimo **absoluto** relativo a la imagen (componentes
   < 0,05 % del área, p.ej. 261 px en 820×637, se tiran; una letra del logo ocupa ~0,1–0,4 %), con la
   misma banda de 4 px. u2netp conserva su post-proceso actual (allí el filtro sí hace falta: niebla).
   `aiMatte` devuelve `{ matte, refine }` y los 3 llamadores (worker aiCut/removeBg, inline) pasan
   `refine` a `refineMatte`/`aiCutFromMatte`.
6. **Textos:** «~7 MB» → por camino: con GPU «~140 MB la primera vez» (115 MB de modelo + runtime
   WebGPU comprimido, medido), sin GPU «~7 MB» como hoy. El aviso de descarga del toast/onboarding se
   arma con el peso real del camino elegido (`warmupAi` informa `total`; el texto inicial del toast no
   puede saber el camino antes de detectar ⇒ se elige en el worker y el toast muestra «Descargando
   modelo… N %» con el total real). Páginas cómo-funciona es/en/pt, llms.txt, autor, launch kit,
   docs, comentarios y licencias.
7. **«Lo probamos»:** Playwright Chrome headless de esta Mac tiene WebGPU ⇒ se re-corren las guías con
   Recorte IA, se revisan conclusiones/caveats y traducciones EN/PT, `pruebas:render`, `lastmod`
   `[lastmod-skip]`.

### Contratos que cambian
- `aiMatte(imageData, onNotice)` resuelve `{ matte, refine }` (antes: el matte solo).
- `refineMatte(matte, w, h, opts?)`, `CutoutSession.aiCutFromMatte(matte, opts?)`: opciones opcionales;
  sin ellas, comportamiento de hoy.
- `backend.aiCut(onProgress?)`, `backend.removeBg(img, onProgress?)`; etapa `{stage:"fallback", model}`.
- Modelos servidos: `/models/birefnet-lite-1024-fp16.onnx.part{0,1}` + `/models/u2netp.onnx`.

### Pruebas (rojas primero contra `main`)
- Unit (jest): selección GPU/no GPU/límite < 8; partes concatenadas con progreso sumado; sha que no
  coincide ⇒ u2netp + aviso; BiRefNet falla al crear o al correr ⇒ u2netp misma imagen + aviso,
  pegajoso, error original si ambos fallan; preprocesado ImageNet 1024 y sigmoid; los D1/D-02 siguen.
- Unit: `refineMatte` con opciones BiRefNet conserva «letras» (componentes chicos pero no motas) y
  tira motas; sin opciones, comportamiento de hoy (las letras se pierden).
- node --test: `split-model` determinista; partes reales ↔ `modelParts.json` ↔ sha; SW sin `.onnx*`
  en shell; licencias de los modelos.
- E2E `test/ai-quality-test` (Chrome): reconoce la ruta. Con GPU: BiRefNet en el retrato deja menos
  niebla que u2netp y en el logo conserva el texto; sin GPU (CI Linux): dice «ruta=u2netp», verifica
  u2netp y no falla. Respaldo forzado (partes rotas) ⇒ aviso. `test/ai-test` sigue.
- `npm test`, `npm run build`, `npm run test:web` verdes (puerto 5187 libre).
- Medición real (Playwright Chrome con GPU): perro 1.ª y 2.ª vez + captura en el scratchpad; Lote e
  Icon Studio, tiempo por imagen.

### Riesgos
- **Descarga ~140 MB** la primera vez en el camino GPU (antes ~7 MB); la 1.ª inferencia de la sesión
  tarda ~36 s (21 s compilar + 15 s) y las siguientes ~3,5 s. El idle-release de 30 s obligaba a recompilar
  (21 s) tras una pausa ⇒ **decidido (coordinador, 2026-10-16): 5 min con BiRefNet, 30 s con
  u2netp**. Cada modelo declara su `idleMs` y `aiIdleMs()` lo expone a los dos timers (worker e
  inline); si BiRefNet cae a u2netp rige el de u2netp. Costo: hasta 5 min de ~535 MB de heap +
  VRAM residentes tras el último corte con GPU.
- **Memoria:** 535 MB de heap wasm + VRAM; en equipos con GPU integrada y poca RAM puede morir la
  pestaña (sin excepción, el respaldo no aplica).
- **Safari 26 en worker sin verificar** (ver 1). Si no expone WebGPU en workers, Safari usa u2netp.
- **CI sin GPU:** la ruta BiRefNet no se ejercita en CI; solo localmente.
- **Licencia de datos DIS5K** (ver arriba) — decisión del PO.
- **Vercel:** sin límite por archivo en deploy por git; el `.onnx` no se comprime (octet-stream);
  ancho de banda ~140 MB por visitante con GPU que usa la IA.
- **Escritorio (Tauri):** el instalador crece ~140 MB (modelo + runtime asyncify).

### Fuera de alcance
- Modelo 512 (más rápido, menos fino) como opción del usuario.
- WebGPU en el hilo principal para Safari si no lo expone en workers.

## CÓMO — plan de implementación
1. Este plan, commit solo.
2. Reaplicar lo reutilizable de la rama ISNet sin ISNet (tabla de modelos, red de seguridad, canal del
   aviso, i18n del aviso, hooks, test SW, generador de licencias): commit.
3. Partes del modelo: `scripts/split-model.mjs` + test (TDD), generar `public/models/*.part{0,1}` y
   `src/lib/modelParts.json`; test SW de partes fuera del shell.
4. aiSegmenter (TDD): selección por adapter, runtime WebGPU con `?url` del paquete, descarga por
   partes + sha256, BiRefNet (ImageNet 1024, sigmoid), respaldo; devolver `{matte, refine}`.
5. `refineMatte` con opciones (TDD) y llamadores.
6. Licencias (NOTICE BiRefNet MIT + salvedad DIS5K + u2netp), `gen-licenses`, test.
7. E2E `ai-quality-test` con detección de ruta; `ai-test`; build; `npm test`; `npm run test:web`.
8. Textos públicos y de la app con los pesos medidos.
9. «Lo probamos»: re-correr, revisar, traducir, render, lastmod.
10. Mediciones en la app real (perro, Lote, Icon Studio) → §Mediciones de este plan; «En revisión QA».

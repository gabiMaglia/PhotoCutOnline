# Plan — BUG-09 (+ BUG-10) · Filtros y desenfoques en Safari/WebKit + pixelado más fino

**Nivel (P-11):** Strong (no Adversarial). Reemplaza el render nativo en tres funciones (Filtros, Censurar
caras, fondo desenfocado) por una primitiva propia compartida, una en el worker de exportación. No cambia
contratos entre capas (`backend.exportBlurBg` y `censorBoxes` conservan firma y tipo de retorno), no
agrega dependencias y la equivalencia es numérica y testeable en los dos motores. Lleva §CÓMO estampado
antes del código y verificador ciego. BUG-10 (pixelado) vive en la misma función (`censorBoxes`), por eso
va en este plan; si el gate exige `plans/BUG-10.md`, el orquestador lo crea apuntando acá.

**Origen:** Sprint 9 (engram/03_backlog.md, filas BUG-09 y BUG-10). PO: «dale arreglá», «tiene que andar
100 de 100 antes de salir».

## QUÉ — diseño

### Problema (medido)
- WebKit 26.4 no implementa `CanvasRenderingContext2D.filter`: `"filter" in ctx` = false; con
  `brightness(150%)` un gris 128 queda 128 (Chrome: 192). Asignar `ctx.filter` no hace nada y no lanza.
- Usos (grep de todo el repo: `src`, `public/*.html` y `public/herramientas`, `scripts`, `test`,
  `editor/`, `index.html`; excluidos `node_modules`, `dist`, `target` y el runtime vendorizado de ORT).
  Son **exactamente tres** y no hay otros:
  1. `src/features/filters/FiltersPage.jsx:55` — presets `bw/sepia/vivid/soft` (`FiltersPage.jsx:14-20`) +
     brillo/contraste (50–150 %) y saturación (0–200 %) (`FiltersPage.jsx:107-109`). En Safari, Filtros no
     hace nada y la descarga sale idéntica al original.
  2. `src/lib/faceDetect.js:142` — modo «Desenfocar» de Censurar caras (radio
     `faceDetect.js:141`). En Safari **la cara queda sin censurar**: problema de privacidad, no cosmético.
  3. `src/lib/jsEngine.js:619` — `compositeBlur`, «Descargar con fondo desenfocado» (radio 4–48,
     `ExportPanel.jsx:179-180`, default 16 `useExport.js:25`). La landing `herramientas/desenfocar-fondo`
     es HTML estático que lleva a este mismo flujo (no tiene canvas propio).
  Los `ctx.shadowBlur` (`CanvasEditor.jsx:262`, `TextToolPage.jsx:72`, `WatermarkPage.jsx:54`) no son
  `filter` y WebKit los soporta: fuera de alcance. Desktop (Tauri) usa WKWebView/WebKitGTK en macOS/Linux
  y el mismo motor JS: hoy tiene el mismo bug y este arreglo lo cubre.
- Defecto adicional de 3: el «overscan» (`jsEngine.js:617-620`) estira el fondo a `(W+2r)/W` para tapar
  la orla transparente del blur nativo ⇒ con r = 48 en 1000 px el fondo queda ~10 % ampliado y
  desalineado del sujeto nítido.
- Defecto adicional de 2: el blur nativo de la región (`faceDetect.js:139-145`) mezcla con transparente
  fuera del recorte ⇒ borde semitransparente donde la elipse toca la caja.
- **BUG-10:** pixelado con `across = round(12 − strength/100·8)` celdas a lo ancho de la caja CON margen
  (`faceDetect.js:131-133`); con el default de la UI (strength 65, `FaceCensorPage.jsx:25`) son 7 celdas
  ≈ 5,5 bloques sobre el ancho real de la cara; rango 11→4 (slider 10–100, `FaceCensorPage.jsx:190`).
  El PO lo ve «demasiado grueso y grosero».

### Enfoque (la solución como un todo)
Una idea: **los filtros y desenfoques los calcula PhotoCut en píxeles, igual en todos los navegadores;
el navegador solo dibuja.**

1. **Módulo nuevo `src/lib/pixelFilters.js`**, puro (sin DOM: corre igual en el hilo principal y en
   `cutoutWorker`), sobre objetos `{data, width, height}` tipo `ImageData`:
   - `applyColorOps(img, ops)` — `ops` es una lista ordenada `[{op, amount}]` con
     `grayscale | sepia | saturate | brightness | contrast`, aplicada **en el orden dado** con las
     definiciones de *Filter Effects Level 1*: grayscale/sepia/saturate con sus matrices exactas de la
     spec; brightness = pendiente `b`, intercepto 0; contrast = pendiente `c`, intercepto `0.5 − 0.5c`;
     resultado de **cada** función recortado a [0, 1] antes de la siguiente (semántica de la spec). Opera
     sobre RGB no premultiplicado; alfa intacto (ninguna de las cinco lo toca). El §CÓMO puede fusionar
     etapas por canal en LUT de 256, siempre que el resultado cumpla las tolerancias.
   - `gaussianBlur(img, sigma)` — `sigma` = el radio de `blur(Npx)` de CSS (en la spec, el desvío
     estándar). Aproximación por **3 box blurs separables** (anchos de caja derivados de sigma), costo
     O(píxeles) independiente del radio. Bordes por **extensión del borde** (clamp), no transparente.
     Internamente en **alfa premultiplicado** (sin halos oscuros en PNG con transparencia).
     Para sigma grande se permite desenfocar a escala reducida y reescalar, si cumple las tolerancias.
   - Memoria: pico adicional ≤ 2× los bytes del `ImageData`. **Prohibido** un buffer Float32 RGBA a
     resolución completa (12 MP ⇒ 192 MB: iOS mata la pestaña).
   *Descartado:* stack blur — similar costo, pero se aleja más de la gaussiana de Chrome que 3 cajas.
   *Descartado:* reutilizar `boxBlurAlpha` (`jsEngine.js:879`) generalizándola — la usan el feather y la
   sombra del recorte; tocarla arriesga regresiones en la máscara. Queda como está.
2. **Se usa SIEMPRE, no solo como fallback.** *Por qué:* (a) mismo resultado en Chrome, Safari y desktop
   (lo que se ve y lo que mide «Lo probamos» no depende del motor); (b) un solo camino de código, probado
   en los dos motores por el arnés — un fallback solo-Safari sería código que casi nadie del equipo
   ejecuta; (c) la presencia de `ctx.filter` no garantiza que funcione (habría que sondear píxeles).
   *Costo aceptado:* Chrome pierde la GPU para estos tres casos; se compensa con 3–5.
   *Descartado:* «nativo si existe, propio si no» — más rápido en Chrome pero dos resultados distintos
   y el camino de Safari sin cobertura real.
3. **Filtros (`FiltersPage`):** la UI arma la lista de `ops` (preset + brillo/contraste/saturación en el
   mismo orden que hoy arma el string, `FiltersPage.jsx:45`) en vez de un string CSS. La vista previa se
   calcula sobre una copia reducida (lado mayor ≤ 2048 px) y se recalcula como mucho una vez por frame;
   la **descarga** recalcula a resolución completa con las mismas `ops` y conserva las dimensiones
   originales. Corre en el hilo principal (cómputo puro, movible a worker después sin cambiar la API).
4. **Censurar caras, modo Desenfocar (`censorBoxes`):** se toma la región CON margen de 3σ de la fuente
   (recortado a la imagen), se desenfoca con `gaussianBlur`, se recorta a la caja y se pega con la misma
   elipse/rectángulo de hoy. Radio sin cambios (`faceDetect.js:141`). Hilo principal (regiones chicas).
5. **Fondo desenfocado (`compositeBlur`):** `gaussianBlur` de `fullCanvas` a su tamaño, sin overscan; el
   sujeto se pinta encima como hoy. Corre donde ya corre (`cutoutWorker` vía `backend.exportBlurBg`,
   `backend.js:364-366`; inline sin OffscreenCanvas).
6. **BUG-10 — pixelado relativo a la cara:**
   - Tamaño de bloque (cuadrado) `s = max(3 px, ancho_cara / N)`, con `ancho_cara` = `b.w` de la caja
     detectada SIN margen, y `N = round(18 − (strength − 10) / 90 · 8)` ⇒ strength 10 → **18** bloques
     sobre la cara, default 65 → **13**, 100 → **10**. El margen (`pad`) y la elipse no cambian; la grilla
     cubre la caja con margen con el mismo `s` en X e Y (bloques cuadrados, hoy no lo son exactamente).
   - Cada bloque = promedio de color de su área (no el píxel de una muestra).
   - *Por qué 10–18 y no 12–24:* la literatura de reconocimiento de caras en bloques (Harmon, 1973)
     muestra rostros conocidos todavía reconocibles en retratos de ~14×18 bloques; por encima de ~18 bloques de ancho el pixelado deja de censurar.
     El default 13 es 2,4× más fino que hoy (5,5) y sigue lejos de ese umbral. **Trade-off para el PO**
     (no lo elijo yo): si quiere aún más fino que 18, la cara empieza a ser reconocible; el modo
     Desenfocar es el que se recomienda para privacidad fuerte. Este plan implementa 10–18 / default 13;
     cambiar esos números es un ajuste de constante, no de diseño.
   - Caras chicas: el piso de 3 px puede dar menos de N bloques (más censura, nunca menos).

### Errores
- Imagen o región de tamaño 0 / caja fuera de la imagen: se salta (como hoy `faceDetect.js:124`).
- `sigma` < 0,5: no-op exacto (devuelve la entrada).
- Imagen demasiado grande para `getImageData` (el navegador lanza): el error sube por el mismo camino que
  hoy un fallo de export (toast), nunca una descarga igual al original presentada como filtrada.

### Contratos que cambian
- Ninguno público. `censorBoxes(source, boxes, opts)` y `CutoutSession.compositeBlur(opts)` mantienen
  firma y retorno. `FiltersPage` deja de tener `filterString`; nadie más lo usa.

### Pruebas (criterios de aceptación; rojas primero contra `main` donde se indica)
**Jest (`src/lib/pixelFilters.test.js`, matemática pura):**
- brightness 1,5 sobre gris 128 → 192; contrast 0,5 sobre 0/255 → 64/191 (±1); grayscale(1) de
  (255,0,0) → (54,54,54) ±1; sepia(1) de (255,255,255) → (255,255,239) ±1 (matriz de la spec, con clamp);
  saturate(0) = grayscale(1) con los coeficientes de saturate de la spec ±1; orden importa:
  `[brightness 1.5, contrast 0.5]` ≠ `[contrast 0.5, brightness 1.5]` en un píxel donde el clamp actúa.
- Alfa intacto en `applyColorOps`; `gaussianBlur` de una imagen uniforme = la misma imagen (bordes
  incluidos: prueba del clamp); conserva la media de una imagen con ±0,5; píxeles con alfa 0 no tiñen a
  sus vecinos (premultiplicado).
- BUG-10: `pixelBlockPx(faceW, strength)` → para faceW = 260: strength 10 → 260/18, 65 → 260/13,
  100 → 26; nunca < 3; monótona decreciente en N al subir strength.

**Arnés (`test/filters-test.html`, nueva; en `TESTS` y en `WEBKIT_TESTS`, `run-tests.mjs:15,40`):**
- **F1 (roja hoy en WebKit):** montar `FiltersPage` con un gris 128 y brillo 150 % ⇒ el canvas de la vista
  previa y el PNG descargado tienen 192 ±1; preset B/N sobre rojo puro ⇒ (54,54,54) ±1. Mismo test en
  Chrome y en WebKit.
- **F2 (roja hoy en WebKit):** `censorBoxes` modo blur sobre un tablero de ajedrez de 8 px con una caja de
  200×240 ⇒ el desvío estándar de luminancia dentro de la elipse baja ≥ 80 % y el alfa dentro de la
  elipse es 255 en todo píxel (sin orla).
- **F3 (roja hoy en WebKit):** `exportBlurBg(16)` sobre una sesión con recorte ⇒ en una zona de fondo lejos
  del sujeto el desvío baja ≥ 80 %; las 4 esquinas no son más claras ni más transparentes que su vecindad
  (sin orla); con acabado desactivado, el sujeto (alfa de máscara 255) queda bit-idéntico al original.
- **F4 equivalencia con Chrome (solo Chrome, donde existe el nativo):** sobre una imagen opaca sintética
  (rampa en R, G, B + esquinas del cubo RGB + ruido con semilla fija, generada en JS: sin decodificar
  archivos), `applyColorOps` vs `ctx.filter` nativo para cada preset y para brillo/contraste {50, 150},
  saturación {0, 200} y una combinación con preset ⇒ máx |Δ| ≤ 2 por canal. `gaussianBlur` vs
  `blur(Npx)` nativo para sigma ∈ {2, 8, 16, 48}, en el interior (a más de 3σ del borde) ⇒ |Δ| medio ≤ 1,5
  y máx ≤ 10. Las tolerancias son las del diseño: el §CÓMO las mide en su paso 0; si el algoritmo no las
  cumple se cambia el algoritmo, no la tolerancia (cambiarlas requiere nuevo sello del arquitecto).
- **F5 consistencia entre motores:** el hash de la salida de `applyColorOps` y `gaussianBlur` sobre la
  imagen sintética fija es el MISMO en Chrome y en WebKit e igual a un valor dorado commiteado.
- **F6 BUG-10 (roja hoy):** cara sintética de 260 px de ancho con franjas verticales de 1 px de color
  único ⇒ contando cambios de color en la fila central dentro del ancho de la cara: strength 10 → 18 ±1
  bloques, 65 → 13 ±1, 100 → 10 ±1; ancho de bloque = alto de bloque ±1 px. Hoy da ≈ 9/5/3.
- **Rendimiento (Chrome headless, foto sintética 12 MP, se registra el tiempo en el log de CI):**
  vista previa de Filtros ≤ 100 ms por actualización; descarga de Filtros a 12 MP ≤ 2,5 s;
  `exportBlurBg` a 12 MP con sigma 48 ≤ 3 s. En WebKit se registra sin umbral (deuda si excede 2× Chrome).
- Evidencia visual para el PO (P-21): capturas WebKit + Chrome de los tres casos y del pixelado con
  strength 10/65/100.
- `npm test` + `npm run test:web` verdes.

### Riesgos
- **Privacidad del pixelado** (arriba): más fino = más reconocible. Se presenta al PO; los números son
  constantes ajustables.
- Rendimiento en móviles viejos: 12 MP en JS es ~1 s en la descarga de Filtros y en el fondo
  desenfocado; con vista previa reducida la UI no se congela al arrastrar sliders. Si un dispositivo real
  excede, pasar Filtros a worker es mover la llamada (API pura), no rediseñar.
- La salida ya no es bit-idéntica al export nativo de Chrome de hoy (dentro de ±2 en color; el blur
  cambia de borde transparente a borde extendido, a propósito). Las guías que citen píxeles de Filtros o
  del fondo desenfocado deben re-medirse si existen (el grep de `scripts/pruebas` no encontró ninguna).
- `getImageData` en canvas «tainted»: las fuentes son blobs/dataURL propios (mismo origen); sin cambio.

### Fuera de alcance
Nuevos filtros (blur global en Filtros, hue-rotate, etc.); pasar Filtros a worker; `shadowBlur`;
detector de caras.

**Aprobado por:** nerv-arquitecto · arquitecto · 2026-10-16

## CÓMO — plan de implementación

**Rama:** `fix/BUG-09-pixel-filters` desde `main` (0d2a87b). Sin merge ni push: los hace el orquestador
tras QA. Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Restricciones globales:** TDD (P-18): los tests nuevos se escriben primero y se guarda su salida roja
contra el árbol actual (Chrome y WebKit) antes de tocar código. Sin dependencias nuevas. Canvas siempre
montado (`display:none`), nunca `{ready && <canvas>}`: Filtros hoy lo tiene y se corrige. Textos nuevos en
es/en/pt. Nada sale del navegador. P-22: el repo no tiene `engram/09_codemap.md` ni `bin/nerv-index.sh`
(verificado): los módulos nuevos se listan en el handoff. P-1.6: no hay API de terceros nueva (Canvas 2D e
`ImageData` son estándar; Playwright se usa igual que en `run-tests.mjs`).

### Paso 0 — medición de las tolerancias (hecho, spike en scratchpad, Chrome headless)

Imagen sintética 512×512 (rampas + esquinas del cubo + ruido mulberry32), comparada contra `ctx.filter`:
- Modelo de color elegido: matrices (grayscale/sepia/saturate) en float con recorte a [0,255] por etapa;
  brightness/contrast como **tabla de 256** (la función de transferencia lineal de la spec, valor
  truncado a 8 bits, índice = entrada redondeada). Es lo que hace Chromium (FEComponentTransfer) y entra
  en lo que el §QUÉ permite («fusionar etapas por canal en LUT de 256»). Resultado: cada función sola
  máx |Δ| ≤ 1 (brillo y contraste: 0); sepia + brillo 150 + contraste 50 + saturación 200: máx 2,
  media 0,01. Variantes descartadas con número: recorte a [0,1] con redondeo final (brillo/contraste
  media 0,4–0,6), sin recorte entre etapas (máx 83), coeficientes Rec.709 en saturate (peor), tablas
  interpoladas (peor).
- **Hallazgo para el arquitecto (la tolerancia no se toca):** la cadena más larga que arma la UI (Vívido +
  brillo 130 + contraste 140 + saturación 150, 5 etapas) da máx |Δ| 6 en 0,04 % de los píxeles (media
  0,007). Son píxeles en la frontera de redondeo de Chrome (x,4975 → Chrome redondea hacia arriba),
  amplificados por 4 etapas con pendiente > 1. F4 mide la combinación con preset del §QUÉ (sepia + 3
  ajustes) con máx ≤ 2 y además **registra** (sin umbral) la cadena Vívido completa; va en Riesgos.
- Blur: 3 cajas (anchos de la spec SVG: d = ⌊σ·3·√(2π)/4 + 0,5⌋; d impar ⇒ 3 cajas de d; d par ⇒ d y d
  desplazadas más una de d+1). En el interior: σ=2 máx 11 (fuera), σ=3 máx 9, σ=4 máx 8, σ=8 máx 6,
  σ=16 máx 5, σ=48 máx 4, medias ≤ 0,9. Para σ chico Chrome usa kernel gaussiano exacto: con kernel
  exacto (radio ⌈3σ⌉) σ=1 máx 2, σ=2 máx 2, σ=3 máx 1. **Algoritmo:** σ < 3 ⇒ kernel gaussiano
  separable exacto (≤ 19 taps); σ ≥ 3 ⇒ 3 cajas (costo independiente de σ). Cumple F4 en {2, 8, 16, 48}.
- Rendimiento del prototipo: 12 MP σ=48 = 3,0 s (pasada vertical por columnas, mala localidad) ⇒ la
  pasada vertical se hace por **franjas de columnas** copiadas a un buffer chico que entra en caché;
  colorOps 12 MP = 0,95 s ⇒ etapas compiladas a arrays planos y tablas consecutivas compuestas en una.
  E/S de referencia en Chrome headless a 12 MP: `getImageData` 0,38 s, `putImageData` 0,04 s, PNG 0,45 s.

### Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/pixelFilters.js` | crear | Puro, sin DOM: `applyColorOps`, `gaussianBlur`, `pixelBlockPx`, `pixelateBlocks` |
| `src/lib/pixelFilters.test.js` | crear | Jest: matemática de la spec, alfa, bordes, media, premultiplicado, BUG-10, hash dorado (F5 en Node) |
| `src/features/filters/filterOps.js` | crear | `PRESET_OPS`, `buildOps(preset, b, c, s)`, `renderFiltered(source, ops, maxSide)` → canvas |
| `src/features/filters/filterOps.test.js` | crear | Jest: orden y omisión de identidades |
| `src/features/filters/FiltersPage.jsx` | modificar | Vista previa ≤ 2048 px con un recálculo por frame; descarga a resolución completa; error ⇒ toast; canvas siempre montado |
| `src/lib/faceDetect.js` | modificar | `censorBoxes`: blur con `gaussianBlur` sobre la región + 3σ; pixelado BUG-10 anclado a la cara |
| `src/lib/jsEngine.js` (`compositeBlur`) | modificar | `gaussianBlur` sobre una copia de `this.full`, sin overscan |
| `src/lib/i18n.js` | modificar | `filters.error` en es/en/pt |
| `test/filters-test.html`, `test/filters-test.jsx` | crear | F1–F6 + rendimiento P1–P3 |
| `test/run-tests.mjs` | modificar | `filters-test` en `TESTS` y en `WEBKIT_TESTS` |

### Interfaces
- `applyColorOps(img, ops)`: `img` = `{data: Uint8ClampedArray, width, height}`; `ops` =
  `[{op: "grayscale"|"sepia"|"saturate"|"brightness"|"contrast", amount}]` en orden. Modifica `img.data`
  **en el lugar** y devuelve `img` (cero buffers de imagen extra). Alfa intacto. Op desconocida ⇒ `Error`.
- `gaussianBlur(img, sigma)`: en el lugar, devuelve `img`. `sigma < 0,5` o no finito ⇒ no-op exacto.
  Memoria extra: líneas y franjas Float32 (≪ 1× la imagen: cumple «≤ 2×» y la prohibición del buffer
  Float32 RGBA completo). Bordes por extensión. Alfa premultiplicado internamente (si toda la imagen es
  opaca se salta la conversión). Alfa resultante 0 ⇒ RGB 0.
- `pixelBlockPx(faceW, strength)`: `strength` acotado a [10, 100]; `N = round(18 − (strength − 10)/90·8)`;
  devuelve `max(3, faceW/N)` (float).
- `pixelateBlocks(img, s, ox, oy)`: grilla de paso `s` con bordes en `round(o + k·s)`, anclada en
  `(ox, oy)` (dentro de `img`; la grilla se extiende a los dos lados); cada celda = promedio de su área
  ponderado por alfa (alfa = promedio simple). En el lugar.
- `buildOps(preset, brightness%, contrast%, saturation%)`: ops del preset y después brillo, contraste y
  saturación (el mismo orden que el string de hoy); se omiten las de amount 1 (identidad exacta).
  `renderFiltered(source, ops, maxSide = Infinity)`: canvas nuevo con la fuente reescalada a lado mayor
  ≤ `maxSide` y las ops aplicadas; si `getImageData` falla, lanza.

### Tareas

1. **Commit del plan** (`docs(plans): §CÓMO BUG-09 [lastmod-skip]`), solo este archivo.
2. **Tests rojos primero.**
   - `src/lib/pixelFilters.test.js` (falla hoy: el módulo no existe): brightness 1,5 sobre 128 → 192;
     contrast 0,5 sobre 0/255 → 64/191 ±1; grayscale(1) de rojo → (54,54,54) ±1; sepia(1) de blanco →
     (255,255,239) ±1; saturate(0) = grayscale(1) ±1; el orden importa en un píxel con clamp; alfa
     intacto; blur de imagen uniforme (alfa 255 y alfa 128) = la misma imagen; media conservada ±0,5 en
     ruido; un píxel transparente rojo no tiñe a sus vecinos verdes opacos; σ 0,3 = no-op exacto;
     `pixelBlockPx(260, 10|65|100)` = 260/18, 20, 26; piso 3; N monótona; `pixelateBlocks` promedia y
     respeta el ancla; hash dorado FNV-1a de `applyColorOps` + `gaussianBlur(σ 2 y 16)` sobre la imagen
     sintética fija.
   - `src/features/filters/filterOps.test.js`: `buildOps("vivid",130,140,150)` = saturate 1,4 · contrast
     1,08 · brightness 1,3 · contrast 1,4 · saturate 1,5; `buildOps("none",100,100,100)` = [].
   - `test/filters-test.jsx` + `.html`. F1/F2/F3/F6 usan solo APIs que ya existen en `main`; F4/F5 importan
     `pixelFilters.js` dinámicamente y fallan como FAIL, no como crash:
     - **F1**: `FiltersPage` real dentro de `CutoutProvider` (la imagen entra por `shareFile`, como en la
       app); gris 128 + brillo 150 % (input range real) ⇒ canvas de vista previa y PNG descargado (se
       intercepta el `<a download>`) 192 ±1 y mismas dimensiones que la fuente; preset B/N sobre rojo ⇒
       (54,54,54) ±1.
     - **F2**: `censorBoxes` blur, tablero de 8 px, caja 200×240 ⇒ desvío de luminancia dentro de la elipse
       −80 % o más, alfa 255 en toda la elipse, y también −80 % en la corona 0,80–0,97 del radio (donde
       se ve la orla del blur nativo).
     - **F3**: `backend.loadImage` + `cutRect` + `exportBlurBg(16)` (camino worker real) ⇒ fondo lejos del
       sujeto con desvío −80 %; 4 esquinas no más claras ni más transparentes que su vecindad; sujeto
       bit-idéntico en el interior del recuadro; **alineación**: un borde vertical del fondo (negro|blanco
       en x = 300) cruza el 50 % en x = 300 ±1 (el overscan de hoy lo corre ~8 px).
     - **F4** (solo Chrome): equivalencia con `ctx.filter` con las tolerancias del §QUÉ; la cadena Vívido
       completa se registra sin umbral (Paso 0).
     - **F5**: hash de `applyColorOps` + `gaussianBlur` = dorado (el mismo valor que en Jest) en Chrome y
       WebKit.
     - **F6**: cara sintética de 260 px, franjas de 1 px en X (canal R) y en Y (canal B) ⇒ bloques en la
       fila central 18/13/10 ±1 para strength 10/65/100; ancho = alto ±1.
     - **P1–P3** (umbral solo en Chrome; WebKit registra): foto sintética de 12 MP; vista previa de Filtros
       (`renderFiltered` a 2048) ≤ 100 ms; descarga de Filtros (`renderFiltered` completo + PNG) ≤ 2,5 s;
       `exportBlurBg(48)` a 12 MP ≤ 3 s.
   - `test/run-tests.mjs`: `filters-test` en `TESTS` y en `WEBKIT_TESTS`.
   - Correr Jest de los archivos nuevos y `npm run test:web` contra el árbol sin cambios; guardar la
     salida roja en `scratchpad/bug09/red-*.log` (la pide el gate). Commit `test(BUG-09): …` (rojos).
3. **`pixelFilters.js`** hasta verde en Jest. El hash dorado de F5 sale del código y se commitea: desde
   ahí cualquier cambio de algoritmo lo rompe a propósito.
4. **`faceDetect.censorBoxes`**. Blur: región `[bx−3σ, by−3σ, bw+6σ, bh+6σ]` ∩ imagen, dibujada en un
   canvas chico desde `source` (no desde la salida: cajas solapadas leen el original, como hoy),
   `gaussianBlur`, recorte a la caja, `putImageData` en `tmp` y el mismo pegado con elipse/rectángulo.
   Pixelado: `s = pixelBlockPx(b.w, strength)` y `pixelateBlocks` sobre la caja con margen, anclado en
   `(b.x − bx, b.y − by)`. Las regiones a mano (`b.manual`) usan el mismo cálculo con su `b.w`.
5. **`jsEngine.compositeBlur`**: `ImageData` nueva con copia de `this.full.data`, `gaussianBlur(r)`,
   `putImageData` en `out` y el sujeto encima. Sin overscan.
6. **`FiltersPage`** + `filterOps.js`: preset y sliders ⇒ `buildOps`; la base reducida se calcula una vez
   por fuente; cada cambio agenda un `requestAnimationFrame` (si ya hay uno pendiente no agenda otro);
   descarga = `renderFiltered(img, ops)` a tamaño completo ⇒ `toBlob`; excepción o blob nulo ⇒
   `onToast(t("filters.error"))` y no se descarga nada. `<canvas>` siempre montado, oculto con
   `display:none` hasta que hay imagen.
7. **i18n** `filters.error` en es/en/pt.
8. **Verde completo:** `npm test` y `npm run test:web` (Chrome + WebKit). Si la máquina está cargada y algo
   falla por tiempo, reintentar antes de declararlo flaky y reportarlo. Medir la descarga con una foto de
   12 MP (P2/P3) y reportarlo. Capturas antes/después en Chrome y WebKit (Filtros, blur de cara,
   pixelado 10/65/100) en `scratchpad/bug09/shots/`.
9. No se tocan páginas ni guías ⇒ no corresponde `npm run lastmod` (si al final se tocara alguna, se
   corre y se commitea el json con `[lastmod-skip]`).

### Criterio de salida
Todas las «Pruebas» del §QUÉ verdes en Chrome y WebKit (F4 solo Chrome), salida roja previa guardada,
tiempos de P1–P3 en el log y handoff P-1 con el hallazgo de la cadena Vívido para el arquitecto.

**Aprobado por:** nerv-web · tech lead web · 2026-10-16

### Nota de implementación (posterior al sello, sin cambio de tolerancias)
- **Blur a escala reducida para σ ≥ 16** (permitido por el §QUÉ «si cumple las tolerancias»): f = ⌊σ/8⌋
  (máx 8), promedio de bloques f×f, blur con σ corregido por la varianza del promedio y de la
  interpolación, vuelta bilineal. Motivo: con la máquina cargada, 12 MP a resolución completa tardaba
  1,4–2,4 s solo el blur. Medido contra `ctx.filter` en 18 valores de σ entre 1 y 80: máx |Δ| ≤ 10 y media
  ≤ 1,36 en todos. Con f = ⌊σ/4⌋ (más agresivo) σ 8 y 16 salían de tolerancia (máx 12–13): descartado.
- **Vista previa de Filtros a 1280 px de lado mayor** (≤ 2048 del §QUÉ): a 1600 px tardaba 106 ms (fuera
  de los 100 ms); a 1280, 62–68 ms. El canvas se muestra a `max-height: 66vh`, así que 1280 px alcanza.
- El test de «media conservada» usa una imagen más grande para σ 30 (400×300 en vez de 64×48): con
  bordes extendidos la media se conserva solo si la imagen es varias veces σ. La tolerancia (±0,5) no cambió.

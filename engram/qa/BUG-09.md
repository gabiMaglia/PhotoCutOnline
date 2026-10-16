# QA BUG-09 (+ BUG-10) — filtros y desenfoques en píxeles, pixelado más fino (nerv-qa, 2026-10-16)

## Intento 1 — **APROBADO (Strong)** · HEAD 76aa92e · rama `fix/BUG-09-pixel-filters`

Todos los criterios del §QUÉ (Jest, F1–F6, P1–P3) pasan en Chrome y en WebKit. QA lo reprodujo, no lo
tomó del log del dev. La app real anda en los dos motores con una foto con cara: Filtros, Censurar caras
(Desenfocar y Pixelar) y «Descargar con fondo desenfocado» cambian la imagen descargada en WebKit, que
antes salía igual al original. Ningún hallazgo viola el contrato. Hay cuatro deudas y dos decisiones
para el PO, listadas abajo; ninguna bloquea.

**Las dos desviaciones posteriores al sello no necesitan re-estampa.**
- La vista previa a 1280 px cumple el «≤ 2048» del §QUÉ.
- El blur a escala reducida (σ ≥ 16) lo permite §QUÉ 1 «si cumple las tolerancias», y F4 pasa en
  σ 16 y 48.
- Matiz: la nota dice que cumple «en todos» los σ entre 1 y 80, y eso no se reproduce (ver H-1). La
  causa es un término de 1 línea sin test. Sin ese término, todo σ de 16 a 80 queda dentro de
  tolerancia. Va como deuda al arquitecto.

## §Plan
- **Gate:** `nerv-gate.sh --ticket BUG-09 --level S` con `NERV_TEST_CMD="npx jest"` ⇒ **PASS**.
  - Nivel P-11 computado: **S** (1634 líneas revisables > 400). Declarado: S.
  - Compuerta de plan OK: plan estampado.
  - Proof of red OK: los tests nuevos fallan sobre `main`.
  - Suite verde. Los 14 archivos coinciden con el diff.
  - El handoff P-1 lo reconstruyó QA a partir del diff, porque no está en el repo.
- **Rojo previo** (`scratchpad/bug09/red-*.log`):
  - Jest: el módulo no existía.
  - WebKit: F1, F2, F3 y F6 en FAIL; F2 «desvío baja 9,7 %» = la cara quedaba sin censurar.
  - Chrome: F2 (orla), F3 (orla y corrimiento de 4 px) y F6 en FAIL.
- **Corridas propias de QA:**
  - `npm test`: 52 suites, 331 tests de jest y 74 de node, todo verde.
  - `npm run build`: OK.
  - `npm run test:web`: «✓ todo verde» en Chrome y WebKit, sin reintentos ni colisión de puerto.
- **App real** (vite dev :5241/:5245, Playwright Chrome y WebKit, `public/media/autor-gabriel.jpg`):
  - Filtros Sepia + brillo 130: vista previa y descarga real (evento `download`).
  - Caras: Desenfocar y Pixelar a 10, 65 y 100, cada uno con su descarga.
  - Recorte automático, después «Descargar con fondo desenfocado», después Editar › Filtros con
    cambio de fuente Original → Recorte → Original.
  - Scripts en `scratchpad/qa09/` (app.mjs, src.mjs, bench.mjs, sweep*.mjs) y capturas en `scratchpad/qa09/shots/`.
- **Mutaciones** sobre `src/lib/pixelFilters.js`, con `git checkout --` después de cada una:
  - sin premultiplicar ⇒ 2 FAIL
  - orden de etapas invertido ⇒ 1 FAIL
  - tablas con redondeo en vez de truncado ⇒ 1 FAIL
  - bordes sin extensión ⇒ 5 FAIL
  - **sin la corrección de varianza a escala ⇒ 0 FAIL: sobrevive** (H-1)
- **P-18.5:** entre el commit rojo (c439484) y el final, solo cambiaron dos cosas en los tests.
  - El test de «media conservada» agranda la imagen para σ 9 y 30 y mantiene la tolerancia de ±0,5.
    - Es correcto: con bordes por extensión, que exige el mismo §QUÉ, la media no se conserva si la
      imagen mide pocas veces σ.
    - Está documentado en la nota. No es un debilitamiento.
  - El hash dorado pasó de `pending` a su valor.

## §GAP
**Especificado (con trazabilidad al §QUÉ):** F1–F6, P1–P3, los casos de Jest de la lista «Pruebas»,
canvas siempre montado, toast de error, i18n es/en/pt, `censorBoxes`/`compositeBlur` con la misma firma.

**Deducido (comportamiento en el código que nadie definió). Va al PO; no se convierte en test:**
- **G-1** · Censurar caras recalcula `censorBoxes` a resolución completa en el hilo principal.
  - Lo hace en cada cambio del slider y en cada `pointermove` al dibujar una región a mano: `dragBox`
    está en las dependencias de `redraw`, `src/features/faceCensor/FaceCensorPage.jsx:47-78` (la
    llamada está en :56).
  - El §QUÉ 4 lo dejó en el hilo principal suponiendo «regiones chicas». En un primer plano no lo son (H-2).
- **G-2** · «Descargar con fondo desenfocado» ignora la rotación/volteo del resultado.
  - `jsEngine.js:591` sale hacia `compositeBlur` antes de `applyResultTransform` (:593).
  - **Es anterior a BUG-09** (no está en el diff) y QA no lo verificó en la UI. Es una suposición a
    confirmar; candidato a ticket aparte.
- **G-3** · Las regiones a mano (redacción de datos: patentes, texto) pixelan con la misma regla BUG-10.
  - Es decir 10–18 bloques sobre el ancho de la región (`faceDetect.js:151-154`).
  - En una patente de 7 caracteres son unos 2–2,6 bloques por carácter (antes eran ~1). Está
    especificado en §CÓMO 4, pero el efecto sobre la legibilidad de texto no se evaluó (ver P-2).

**Definido sin implementación:** ninguno.

## §Casos (1:1 contra los criterios del §QUÉ)
| Criterio | Chrome | WebKit | Evidencia |
|---|---|---|---|
| Jest: brillo, contraste, gris, sepia, saturate(0), orden, alfa, uniformes, media, premultiplicado, σ<0,5, pixelBlockPx, pixelateBlocks, hash | n/a | n/a | 24/24 + 4/4 (filterOps) |
| F1 vista previa y PNG 192 ±1 con el tamaño original; B/N (54,54,54) | PASS | PASS | qa-testweb.log |
| F2 desvío −99,9 % (≥80), borde −99,9 %, alfa 255 | PASS | PASS | ídem |
| F3 fondo −99,6 %, esquinas sin orla, sujeto bit-idéntico, borde en x=300 | PASS | PASS | ídem |
| F4 color: máx ≤2 en los 11 casos; blur σ 2/8/16/48: media ≤0,66, máx ≤8 | PASS | SKIP (no hay nativo) | ídem |
| F5 hash `325971dd-8bc0f820-85bb39b6` igual en Node, Chrome y WebKit | PASS | PASS | ídem |
| F6 18/13/10 bloques, cuadrados (15×14, 20×20, 26×26) | PASS | PASS | ídem |
| P1 vista previa ≤100 ms | 67 ms | 62 ms (registro) | ídem |
| P2 descarga de Filtros 12 MP ≤2,5 s | 1,04 s | 1,15 s | ídem |
| P3 fondo desenfocado σ48 12 MP ≤3 s | 1,04 s | 1,33 s | ídem |
| Evidencia visual (P-21) | ok | ok | `scratchpad/bug09/shots/` (antes/después) y `scratchpad/qa09/shots/` |

**Verificaciones extra de QA:**
- **Sin `ctx.filter` en el código de producto.** Grep de `.filter =`, `ctx.filter` y `"filter" in`
  en `src`, `public` (herramientas incluidas), `editor`, `index.html`, `scripts` y `test`. Solo queda
  en comentarios y en `test/filters-test.jsx:282-284`, que es la referencia nativa de F4, solo en Chrome.
  - Los `filter:`/`backdrop-filter:` de `src/styles.css` son CSS de elementos, no de canvas.
  - El diff no agrega `fetch`, XHR, `sendBeacon` ni `postMessage`.
  - En la app, los únicos requests de terceros son los de AdSense, que ya existían. Ninguno lleva la imagen.
- **Matrices de Filter Effects L1** (`pixelFilters.js:13-38`): grayscale y sepia con el monto
  recortado a [0,1] y saturate con los coeficientes 0,213/0,715/0,072 coinciden con la spec.
  - brightness: pendiente b, intercepto 0. contrast: pendiente c, intercepto 0,5−0,5c (:58-61).
  - Cada etapa se recorta antes de la siguiente (:114-121).
  - El orden de `buildOps` coincide con el string CSS anterior: preset, brillo, contraste, saturación
    (`filterOps.js:19-24` vs `main:FiltersPage.jsx:45`).
- **Riesgo 1 (Vívido+130/140/150 con Δ 6): es redondeo, no orden.** Lo medí sobre 640×640.
  - Resultado: máx 6, media 0,0069, solo 256 de 1.228.800 canales con Δ>2.
  - Control con el orden invertido: máx 37, media 3,99, 338.931 canales con Δ>2.
  - Un error de orden se vería en todos los píxeles. Esto es el cuantizado de 8 bits de las tablas
    (`pixelFilters.js:43-51`, índice redondeado en :119-121) amplificado por pendientes >1.
  - Aceptable: no se ve, y F5 garantiza el mismo resultado en todos los motores, que es lo que
    importa ahora que no se usa el nativo.
- **Alfa premultiplicado y bordes:**
  - PNG con transparente blanco alrededor de un cuadrado negro, σ 4 y 20: máx R en los píxeles
    visibles = 0, sin halo blanco.
  - Imágenes 1×1, 1×50, 50×1 y 3×3 con σ 1/5/20/100: quedan exactas.
  - Caja de cara en la esquina de la imagen con strength 100: alfa mínimo 255.
- **Memoria:** no hay buffers Float32 RGBA a resolución completa.
  - Líneas: `max(W,H)·nc` (:264-265).
  - Franja de 64 columnas: `64·H·nc` floats, unos 3 MB a 12 MP (:275).
  - Escala 1/f: `W/f·H/f·nc` floats, a lo sumo 1× el ImageData en f=2 con alfa (:294).
  - `applyColorOps` trabaja en el lugar.
  - `compositeBlur` copia `this.full` una vez (`jsEngine.js:621`).
- **FiltersPage:**
  - El canvas está siempre montado (`FiltersPage.jsx:129`).
  - La fuente Original → Recorte → Original anda en los dos motores: 0 % → 54,8 % (Chrome) / 56,5 %
    (WebKit) de píxeles transparentes → 0 %, y se conserva el Sepia elegido.
  - Descarga real a 512×512 en Chrome y WebKit, con `revokeObjectURL` síncrono (ya existía): llega
    igual en WebKit.
  - Un rAF por frame con la última ops (`useFilterPreview.js:11-23`).
- **compositeBlur:** está alineado (F3: el borde cae en x=300, antes en 304) y no estira el fondo.
  - Corre en `cutoutWorker` (F3 y P3 usan el camino real del worker), así que no congela la UI.

## §Defectos (bloqueantes)
Ninguno.

## Hallazgos no bloqueantes (deuda para que el orquestador la registre en `_debt.md`)
- **H-1 · Baja · `src/lib/pixelFilters.js:317-319` (corrección de varianza en `blurDownscaled`)**
  - **Ningún test lo cubre:** la mutación `rest = σ²` sobrevive a Jest, y en σ 16 y 48 da la misma
    caja que el código actual, así que F4 tampoco la ve.
  - **Empeora un caso:** en σ 33, que el usuario puede elegir en el slider de fondo (4–48), queda
    fuera de la tolerancia de F4.
    - Contra el nativo de Chrome, imagen de F4 (512, semilla 11): máx 11, media 1,79.
    - Contra el nativo GPU, 640×640: máx 14, media 1,86.
    - Sin la corrección, todo σ de 16 a 80 queda dentro de tolerancia en las dos imágenes.
  - **El camino sellado también se sale en un σ:** σ 5 (3 cajas, sin escala) da máx 11 en la
    imagen de F4.
  - **Conclusión:** la tolerancia solo se garantiza en los σ de F4, y la nota del dev («≤ 10 en los
    18 σ») no se reproduce. Efecto visual nulo, menos de 1 % de σ.
  - **Propuesta al arquitecto:** quitar la corrección o testearla, y ampliar F4 a un barrido de σ.
  - Ojo: el nativo de Chrome cambia ±3 según el canvas esté en GPU o en CPU, así que el umbral está
    cerca de su propio ruido.
- **H-2 · Media (UX/rendimiento) · `FaceCensorPage.jsx:47-78` + `faceDetect.js:156-164`**
  - **Tiempos medidos:** `censorBoxes` sobre 12 MP con una cara de 1100 px.
    - Chrome: 265/417/595 ms con strength 10/65/100.
    - WebKit: 676/338/384 ms.
    - 3 MP con una cara de 550 px: 113 ms (Chrome) y 71 ms (WebKit).
  - **Cuándo se nota:** se recalcula en cada evento del slider y en cada `pointermove` mientras se
    dibuja una región a mano, así que en selfies y primeros planos de alta resolución el slider y el
    arrastre van a 2–4 fps.
  - **Comparación:** antes, en Chrome, era blur de GPU (no lo medí). En WebKit antes no censuraba nada.
  - **No viola criterios:** P1–P3 no cubren Censurar caras.
  - **Propuesta:** memoizar el canvas censurado por (boxes, mode, strength), para que mover
    `dragBox` solo repinte contornos, y calcular la vista previa a escala reducida como en Filtros.
- **H-3 · Baja (deuda que el mismo §QUÉ define) · WebKit `gaussianBlur` en 12 MP con σ 3–15**
  - Tarda 4,5–4,6 s, contra 1,6–1,8 s en Chrome: 2,7×.
  - El §QUÉ dice «deuda si excede 2× Chrome». P3 solo mide σ 48 (1,33 s).
  - El slider del fondo arranca en 4 y el default es 16 (`useExport.js:25`), así que el rango 4–15 es real.
  - Corre en el worker, no congela la UI. Esperar 4–5 s al descargar en Safari es aceptable para lanzar.
- **H-4 · Info (proceso)** · El handoff P-1 de retorno no está en el repo.
  - El gate lo pide; QA lo armó desde el diff.
  - El orquestador tiene que pasarlo con la entrega.

## Decisiones para el PO (privacidad, P-3; no son defectos del código)
- **P-1 · Pixelado BUG-10.** Implementado tal como el §QUÉ: 18/13/10 bloques sobre el ancho de la cara.
  - Con la foto real a strength 10 (18 bloques) se ven la estructura de ojos, nariz, boca y cejas
    (`scratchpad/qa09/shots/chrome-faces-Pixelar-10-dl.png`).
  - **El fundamento del plan es inconsistente.** Cita a Harmon: caras conocidas reconocibles con
    ~14×18 bloques. Pero llama «lejos de ese umbral» al default 13, que está justo ahí, y el mínimo
    del slider (18) queda por encima del umbral.
  - **El PO tiene que decidir con las capturas a la vista:**
    - si acepta 10–18;
    - si sube el mínimo de bloques del slider a ≈10–12;
    - si muestra en la UI que «Desenfocar» es la opción de privacidad fuerte.
- **P-2 · Desenfocar a strength 10.**
  - σ ≈ 2,8 % del lado de la caja (`faceDetect.js:159`, radio igual que antes). La cara queda borrosa
    pero se puede reconocer (`chrome-faces-Desenfocar-10-dl.png`).
  - A 65 y 100 queda irreconocible, sin halo ni orla.
  - Ya era así en Chrome antes del arreglo. Si «cualquier intensidad debe dejar la cara irreconocible»
    es un requisito, hay que subir el mínimo del slider o el factor 0,28. Eso es un cambio de producto,
    no de este ticket.

## Para después del merge
- Mirar el CI de `main` (no está protegida). `filters-test` ahora corre también en el WebKit de
  Playwright en Linux: F5 tiene que dar el mismo hash ahí.

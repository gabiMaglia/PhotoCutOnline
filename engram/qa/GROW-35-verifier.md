# GROW-35 — Verificación ciega (P-11/P-12, Adversarial)

## Intento 2 — HEAD 1f5c1fc (incluye f9c4950, b3bff1f, 090d7e3, 0e54453, 8f1b405, d8561b8)

**Veredicto: APROBADO.** Todo lo afirmado está anclado. Ninguna suposición sostiene el veredicto.

Método: copia refrescada en el scratchpad (`verifier35/new`), `npm run build` + `vite preview`; base c13458a en `verifier35/base`. Motores: Chrome 154.0.8037.99 y Playwright WebKit 26.4. Jest en la copia: 50 suites, 303 tests verdes. No leí §CÓMO, handoffs ni informes de QA.

### Re-prueba de los defectos del intento 1
| Defecto | Estado | Evidencia |
|---|---|---|
| D1 (G7) | CERRADO | WebKit, es/en/pt: Color #ff00aa + JPEG → WhatsApp → Original. El toast dice «Volvió tu fondo (Color) y tu formato: JPEG» (en: «Your background (Color) and format are back: JPEG»; pt: «Seu fundo (Cor) e seu formato voltaram: JPEG»). El color vuelve a #ff00aa, el chip JPEG queda activo y baja `photocut-solid.jpg` con bytes JPEG. Lógica en `useExport.js:37,41-56`. |
| D2 (G3) | CERRADO | WebKit, editor, bloqueando por turno `encode-*.js`, `webp_enc*.wasm`, `webpWorker-*.js` o los tres. Mientras está bloqueado: dos intentos sin descarga, cada uno con el toast `export.webpFailed`. Al desbloquear, el primer reintento sin recargar baja WebP real con alfa (sha 5aa83db6…, el mismo que sin bloqueo), y después también el sticker de WhatsApp. Se ve un request nuevo del recurso que había fallado. El worker se descarta en `webpEncoder.js:54,61,66`. Archivo también se recupera. |
| D3 (G3) | CERRADO | WebKit, imágenes de 16384×600 (JPG y PNG transparente): estimado, descarga de Archivo, chip WebP y desenfoque WebP no descargan nada y muestran «WebP admite hasta 16383 px por lado y esta imagen es más grande. Elegí PNG o JPEG, o achicala». El sticker de WhatsApp, que sale a 512 px, sí da WebP real. Origen en `webpWasm.js:56` → `webpErrorKey`; las claves en/pt existen en `i18n.js`. |

### Tabla por garantía (intento 2)
| G | Estado | Evidencia |
|---|---|---|
| G1 | CUMPLE | WebKit: chip, WhatsApp, color y desenfoque dan `RIFF…WEBP`. La transparencia decodifica con esquinas α=0: WhatsApp 512×512, 56 % transparente. Archivo con alpha.png da WebP RGBA, esquinas α=0 en los dos motores. |
| G2 | CUMPLE | Matriz de 10 exportaciones en Chrome y en WebKit, Archivo, cadenas de presets y fallos: el nombre siempre coincide con los bytes, y cuando falla no se descarga nada. |
| G3 | CUMPLE | Ver D2 y D3. Probado en es/en/pt con el .wasm bloqueado: editor (chip y WhatsApp) y Archivo (estimado y descarga). Nunca se descarga un archivo. |
| G4 | CUMPLE | Ventanas de export (chip, WhatsApp, desenfoque, Archivo): 0 requests fuera del origen en los dos motores. Chrome no pide ningún recurso del encoder en toda la sesión. WebKit pide solo `webpWorker/encode/webp_enc_simd` del propio origen. |
| G5 | CUMPLE | WebKit, JPG de 4000×3000, 40 cambios de calidad: un solo hueco de 472–511 ms (el JPEG nativo da 338 ms) y se asienta en ~6,3 s. El estimado (2,02 MB) coincide con la descarga (2 123 054 B a calidad 12, el último valor). No se congela. |
| G6 | CUMPLE (Chrome) | Los 10 sha de exportación de rama y base son idénticos (b1d9b77c…, bb8c9995…, c58b0e33…, cd250210…, 900627bb…, 263b42f9…, 8582ea5c…, 5bfbdfd3…, 55bda630…, f199a973…). También Archivo JPG (4b906dfd…) y WebP (7d7fb20e…), el ZIP de Icon Studio (8a0be867…) y el ZIP de Lote (6da31900…). |
| G7 | CUMPLE | D1 cerrado. Cadenas probadas en es/en/pt: WhatsApp→Telegram→Amazon (vuelve JPEG con fondo blanco del preset, baja .jpg); →Original (sin cambios ocultos, .jpg); WhatsApp→Avatar (aviso «PNG» y baja PNG); cambiar a Color dentro del sticker →Original (vuelve Transparente + WEBP con aviso, baja .webp); WhatsApp → deshacer → Original (vuelve PNG con aviso). En todos los casos el aviso nombra lo que baja. |
| G8 | CUMPLE | Las guías no cambiaron desde el intento 1 (`git diff 3759539..HEAD -- public scripts/pruebas.json` vacío). Lo re-medí: Chrome WhatsApp 20,2 KB, 67,79 %, esquinas 0; Telegram 199,3 KB; WebKit WhatsApp 19,9 KB. Coincide con lo publicado. |
| Escritorio (Tauri) | ABSTENCIÓN | No lo ejecuté. |

### Regresiones buscadas (sin hallazgos bloqueantes)
- **Worker anidado y fugas:** 12 exportaciones WebP seguidas en WebKit (chip, WhatsApp, desenfoque), más 10 cambios de calidad y 3 descargas en Archivo: todo WebP real. Workers creados: un `cutoutWorker` y un `webpWorker`. En toda la sesión hubo solo 2 requests de `webpWorker` y 2 del `.wasm`: uno anidado y uno de la ventana. No se crea un worker por export.
- **Desenfoque con WebP:** WebP real en WebKit (VP8, opaco). En Chrome, mismo sha que la base.

### Observaciones (no bloqueantes)
- O1 (Baja): Color+JPEG → WhatsApp → Avatar. El aviso dice «Volvió tu formato: PNG», pero el usuario tenía JPEG; el chip JPEG queda marcado y deshabilitado. El archivo (PNG) sí coincide con el aviso.
- O2 (Baja): si el usuario cambia el fondo dentro del sticker, «Original» lo devuelve al de antes del sticker. Lo avisa con toast.
- Ya estaba en la base: Chrome recorta en silencio a 16383 px de ancho las exportaciones WebP de 16384 px.

---

## Intento 1 (histórico)

- Rama: `feat/GROW-35-webp-real` @ 3759539 (base c13458a). Worktree sin tocar; copias en scratchpad (`verifier35/new`, `verifier35/base` vía `git archive`).
- Entorno: macOS 14.8.8 · Chrome 154.0.8037.99 · Playwright WebKit 26.4 · `npm run build` + `vite preview` (4791 rama, 4792 base) · service worker bloqueado salvo en el test de caché.
- No leí §CÓMO, handoffs ni informes de QA/implementador. Jest en la copia de la rama: 50 suites / 293 tests verdes.

## Veredicto: **RECHAZADO**

Grounded: sí. Todas las afirmaciones están ancladas a archivo:línea o a bytes/salida medidos.

| G | Estado | Evidencia |
|---|---|---|
| G1 WebP real en Chrome y WebKit, con alfa | CUMPLE | WebKit, rama: chip WebP → `RIFF…WEBP` VP8X con flag de alfa, decodifica a RGBA con esquinas α=0 (78,5 % transparente). Sticker WA: 512×512, 13,0 KB, α esquinas 0. Desenfoque y color: VP8 real. Archivo: alpha.png → WebP 800×600 RGBA, α(0,0)=0 en los dos motores. Base en WebKit: los 4 casos WebP bajaban **PNG con nombre .webp** (sha e6d90b84…, 69ee6048…), así que el bug existía y está corregido. |
| G2 nombre = contenido | CUMPLE | Matriz de 10 exportaciones × 2 motores + Archivo PNG/JPG/WebP: `extOk` siempre true en la rama (en la base WebKit había 4 false). Fallos: no se descarga nada. Nombre por tipo real en `useExport.js:127` y `useReencode.js` (download). |
| G3 aviso es/en/pt y sin archivo engañoso | CUMPLE, con defectos D2 y D3 | Con `page.route` bloqueando `webp_enc*.wasm` en WebKit: chip, sticker, estimación y descarga de Archivo → **ninguna descarga** y toast `export.webpFailed` en es/en/pt (textos de i18n.js:438/885/1332). Al desbloquear, el reintento da WebP real. 16384 px en WebKit: sin descarga y con toast, pero el mensaje no corresponde a la causa (D3). Si falla el chunk JS del encoder, el reintento nunca funciona (D2). |
| G4 privacidad | CUMPLE | Requests capturados solo durante las ventanas de export (chip, WA, desenfoque, Archivo): 0 fuera del origen en los dos motores. En WebKit solo se piden `encode-*.js`, `webp_enc_simd-*.js/.wasm` y `webpWorker-*.js`, todos del propio origen. En Chrome, ninguno en toda la sesión, Archivo incluido. (Los anuncios de AdSense se cargan al abrir la página, no durante el export, y ya estaban en la base.) |
| G5 Archivo fluido y con el último valor | CUMPLE | WebKit, JPG de 4000×3000, 40 cambios de calidad cada ~25 ms con WebP: se asienta en 6,2 s. Hueco máximo de frame 439–464 ms (1 solo >300 ms), contra 295–348 ms del JPEG nativo en rama y base. No se congela. Estimado 2,02 MB = descarga 2 123 054 B a calidad 12 (el último valor), y dos descargas seguidas dan el mismo sha (f45897f4…). |
| G6 nada más cambió | CUMPLE (Chrome) | Los sha256 de rama y base son idénticos para PNG, WebP, JPEG con color, WebP con color, desenfoque PNG/WebP, WA, TG, Amazon y Original (b1d9b77c…, bb8c9995…, c58b0e33…, cd250210…, 900627bb…, 263b42f9…, 8582ea5c…, 5bfbdfd3…, 55bda630…, f199a973…). También son idénticos en Archivo JPG/WebP (4b906dfd…, 7d7fb20e…), en el ZIP de Icon Studio (contenido 8a0be867…) y en el ZIP de Lote (6da31900…). En WebKit, todo lo que no es WebP sale igual a la base. `git diff --stat` no toca batch/iconStudio/backend/cutoutWorker. |
| G7 salir de un sticker no deja el formato cambiado a escondidas | **NO CUMPLE** | D1. |
| G8 guías veraces y motor declarado | CUMPLE | Reproduje los pasos de la guía (quitar-fondo-antes.jpg, Recorte IA, Sticker contorno de 14 px). Chrome: WA 512×512, 20,2 KB, 67,79 % transparente, esquinas 0, lado largo 430 px; TG 199,3 KB. WebKit: WA 19,9 KB. Coinciden con lo publicado. Las versiones declaradas (Chrome 154.0.8037.99, WebKit 26.4, macOS 14.8.8) coinciden con el entorno. Aclara que no se probó en Safari ni en un iPhone reales. «Se descarga una vez y queda guardado»: con el SW activo, la caché `photocut-v2` contiene `encode-*.js`, `webp_enc_simd-*.js/.wasm` y `webpWorker-*.js` tras el primer uso. Observación: la fecha 2026-10-11 es la fecha UTC del commit c4e4b8f (2026-10-10 22:56 −03). |
| Escritorio (Tauri) | ABSTENCIÓN | No lo ejecuté. |

## Defectos

**D1 — Media — G7.** `useExport.js:42-47` devuelve el formato previo pero no el modo de fondo, que el sticker cambió a transparente (`useExport.js:61`). Con transparente + jpeg, la exportación cae en silencio a PNG (`useExport.js:83`).
Reproducción (WebKit y Chrome):
1. Elegir Color + JPEG.
2. Elegir el preset «Sticker WhatsApp». El modo pasa a Transparente y el formato a WEBP.
3. Elegir «Original». El toast dice «Volvió tu formato: JPEG» y el chip JPEG queda marcado pero deshabilitado (`ExportPanel.jsx:151`).
4. Descargar. Baja `photocut-transparent.png` (PNG, sha 983e61b4…) con el toast «Exportado ✓» y ningún aviso de formato.

La app afirma JPEG y entrega PNG: el formato quedó cambiado a escondidas.

**D2 — Media — G3, mensaje falso.** Si una vez falla la carga de `encode-*.js` dentro del worker del editor (corte de red), WebP queda roto toda la sesión: 3 reintentos ya con red no emiten ningún request nuevo y repiten «Reintentá con conexión». El comentario de `webpWasm.js:34` («el reintento vuelve a pedirlo») no se cumple en WebKit con `import()` (`webpWasm.js:28`). Archivo sí se recupera, porque recrea su worker. No se descarga nada engañoso.

**D3 — Baja — G3, aviso poco claro.** En WebKit, una imagen de 16384 px de lado (WebP admite como máximo 16383, `webpWasm.js:42`) da el mismo texto «Reintentá con conexión o elegí PNG» (`useExport.js:146`, i18n.js:438/885/1332). La causa real es el tamaño, y reconectarse no lo arregla.

## Fuera de alcance (ya estaba en la base, igual hash)
- Chrome recorta en silencio a 16383 px de ancho las exportaciones WebP de 16384 px.
- Con 16384 px, el desenfoque WebP en Chrome da los mismos bytes que el export transparente.

## Suposiciones señaladas
- Ninguna en las que se apoye el veredicto. Las esquinas α=183 del desenfoque WebP en Chrome y su opacidad total en WebKit son una diferencia de motor que ya estaba en la base. No la juzgo.

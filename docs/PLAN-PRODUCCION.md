# Plan de implementación — salida a producción

Estado del audit PO/QA del 2026-06-11. Cada ítem tiene criterio de aceptación
(CA). Marcar con `[x]` al completar y anotar fecha.

## P0 — Bloqueantes para lanzar

- [x] **Rendimiento del preview** *(2026-06-11)*
  CA: trazo de pincel < 700 ms en foto de 12MP.
  Hecho: preview a resolución de trabajo, 1 iteración EM al refinar, debounce
  del feather. Medido: 1269 → 443 ms/trazo, feather 802 → 115 ms.

- [x] **Motor en Web Worker** *(2026-06-11)*
  CA: la UI no se congela durante cutRect/stroke; los tests del motor y del
  worker pasan; fallback inline si no hay OffscreenCanvas (Safari < 16.4).
  Hecho: `src/lib/cutoutWorker.js` + RPC en `backend.js`, previews como
  object URLs (Blobs transferidos, sin base64 en mensajes).

- [x] **Tope de tamaño de imagen** *(2026-06-11)*
  CA: al cargar > 24MP la app ofrece "reducir a 4K" o rechaza con mensaje
  claro; nunca crashea el tab.
  Hecho: `src/lib/imageFile.js` (inspección única con `createImageBitmap`) +
  modal "Imagen muy grande" en App con Reducir a 4K / Cancelar; JPEG se
  reduce como JPEG. Test: `test/imagefile-test.html`.

- [x] **HEIC del iPhone (mensaje claro)** *(2026-06-11)*
  CA: al soltar un `.heic` el usuario recibe "Formato HEIC no soportado;
  expórtalo como JPG" en vez de un fallo críptico.
  Hecho: detección por MIME y extensión en `imageFile.js`; también mensaje
  claro para archivos corruptos/no decodificables.
  Ideal (P2): decodificar con `libheif-js` (evaluar +~300KB de bundle).

- [x] **Error boundary de React** *(2026-06-11)*
  CA: un throw en render muestra pantalla de recuperación con botón
  "Reiniciar" (limpia estado), no pantalla blanca.
  Hecho: `src/components/ErrorBoundary.jsx` envolviendo `<App/>`; pantalla
  con detalle técnico plegado (mensaje de privacidad incluido) y gancho para
  Sentry en `componentDidCatch`. Test: `test/errorboundary-test.html`.

- [ ] **Hosting + cabeceras**
  CA: HTTPS, `Content-Security-Policy` sin `unsafe-eval`, assets con
  `Cache-Control: immutable`, despliegue reproducible desde `npm run build`.
  Nota de producto: TODO corre client-side — destacar "tus fotos nunca salen
  de tu navegador" en la UI/landing.

## P1 — Antes de cobrar

- [x] **Responsive / mobile** *(2026-06-11)*
  CA: usable en 390px de ancho; el rail colapsa a barra inferior o drawer;
  pinceles funcionan con dedo (pointer events ya están).
  Hecho: media query ≤760px — rail como bandeja inferior con scroll
  horizontal, safe-area, toasts full-width. Test: `test/mobile-test.html`
  (el runner usa viewport 390×844 para esa suite).

- [x] **Redo** *(2026-06-11)*
  CA: ⇧⌘Z rehace; el stack sobrevive a cambios de feather.
  Hecho: pilas undo/redo en `CutoutSession` (snapshot/restore), comando
  `redo` en worker y backend, botón Rehacer en la UI. Tests en
  engine-test y worker-test.

- [x] **Matriz de navegadores** *(2026-06-11)*
  CA: documentada en README.
  Hecho: tabla "Browser support" en README — Chrome/Edge 111+, Firefox
  113+, Safari 16.4+ (16.2–16.3 con motor inline); evergreen-only.

- [x] **CI (GitHub Actions)** *(2026-06-11)*
  CA: en cada push corre `npm run build` + `npm run test:web` +
  `cargo test -p photocut-core`.
  Hecho: `.github/workflows/ci.yml` (jobs web + rust); el runner usa el
  Chrome preinstalado del runner de GitHub con `--no-sandbox` en CI.
  Pendiente menor: convertir los tiempos de `perf-test` en umbrales que
  fallen.

- [x] **Telemetría de errores** *(2026-06-11)*
  CA: errores JS de producción llegan a Sentry; sin PII, sin imágenes.
  Hecho: `src/lib/telemetry.js` sin SDK (0 KB extra) — opt-in vía
  `VITE_SENTRY_DSN` en el build; hooks `error`/`unhandledrejection` +
  ErrorBoundary; cap de 10 eventos/sesión. Pendiente menor: subir
  sourcemaps al activar el DSN real.

- [x] **Licencias de terceros** *(2026-06-11)*
  CA: pantalla "Acerca de / Licencias".
  Hecho: `npm run licenses` (scripts/gen-licenses.mjs) genera
  `src/generated/licenses.json` (deps npm + crates Rust); modal ⓘ en la
  topbar con versión y promesa de privacidad. Verificar en release con
  `cargo about` para el árbol transitivo de Rust.

## P2 — Pulido

- [x] **i18n ES/EN/PT** *(2026-06-11)* — `src/lib/i18n.js` sin dependencias:
  diccionario completo en tres idiomas, detección por `navigator.language`
  con fallback EN, selector en la topbar, persistencia en localStorage,
  cambio en vivo y `html[lang]` sincronizado. Test: `test/i18n-test.html`
  (agnóstico al locale de la máquina).
- [x] **PWA instalable** *(2026-06-11)* — `site.webmanifest` + iconos propios
  (`npm run brand-assets`, generados con el propio motivo de marca) +
  `public/sw.js` (precache del HTML y sus assets en install, runtime
  stale-while-revalidate, `ignoreVary` por el header Vary: Origin).
  Verificado: la app monta completa offline tras la primera visita.
- [x] **Onboarding** *(2026-06-11)* — overlay de 3 pasos en la primera visita
  (localStorage `pc-onboarded`), con promesa de privacidad. Testeado.
- [x] **SEO/OG** *(2026-06-11)* — metas description/OG/Twitter + `og.png`
  1200×630 generado con la identidad darkroom. Pendiente: og:url/canonical
  cuando exista dominio (ítem hosting).
- [x] **Accesibilidad** *(2026-06-11)* — `aria-live` en "procesando", contraste
  AA de `--ink-faint` (#7e8676), modal `?` de atajos, Esc cierra paneles,
  roles/aria en modales. Pendiente conocido: el lienzo no es operable por
  teclado (limitación de la interacción de pincel).
- [ ] **Decodificador HEIC real** — ver P0 HEIC.
- [ ] **WASM del motor Rust** — compilar `photocut-core` a WebAssembly para
  paridad web/desktop (el README ya lo contempla); el worker actual es el
  punto de integración natural.

## Riesgos de producto (decisiones, no código)

- **Posicionamiento vs. IA** (remove.bg): motor clásico pierde en pelo/bordes
  difusos. Vender privacidad ("nunca sube tu foto") + Icon Studio.
- **Freemium**: definir qué se recorta en web gratis vs. desktop pago
  (¿resolución de export? ¿batch? ¿formatos?).
- **Naming/marca**: registrar dominio e identidad antes de la landing.

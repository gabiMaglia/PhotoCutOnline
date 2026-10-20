# Handoff Log — photocut

> Entradas nuevas ARRIBA. Máx. 6 líneas por entrada. Al superar 30 entradas,
> el Orquestador mueve las más viejas a ~/.nerv/archive/[alias]-handoffs-[fecha].md

### [2026-10-06 18:06] CIERRE DE SESIÓN
- Hecho hoy: auditoría 3 ejes (engram/10) → Fase A (GROW-25..29 + 25b) y Fase B (GROW-30/31/32) Done con QA Strong, todo mergeado, pusheado y verificado en vivo; D-06/D-07 cerradas; CI corre `npm test`; carrera de `ensure-dist` arreglada (0a181a1, CI verde; el run rojo de b58d222 fue esa carrera); IndexNow 125 URLs.
- Próximo paso: Fase C del PO (launch kit, datos de autor GROW-33, decidir BUG-01/06); reaplicar AdSense por números (≥1.000 visitantes/mes).
- Quien retoma: nerv-orquestador (con datos del PO: nerv-web para GROW-33 / BUG-01).


### 2026-07-07 Orquestador→nerv-web (T-011 RE-ESCOPADO: split MPA, Strong)
- PO decidió separar en 2 páginas (el single-page tenía scroll feo + rail cortado D-03). Recon: index.html tiene #root+main.jsx+#landing juntos; vite sin rollupOptions.input.
- Leer SOLO: index.html, src/main.jsx, vite.config.js, vercel.json.
- Entrega: / landing estática + /editor app React (Vite MPA). Detalle en 03_backlog T-011. Rama feature/T-011-landing. Return handoff P-1.

### 2026-07-07 Orquestador→nerv-web (T-011 Landing, Advisory)
- Tarea: expandir el <footer id="seo-info"> (index.html:110) en una LANDING diseñada debajo del editor (editor sigue 100vh front). Posicionamiento e-commerce.
- Usar skill frontend-design. Estático en index.html (crawlable=SEO/AdSense). On-brand (dark + acid #d6f64b). Responsive. NO inventar testimonios (usar trust signals reales).
- Rama feature/T-011-landing. Return handoff P-1.

### 2026-07-03 Orquestador→nerv-web (T-010 Batch, Strong)
- Tarea: nuevo tab "Lote" — procesar N imágenes con Recorte IA 100% local → ZIP.
- Recon verificado: backend.js expone loadImage(dataUrl)/aiCut()/exportTransparent(opts); src/lib/zip.js makeZip(files)→Blob (lo usa Icon Studio); tabs en App.jsx (cut|icons|stickers) + Topbar.jsx. Worker = 1 sesión → SECUENCIAL.
- Foco reliability: memoria con muchas/grandes imágenes (lección Sprint 1: heap WASM/canvas). Return handoff P-1. Rama feature/T-010-batch.

### 2026-07-03 17:09 CIERRE DE SESIÓN
- Hecho hoy: Sprint 2 completo y LIVE — dominio www.photocutapp.com; SEO Packs A (aprobación: home crawleable+About/Contacto), B (JSON-LD/OG/cross-linking), C (9 guías); AdSense (código+ads.txt+CMP 3-op, en revisión); Search Console verificado + sitemap "Correcto". Fix clave: sitemap se genera desde VITE_SITE_URL (Vercel) + SEO_ROUTES; corregido dominio viejo + rutas faltantes.
- Próximo paso: esperar veredicto AdSense + indexación; evaluar Sprint 3.
- Quien retoma: nerv-orquestador. Creado runbook reusable ~/.nerv/recipes/web-monetizacion-adsense-seo.md.

### 2026-07-03 Orquestador→nerv-web (T-009 Pack C, Advisory)
- Tarea: contenido. Expandir las 5 guías a 900-1200w + FAQ(+FAQPage schema); draftear 3-4 guías nuevas (quitar fondo gratis, PNG a ICO, sticker WhatsApp, foto carnet fondo blanco).
- Nuevas guías: MISMA plantilla (head con AdSense ca-pub-3865058604661161 + canonical + OG + JSON-LD Article/HowTo/FAQPage), CTA a la app, cross-linking; sumar a guias/index.html + sitemap (lastmod).
- COMMITEAR guía por guía (no al final). Rama feature/T-009-content. Return handoff P-1.

### 2026-06-29 01:40 Orquestador→nerv-web (T-008 Pack B, Strong)
- Tarea: rich snippets & viral. JSON-LD (HowTo/Article guías + SoftwareApplication home) + canonical/OG por guía + cross-linking "guías relacionadas" + lastmod sitemap.
- Leer SOLO: las 5 guías en public/guias/*.html (NO index.html de guias salvo para el listado), index.html, public/sitemap.xml.
- Rama feature/T-005-seo-domain. FAQPage se difiere a Pack C (necesita las secciones FAQ). Return handoff P-1.

### 2026-06-29 01:15 Orquestador→nerv-web (T-007 Pack A, Advisory)
- Tarea: preparar el sitio para aprobación AdSense. Recon del Orquestador (verificado): home = SPA con ~10 palabras crawleables; NO hay About/Contact; guías solo linkeadas desde AboutModal.jsx:52 (enterrado).
- Leer SOLO: index.html, public/guias/como-quitar-el-fondo-de-una-imagen.html (plantilla), src/components/layout/Topbar.jsx, public/sitemap.xml, public/legal/terminos.html (estilo).
- Entrega: home crawleable + acerca.html + contacto.html + link Guías visible + sitemap. Rama feature/T-005-seo-domain. Return handoff P-1.

### 2026-06-29 00:00 CIERRE DE SESIÓN
- Hecho hoy: Sprint 1 completo — T-002 (perf ONNX/pincel, QA Adversarial + verifier ciego que atrapó un use-after-free), T-003 (comparador), T-004 (Icon Studio "Ajustar al sujeto"); bump 0.1.4; mergeado a main (4bf2b31) y Release v0.1.4 publicada.
- Hallazgo: el jank de pincel era render por software del navegador (sin GPU), no el código — reproducido con Playwright (idle CPU, 1250fps con GPU); en Safari fluido.
- Próximo paso: definir Sprint 2 o validar v0.1.4 en prod. Pendiente PO: Figma (§6).
- Quien retoma: nerv-orquestador.

### 2026-06-27 Orquestador→nerv-web (T-001, Strong, diagnóstico)
- Tarea: auditar performance/memory leaks; foco PO = app pesada tras IA + frame drops con pinceles.
- Leer SOLO: aiSegmenter.js, CanvasEditor.jsx, useCutout.js, hooks/useCutoutSession.js, cutoutWorker.js, jsEngine.js, backend.js.
- Entrega: informe rankeado con citas file:line (cite-or-abstain). NO tocar código en esta fase.
- Rama: feature/T-001-perf-audit. Return handoff P-1 (4 campos).

### 2026-06-27 PO→Orquestador (alta P-6)
- Entrega: proyecto dado de alta en NERV; repo movido de Downloads a /Users/gabrielsk/Documents/Proyects/photocut; engram creado; fila agregada al registry.
- Se espera: definir Sprint 1 (objetivo + tickets).
- Pendientes: confirmar Figma (01_requirements.md §6).

## 2026-10-06 — Sprint 6 Fase A (orquestador)
- Auditoría 3 ejes (nerv-qa adversarial, seo-technical, seo-content) → engram/10. PO aprobó Fase A.
- GROW-25+26 → nerv-web (worktree) → nerv-qa Strong APROBADO → merge 3b3a7c6.
- GROW-27 → nerv-web → nerv-qa RECHAZADO (pie EN/PT del editor desalineado con GROW-26) → fix → re-QA APROBADO → merge 450f3a1.
- GROW-29 → nerv-web → nerv-qa APROBADO → merge 5fd55ee.
- GROW-28 → nerv-web → nerv-qa RECHAZADO (guías decían que Recuadro segmentaba) → fix → re-QA APROBADO → merge 9e89cf2.
- Sin push: decisión PO sobre foto del hero.

### 2026-10-20 Orquestador→nerv-web (BUG-12, Advisory)
- Tarea: editor mobile sin foto — opción PO «sin foto: solo el CTA». Criterios Gherkin en 03_backlog.md (bloque BUG-12).
- Leer SOLO: engram/03_backlog.md (fila + bloque BUG-12), src/styles.css (@media max-width 760px, .rail/.canvas-wrap/.canvas-empty/.topbar*), src/features/cutout/CutoutPage.jsx, componentes del estado vacío y de la topbar (src/components/layout/), src/lib/i18n.js.
- Rama fix/BUG-12-mobile-empty (worktree). Return handoff P-1 (4 campos) con capturas 390×844 antes/después.

### 2026-10-20 Orquestador→nerv-web (BUG-13, Strong)
- Tarea: Recorte IA no debe usar BiRefNet en móviles + marca persistente anti-bucle. Causa confirmada por el PO (iPhone 13, flag WebGPU off ⇒ funciona). Criterios en 03_backlog.md (bloque BUG-13). CÓMO en engram/plans/BUG-13.md ANTES del código.
- Leer SOLO: engram/03_backlog.md (fila + bloque BUG-13), engram/plans/GROW-36.md, src/lib/aiSegmenter.js, src/lib/cutoutWorker.js, src/lib/backend.js, sus tests, src/lib/i18n.js (claves de onboarding con ~120 MB).
- Rama fix/BUG-13-mobile-ai (worktree). En paralelo corre BUG-12 (styles/CutoutPage/i18n): posible conflicto menor en i18n.js. Return handoff P-1.

### 2026-10-20 Orquestador→nerv-qa (BUG-12, Advisory)
- Revisar rama fix/BUG-12-mobile-empty (38e86a5) contra el bloque Gherkin BUG-12. Return de nerv-web: CTA reutiliza openPhoto (sin i18n nuevo), .canvas-empty-hint oculto en móvil (fuera de pedido), mobile-test.jsx ajustado (carga foto antes de medir), sin diff automático en escritorio.

### 2026-10-20 Orquestador→nerv-qa (BUG-13, Strong)
- Revisar rama fix/BUG-13-mobile-ai (96fdcee, base df54085, 14 archivos +523) contra el bloque Gherkin BUG-13 y engram/plans/BUG-13.md. Return nerv-web: deviceClass.js + aiAttemptMark.js (IndexedDB, timeout 2 s), veredicto móvil calculado en hilo principal y pasado al worker; webp-retry-test [webkit] falló en su corrida (no comparado contra main); riesgos: marca huérfana sin TTL, dos pestañas, UA de escritorio en Android.

### 2026-10-20 PO→Orquestador→nerv-web (BUG-12 ajuste)
- PO vio las capturas: «no hay espacio en el header, emprolijalo». Escenario Gherkin nuevo «header prolijo» en el bloque BUG-12. Mismo agente, misma rama; la revisión QA en curso queda desactualizada → re-QA.

### 2026-10-20 nerv-web→Orquestador (BUG-12 return, registrado por el orquestador)
- status: En revisión QA. Rama fix/BUG-12-mobile-empty: 38e86a5 (estado vacío) + fb13ad5 (header prolijo).
- files touched: src/styles.css (solo @media ≤760px), src/features/cutout/CanvasEditor.jsx, src/features/cutout/CutoutPage.jsx, test/mobile-empty-test.{html,jsx} (nuevos), test/mobile-test.jsx, test/run-tests.mjs (+ engram/03_backlog.md traído de main: a revertir en la rama).
- risks: ad slot cut-rail desaparece sin foto en móvil; .canvas-empty-hint oculto en ≤760px también con mouse; toast "cargados" tapa los últimos controles (preexistente); Editar/Icon Studio/Color Studio sin foto siguen mostrando la bandeja desactivada (fuera de alcance → deuda).
- how to test: mobile-empty-test + mobile-test en Chromium/WebKit 390×844. Capturas: scratchpad/antes-m390-*.png, despues-m390-*.png, despues2-m390-*.png, *-d1280-*.png. Otras pestañas: QA verificó a 390 px sin overflow (qa/BUG-12.md).

### 2026-10-20 nerv-web→Orquestador (BUG-13 return, registrado por el orquestador)
- status: En revisión QA. Rama fix/BUG-13-mobile-ai: c785f69 (plan CÓMO) → 028e44b (tests rojos) → 96fdcee (fix).
- files touched: src/lib/deviceClass.js, src/lib/aiAttemptMark.js (nuevos), aiSegmenter.js, cutoutWorker.js, backend.js, i18n.js; tests deviceClass/aiAttemptMark (nuevos), aiSegmenter/backend.ai-notice/i18n/aiIdleRelease (ampliados); test/run-tests.mjs (paso UA iPhone, TEST_PORT); engram/plans/BUG-13.md.
- risks: marca sin TTL (→ PO: 7 días); dos pestañas; Android «sitio de escritorio» no detectado (→ PO: cubrirlo); jetsam real no reproducible en CI.
- how to test: npx jest src/lib; TEST_PORT=<libre> npm run test:web (bloque «ai-test con UA de iPhone»); manual iPhone 13 con WebGPU activado: sin /models/birefnet-* en Red.

### 2026-10-20 PO→Orquestador (decisiones tras QA intento 1 de BUG-12 y BUG-13)
- BUG-13: sellar el CÓMO ahora y anotar el desvío (sello post-código; plan commiteado antes, c785f69) · marca con TTL 7 días · cubrir Android «sitio de escritorio». BUG-12: igualar forma idioma/☕/ⓘ. Orquestador: la pista arrastrar/pegar solo se oculta con pointer: coarse (GAP de QA).
- Lección de proceso: el orquestador no registró los return handoff en este log → gate HANDOFF_INCOMPLETE en BUG-12. Desde ahora se registran al recibirlos.

### 2026-10-20 nerv-web→Orquestador (BUG-12 return ronda 3, registrado por el orquestador)
- status: En revisión QA. Rama fix/BUG-12-mobile-empty @ d7ee4d9 (sobre fb13ad5). engram/ fuera del diff de la rama.
- files touched: src/styles.css (.lang-select círculo 44×44 en móvil; .canvas-empty-hint oculto solo con pointer: coarse), test/mobile-empty-test.jsx (2 aserciones nuevas). Acumulado: styles.css, CanvasEditor.jsx, CutoutPage.jsx, test/mobile-empty-test.{html,jsx}, test/mobile-test.jsx, test/run-tests.mjs.
- risks: pointer: coarse no probado en navegador (solo fine); prueba de rojo de la pista no aislada (la corta la aserción de forma); npm test y test:web completos no re-corridos; ad slot cut-rail; otras pestañas con bandeja desactivada (→ deuda).
- how to test: mobile-empty-test y mobile-test en Chromium/WebKit 390×844; capturas scratchpad/despues3-m390-{sinfoto,confoto}.png.

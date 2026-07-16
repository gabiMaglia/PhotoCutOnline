# Handoff Log — photocut

> Entradas nuevas ARRIBA. Máx. 6 líneas por entrada. Al superar 30 entradas,
> el Orquestador mueve las más viejas a ~/.nerv/archive/[alias]-handoffs-[fecha].md

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

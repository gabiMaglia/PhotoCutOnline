# Backlog — photocut

> Estados: Backlog → To Do → En progreso → En revisión QA → Done | Bloqueado
> Solo nerv-qa escribe "Done". Mapear SIEMPRE el ID externo si existe.
> Niv (P-11, nivel de revisión QA): A=Advisory (default) · S=Strong · X=Adversarial.

## Sprint 3 — Batch + Landing e-commerce + Desktop pago
| ID | Ext | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|-----|-------|----------|--------|-----|--------------------------|------|
| T-013 | — | Optimizar "Recorte automático": GrabCut downscaleado a SEG_MAX=768 + reescala máscara. | Orquestador (rehecho: el agente lo perdió por reset) | Done (4.7s→1.85s, calidad OK, 85/85 tests; commit 386bb0e) | S | (1) autoCut corre GrabCut a resolución reducida (≤~768px máx) + escala la máscara a resolución de trabajo; (2) medir antes/después (target ~3-4× más rápido, <1.5s en 1.4MP); (3) sin regresión notable de calidad del estimado (se refina con pinceles); (4) build+tests verdes | feature/T-011-landing |
> Origen: análisis competitivo de photocut.ai (SaaS server-side de pago con ads). Estrategia: doblar el wedge (gratis + privado + client-side) con batch e-commerce + posicionamiento comercial (keywords alto CPM), y capturar el mercado que pagan con un desktop de pago (sin romper la web gratis).
| ID | Ext | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|-----|-------|----------|--------|-----|--------------------------|------|
| T-010 | — | Batch: procesar N imágenes con Recorte IA 100% local → ZIP de PNG transparentes | nerv-web | Done y MERGEADO (4d5ea8c). PO aprobó (anda bien); auto-downscale >24MP silencioso queda as-is. Botón "Descargar app" ocultado de paso. | S | (1) tab/página "Lote" con drop múltiple; (2) por cada imagen loadImage→aiCut→exportTransparent SECUENCIAL (worker=1 sesión); (3) progreso por imagen + total; (4) descarga ZIP (makeZip, src/lib/zip.js); (5) memoria: liberar entre imágenes, sin OOM con fotos grandes (lección Sprint 1); (6) build verde | feature/T-010-batch |
| T-011 | — | RE-ESCOPADO (PO): SEPARAR en 2 páginas — / = landing estática, /editor = app React (Vite MPA). + polish UI (logo link, botones, chips), fix contraste, borde blanco. | nerv-web | Done y COMMITEADO (16da844 landing/MPA + 0db8c19 UI + 06fd11a contraste). Verificado runtime. Falta nod PO + merge a main | S | (1) index.html = solo landing (sin #root/main.jsx, sin override html,body scroll); (2) editor/index.html = la app (#root+main.jsx, meta propia, canonical/noindex); (3) vite.config rollupOptions.input {main,editor}; (4) CTA landing → /editor (+ ideal: dropzone hero); (5) Vercel sirve /editor; (6) sitemap/canonical OK (SEO_ROUTES); (7) editor overflow:hidden (rail sin cortarse). Build+ambas rutas verdes | feature/T-011-landing | Decidido: vive debajo del editor (tool instant). Pendiente: copy + diseño | main |
| T-012 | — | SPIKE desktop de pago: definir qué se cobra (offline/batch/sin ads), precio, proveedor (Lemon Squeezy vs Paddle), mecanismo de licencia. NO implementar aún | — | Backlog (spike de decisiones con PO) | — | Entregable: doc de decisión + plan, no código. Ver runbook monetización | — |

## Sprint 2 — Dominio & monetización (AdSense) — CERRADO 2026-07-03
> Todo LIVE en www.photocutapp.com: dominio, SEO (A+B+C), AdSense (código+ads.txt+CMP) en revisión, Search Console verificado + sitemap "Correcto". Runbook reusable: ~/.nerv/recipes/web-monetizacion-adsense-seo.md
> Dominio elegido: **photocutapp.com** (Namecheap, comprado 2026-06-29). Estrategia: mantener marca PhotoCut; monetizar tráfico con AdSense (única red viable con poco tráfico). Detalle: docs/MONETIZACION.md + INSTRUCCIONES-MONETIZACION.md.
| ID | Ext | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|-----|-------|----------|--------|-----|--------------------------|------|
| T-005 | — | Cablear dominio photocutapp.com: sitemap.xml + canonical/og:url + robots Sitemap + og:image absoluto | Orquestador | En revisión (build ok) | A | (1) public/sitemap.xml con 9 URLs (raíz+guías+legales); (2) index.html canonical + og:url a https://photocutapp.com/; (3) robots.txt con línea Sitemap; (4) build verde y assets en dist/ | feature/T-005-seo-domain |
| T-006 | — | AdSense: verificación (script en head 11 páginas + ads.txt) DONE y LIVE (commit a6e2d97). Pub-id: ca-pub-3865058604661161. Falta post-aprobación: crear ad unit → VITE_ADSENSE_SLOT + switch del AdSlot house→adsense | Orquestador | Parcial (verificación live; ads reales esperan aprobación) | S | Sin CSP en vercel.json → no requiere allowlist. Auto Ads habilitado por el script en head | main |
| GESTIÓN | — | PO: apuntar DNS Namecheap → Vercel + agregar dominio en Vercel; crear cuenta AdSense; Search Console + sitemap; analytics (Plausible/Umami) | PO | En curso | — | No-código. Bloquea T-006 y la medición de tráfico | — |
| T-007 | — | Pack A (aprobación AdSense): home crawleable (contenido estático + links) + páginas Acerca de/Contacto + link "Guías" visible en topbar/footer + sumar al sitemap | nerv-web | Done (gate+build+visual Playwright; commit 58f214c) | A | (1) index.html con contenido estático crawleable (texto real + links a guías/legales/about/contacto, NO solo #root vacío); (2) public/acerca.html + public/contacto.html (plantilla de las guías, contenido real, email gab.maglia@gmail.com); (3) link "Guías" visible en Topbar.jsx; (4) sitemap incluye acerca/contacto; (5) build verde | feature/T-005-seo-domain |
| T-008 | — | Pack B (rich snippets & viral): JSON-LD HowTo+FAQPage en guías + SoftwareApplication en home + canonical/OG por guía + cross-linking "guías relacionadas" + lastmod en sitemap | nerv-web | Done (gate+build+10 JSON-LD válidos; commit c71c8f9; MERGEADO a main 810a5bc). FAQPage difierido a Pack C. | S | (1) JSON-LD válido (HowTo+FAQPage guías, SoftwareApplication home); (2) canonical+og por guía; (3) bloque "guías relacionadas" en cada guía; (4) lastmod en sitemap; (5) validar con Rich Results test mental (schema bien formado) | feature/T-005-seo-domain |
| T-009 | — | Pack C (contenido): expandir las 5 guías a 900-1200w + FAQ; draftear 3-4 guías nuevas (quitar fondo gratis, PNG a ICO, sticker WhatsApp, foto carnet) | nerv-web | Done y LIVE (9 guías 863-1170w, JSON-LD Article/HowTo/FAQPage válidos, MERGEADO fd4904d). Listado+guías en prod OK | A | (1) 5 guías ≥900w con sección FAQ; (2) 3-4 guías nuevas con misma plantilla + CTA a la app; (3) agregadas a guias/index.html + sitemap. PO ajusta redacción después | feature/T-005-seo-domain |

## Sprint 1 — Performance & memory leaks
> CERRADO 2026-06-29: T-001..T-004 mergeados a main (4bf2b31) y publicados como Release v0.1.4 (tag + CI desktop).
| ID | Ext | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|-----|-------|----------|--------|-----|--------------------------|------|
| T-003 | — | FIX comparador antes/después mostraba lo mismo de ambos lados | Orquestador | Done (Advisory + verif. visual Playwright) | A | Base recortada a la izquierda (clipLeft) en modo comparar — CanvasEditor.jsx:501-525; izq="antes", der="después" sobre checker. 81/81 tests. commit 17aab26 | feature/T-001-perf-audit |
| T-004 | — | FEAT Icon Studio: encaje "Ajustar al sujeto" (auto-trim del margen transparente + fit) | Orquestador | Done (Advisory + verif. visual Playwright) | A | Nueva opción fit="subject": trimToContent memoizado por source (1 vez, no por tamaño) + contain. renderSource separado del source real. i18n es/en/pt. useIconStudio.js + IconStudioPage.jsx + i18n.js. 81/81 tests. commit fe1d8d6 | feature/T-001-perf-audit |

| ID | Ext (ADO/Jira) | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|----------------|-------|----------|--------|-----|--------------------------|------|
| T-001 | — | Auditoría de performance y memory leaks (diagnóstico read-only) | Orquestador (spawn nerv-web caído por outage del clasificador) | Done | S | HECHO: informe rankeado con citas file:line. Hallazgos A1-A3 (pesada post-IA), B1-B2 (frame drops pinceles), C1-C3 (otros). NOTA: el jank real era render por software del navegador (sin GPU), no el código — ver retro | feature/T-001-perf-audit |
| T-002a | — | FIX pesada post-IA: liberar InferenceSession ONNX (release en idle) + dispose de tensores por inferencia | nerv-web | Done | X | (1) releaseAi() con guard inFlight/pendingRelease (sin race); (2) tensores disposed en finally; (3) heap vuelve a baseline tras idle 30s; (4) sin regresión. Aprobado intento 2 | feature/T-001-perf-audit |
| T-002b | — | FIX frame drops pinceles: preview por ImageBitmap transferible (decode off-main-thread) en vez de PNG blob + new Image() | nerv-web | Done | X | preview por ImageBitmap (worker+inline); CanvasEditor sin new Image(); ownership documentado. Aprobado | feature/T-001-perf-audit |
| T-002c | — | OPCIONAL: cap/compresión de historial undo + reuso de canvases en aiMatte | nerv-web | Done | X | undo cap 15→10; reuso de canvases en aiMatte. Aprobado (ver D-02 deuda: reuso no es seguro ante aiMatte concurrente) | feature/T-001-perf-audit |

### Hallazgos T-001 (cite-or-abstain, P-12)
**A · Pesada tras IA**
- A1 [CRÍTICO] InferenceSession ONNX = singleton de módulo que NUNCA se libera — aiSegmenter.js:20-44. Tras el 1er aiCut, runtime WASM de ORT + modelo u2netp quedan residentes en el worker toda la sesión (decenas-cientos de MB) → presión de memoria permanente → GC más lento → jank en TODO, incl. pinceles. ESTA es la causa raíz transversal.
- A2 [ALTO] Tensores input/output sin dispose por inferencia — aiSegmenter.js:90-93. Acumulan en heap WASM hasta GC. Fix: dispose en finally (S).
- A3 [MEDIO] aiMatte crea 4-5 canvases full-res + varias copias getImageData por llamada — aiSegmenter.js:70-121. GC churn por cada IA (M).
**B · Frame drops pinceles**
- B1 [ALTO] Cada trazo codifica PNG a resolución de trabajo (worker) y lo DECODIFICA en hilo principal con new Image() — previewBlob jsEngine.js:452-473 → CanvasEditor.jsx:114-130. Bajo la presión de A1 esto jankea. Fix: preview como ImageBitmap transferible / createImageBitmap (M).
- B2 [MEDIO] Round-trip busy serializa cada trazo (no es leak) — useCutoutSession.js:111-125 (M, baja prioridad).
- NOTA: el move del pincel está BIEN optimizado (cursor imperativo, sin re-render) — CanvasEditor.jsx:40-44,303-314.
**C · Otros**
- C1 [MEDIO] undoStack: 15 snapshots de trimap+label+softAlpha a resolución de trabajo (~3 B/px ×15 → hasta ~55MB en fotos grandes) — jsEngine.js:105-126. Bounded pero suma a la presión post-IA.
- C2 [BAJO] removeBg (Icon Studio) comparte el mismo singleton ORT → le aplica A1 — cutoutWorker.js:55-59.
- C3 [INFO] El worker nunca se termina — backend.js:30-48 (intencional; refuerza A1).

## Sprint 0 — alta del proyecto (sin tickets de trabajo)
| ID | Ext (ADO/Jira) | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|----------------|-------|----------|--------|-----|--------------------------|------|
| — | — | (sin tickets; pendiente definir Sprint 1) | — | — | — | — | — |

## SEO — pendientes trackeados (post audit Sprint 2 + split MPA)
> Ya HECHO (no re-hacer): home crawleable, About/Contacto, 9 guías con JSON-LD Article/HowTo/FAQPage, canonical/OG, sitemap (generado por vite.config desde VITE_SITE_URL+SEO_ROUTES), robots, Search Console verificado. Runbook: ~/.nerv/recipes/web-monetizacion-adsense-seo.md
| ID | Tarea | Prioridad | Notas (verificado) |
|----|-------|-----------|--------------------|
| SEO-1 | Article schema en las 9 guías SIN datePublished/dateModified → agregar (señal de frescura) | Media | grep: 0/9 guías con fecha |
| SEO-2 | BreadcrumbList JSON-LD en guías (rich result de migas) | Media | grep: 0 guías con breadcrumb |
| SEO-3 | WebSite + Organization schema en la landing (/) (entidad de marca; sitelinks) | Media | grep: 0 en index.html |
| SEO-4 | Página 404 custom (public/404.html) con links de vuelta (UX + no perder crawl) | Media | no existe |
| SEO-5 | Fuentes Google render-blocking en index.html y editor/index.html → self-host o preload + font-display:swap (Core Web Vitals) | Media | 1 <link> css bloqueante c/u |
| SEO-6 | og.png pesa 164K → optimizar; evaluar OG por-guía | Baja | 1 og.png compartido |
| SEO-7 | Verificar post-split: Google indexa `/` como home, respeta noindex en `/editor`, re-enviar sitemap y monitorear cobertura en Search Console | Alta | cambió la estructura (MPA) |
| SEO-8 | Analytics real para medir pageviews (las redes de ads lo piden): decidir cookieless (Plausible/Umami) vs GA (analytics.js hoy usa gtag/GTM → cookies + consentimiento) | Alta | gestión + código |
| SEO-9 | Más guías de alta intención (cadencia de contenido) — ver runbook | Continuo | — |
| SEO-10 | CTA a `/editor` desde guías (link flow + conversión) | Baja | — |

## Monetización — pendientes trackeados
> Ya HECHO: AdSense código en 11 páginas + ads.txt (pub ca-pub-3865058604661161) + CMP de consentimiento (Google 3-opciones); Ko-fi cableado; AdSlot house-ad por defecto. AdSense EN REVISIÓN.
| ID | Tarea | Prioridad | Notas |
|----|-------|-----------|-------|
| MON-1 | AdSense: al APROBAR → crear ad unit → setear VITE_ADSENSE_CLIENT/SLOT → el AdSlot pasa de house-ad a AdSense real | Alta (bloq. por aprobación) | esperar veredicto, no re-aplicar |
| MON-2 | Colocación de anuncios en las GUÍAS (donde está el tráfico de búsqueda/alto CPM): verificar que Auto Ads renderice + evaluar bloques in-content | Alta | guías ya tienen el script en head |
| MON-3 | Posicionamiento comercial/e-commerce para subir el CPM (keywords "fotos de producto"): ya arrancado con la landing (T-011) + guía de producto; expandir | Media | — |
| MON-4 | EthicalAds / Carbon: aplicar al llegar a ~50k pageviews/mes (privacy-first, refuerza la marca) | Media (futuro) | gestión |
| MON-5 | Ko-fi: confirmar pagos conectados (PayPal/Stripe) para que las donaciones acrediten | Media | gestión, 5 min |
| MON-6 | Desktop de pago (offline/batch/sin ads) — ver T-012 (spike de decisiones: qué se cobra, precio, Lemon Squeezy vs Paddle) | Media | ya trackeado T-012 |
| MON-7 | Unificar los DOS banners de consentimiento (el propio de analytics `consent.js` + la CMP de Google de ads) para no mostrar dos avisos en EEE/UK | Baja | UX |
| MON-8 | Medir eCPM real por red/página con 1-2 meses de datos y optimizar (posible híbrido AdSense en guías + EthicalAds en app) | Baja (futuro) | depende de SEO-8 |

## Roadmap competitivo — análisis photocut.ai (2026-07-14)
> **Competidor photocut.ai:** 4.289 URLs indexables, 11 idiomas (hreflang), suite tipo Canva (quita-fondos, cambia-fondos, AI product photography, quitar objetos/personas por inpainting, añadir texto, plantillas, editor de diseño Y video, apps móviles). Modelo: freemium con **registro obligatorio**, marca de agua/límites en free, Pro ~₹266/mes (~US$3), trial 7 días, **procesamiento en servidor (sube tus fotos)**. Motor SEO = cientos de landing programáticas `/free-tools/` y `/es/herramientas-gratuitas/`, 1 página por keyword × 11 idiomas (H1=keyword + herramienta embebida + how-to 3 pasos + FAQ + schema + interlink denso).
> **Nuestra cuña (lo que ellos NO tienen):** GRATIS · SIN REGISTRO · 100% en el navegador (no sube fotos) · sin marca de agua · sin límites.
> **GUARDARRAÍL:** NO copiar su modelo de páginas finas — a nosotros AdSense nos rechazó por "contenido de poco valor". Camino del medio: menos páginas, cada una útil de verdad, con la cuña de privacidad como contenido real. Páginas indexables las genera vite.config (SEO_ROUTES); editor sigue noindex y las landing embudan a él.

| ID | Fase | Tarea | Prioridad | Notas |
|----|------|-------|-----------|-------|
| GROW-0 | F0 Contenido | Llegar a ~20 guías + capturas reales (rehabilita AdSense) | Alta | ✅ 20/20 guías (commits d136462 +6, 57a371a +5). Sitemap 9→26 URLs. Falta: capturas reales + re-aplicar a AdSense |
| GROW-1 | F1 Tool-landings | Hub `/herramientas/` (espejo de su `/free-tools/`) + interlinking denso | Alta | ✅ commit 7a1e4c9. Hub + interlinks desde landing y /guias/. SEO_ROUTES 28 |
| GROW-11 | F2 Features | ✅ **Herramienta de Colores**: extractor de paleta (median-cut) + cuentagotas/HEX picker, copiar HEX/CSS/JSON. Pestaña "colors" + deep-link ?tab=colors + landing /herramientas/paleta-de-colores.html | Alta | ✅ commit e07f2fa (app) + 7a1e4c9 (landing). PO pidió lado análisis |
| GROW-12 | F2 Análisis | ✅ (a) contraste WCAG (adcfb18) · ✅ (b) visor metadata/EXIF (10bbb32). Pendientes: (c) color promedio + %, (d) daltonismo, (e) histograma | Media | (a)(b) hechas |
| GROW-13 | F2 Color Studio | ✅ Pestaña Colores→**Color Studio** (05c4a5b): +modo **Tema** (dark/light desde captura) +modo **Recolorear** (CSS/Tailwind → gradient map). lib/recolor.js (15 tests). Guía generar-modo-oscuro. id tab sigue "colors". **Font-ID descartado (inviable client-side)** | — | PO 2026-07-15 |
| GROW-14 | F2 Color Studio | ✅ (c5906d5) Paletas bajo cada preview (antes/después) + layout adaptativo (ancha→columna, alta→row) + **generador de color scheme**: escalas 50–900 por rol (primary/secondary/accent/neutral) + semánticos (success/warning/error/info) copiable como CSS vars o Tailwind config. lib/scheme.js (9 tests) + hslToRgb en palette. **NOTA layout: implementé espacio-óptimo (opuesto a la palabra literal del PO); ofrecido invertir** | — | PO 2026-07-15 |
| GROW-15 | F2 pendientes | ✅ Análisis: histograma + daltonismo (d39c9c0). ✅ **Añadir texto** (7a262b0, tab "text" + landing) + fuente propia. ⬜ Falta: **blur fondo** (reusar segmentación), **sombra** | Media | texto hecho 2026-07-15 |
| GROW-16 | Futuro | **Store de stickers** dentro de la herramienta de texto/edición: catálogo de stickers para pegar sobre la foto (¿gratis + premium?). Idea del PO 2026-07-15, para más adelante. Pensar: fuente de assets, licencias, si se monetiza | Baja (futuro) | trackear, no implementar aún |
| GROW-2 | F1 Tool-landings | Landing indexable por herramienta: `/herramientas/quitar-fondo`, `/cambiar-fondo` — H1=keyword, how-to, FAQ, schema, CTA al editor | Alta | ✅ commit (F1 cierre). WebApplication+HowTo+FAQPage, transaccional vs guía educativa (cross-link). Falta futuro: mini-uploader que abra editor con la imagen. Pend: `/fondo-transparente` |
| GROW-3 | F1 Tool-landings | Landings por color de fondo (ya hacemos fondo sólido): `fondo-blanco`, `fondo-negro`, `fondo-azul`, `fondo-rojo`, `fondo-verde` | Alta | ✅ commit 551b04e. 5 landings /herramientas/fondo-* con contenido único por color. SEO_ROUTES 33 |
| GROW-4 | F2 Features | **Añadir texto a la foto** (canvas, client-side) — abre keyword add-text-to-photo (alto volumen) | Media | feature nueva + SEO |
| GROW-5 | F2 Features | **Desenfocar el fondo** (ya segmentamos: blurear en vez de borrar) — blur-photo-background | Media | reutiliza segmentación |
| GROW-6 | F2 Features | **Añadir sombra al recorte** (realismo) — agregar-sombra | Baja | feature chica, alto "wow" |
| GROW-7 | F3 i18n | Traducir a **inglés, portugués (pt-br) e italiano** (español = base) con hreflang. Multiplicador de tráfico | Alta | 🟡 EN tanda 1 (d562f7c): 5 páginas core /en/tools/ + infra hreflang recíproco (I18N_PAIRS en vite.config, inyección en build). Falta: EN de guías + landing home; luego pt-br e it replicando I18N_PAIRS. Estrategia: por tandas, contenido nativo (no traducción literal), NO volcar 87 páginas de golpe (calidad/AdSense) |
| GROW-8 | F4 Alternativas | Páginas "alternativa gratis a remove.bg / Photoroom / photocut.ai" con tabla gratis/sin-registro/privado (intención de compra ajena) | Media | ellos tienen alternativas-a-photoshop/slazzer |
| GROW-9 | F5 Autoridad | Backlinks: Product Hunt, directorios de herramientas, r/webdev; forzar indexación en Search Console (causa real de "cero visitas") | Alta | sin backlinks el contenido no despega |
| GROW-10 | Transversal | Badge "Gratis · Sin registro · No subimos tus fotos" en cada landing + privacidad como argumento/contenido | Media | refuerza la cuña en todas las páginas |

> Orden recomendado: F0 → F1 (GROW-1/2/3) → F2 → F3 (en/pt/it) → F4/F5 en paralelo.

## Veredictos QA
| Tarea | Veredicto | Defectos (si rechazo) | Fecha |
|-------|-----------|------------------------|-------|
| T-002a/b/c (intento 2) | APROBADO (nerv-qa Adversarial + nerv-verifier ciego, ambos PASA) | — D1-D4 cerrados y verificados. nerv-verifier confirmó por prueba de mutación que los tests nuevos atrapan el race (quitar el guard → 2/4 fallan). Gate determinista P-12 PASS (archivos declarados == diff; 81/81 tests). Hallazgo no bloqueante → D-02. | 2026-06-28 |
| T-002a/b/c (intento 1) | RECHAZADO (nerv-qa + nerv-verifier, convergen) | D1 [CRÍTICO/bloqueante] race use-after-free: releaseAi() puede liberar la sesión ONNX durante una inferencia/warmup en vuelo — timer 30s armado al INICIO de la op (cutoutWorker.js:57-74, backend.js:69-85), sin guard de op-activa; session.run usa la instancia ya liberada (aiSegmenter.js:99-133). D2 [reliability] cero tests para la lógica nueva (releaseAi, dispose en finally, contrato {blob,bitmap}, pintado por ImageBitmap). D3 [menor] CanvasEditor.jsx:141 no hace bitmap.close() en rama feliz (depende implícitamente de backend). D4 [bajo] doc falsa en backend.js:217-219 (dice que inline no tiene bitmap, sí lo tiene). VERIFICADO OK: dispose tensores (A2), transporte ImageBitmap worker+inline (B1), undo cap 10 (C1), reuso canvases aiMatte (C2). | 2026-06-28 |

## Deuda técnica
| ID | Descripción | Origen | Prioridad |
|----|-------------|--------|-----------|
| D-01 | jsEngine.js (motor web) es intencionalmente simple; paridad real con desktop requiere compilar photocut-core a WASM | README §Upgrading | Media |
| D-03 | Sidebar/rail se corta en desktop (viewport ancho o app Tauri, a confirmar) — no se ve bien. Reportado por PO 2026-07. Tratar en fase UI/landing (T-011) | PO test | Media |
| D-04 | Recorte IA "alucina" en imágenes SIN sujeto saliente claro (capturas de pantalla/escritorio Windows) — limitación del modelo u2net (salient object detection), no bug del lote. Fix real = otro modelo. Documentar/avisar en UI a futuro | PO test batch | Baja |
| D-02 | Canvases reusados en aiMatte (aiSegmenter.js ~128-131, fix T-002c/A3) NO son seguros ante dos aiMatte verdaderamente concurrentes en el camino inline (interleaving sobre el mismo buffer). Hoy NO es defecto vivo (la UI serializa: espera la promesa anterior). Crear ticket si se habilita disparo concurrente. Detectado por nerv-qa+nerv-verifier en T-002 | QA T-002 (intento 2) | Baja |

## Histórico (sprints cerrados: 3 líneas c/u, máx. 5 sprints; el resto a ~/.nerv/archive/)
- (ninguno aún)

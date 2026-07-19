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
| GROW-15 | F2 pendientes | ✅ COMPLETO. Análisis: histograma+daltonismo (d39c9c0). Texto (7a262b0)+fuente propia (4ce7491). **Blur de fondo** (53a3901, jsEngine.compositeBlur, en ExportPanel). **Sombra ya existía** (FinishPanel en el editor). | Media | cerrado 2026-07-15 |
| GROW-16 | Futuro | **Store de stickers** dentro de la herramienta de texto/edición: catálogo de stickers para pegar sobre la foto (¿gratis + premium?). Idea del PO 2026-07-15, para más adelante. Pensar: fuente de assets, licencias, si se monetiza | Baja (futuro) | trackear, no implementar aún |
| GROW-2 | F1 Tool-landings | Landing indexable por herramienta: `/herramientas/quitar-fondo`, `/cambiar-fondo` — H1=keyword, how-to, FAQ, schema, CTA al editor | Alta | ✅ commit (F1 cierre). WebApplication+HowTo+FAQPage, transaccional vs guía educativa (cross-link). Falta futuro: mini-uploader que abra editor con la imagen. Pend: `/fondo-transparente` |
| GROW-3 | F1 Tool-landings | Landings por color de fondo (ya hacemos fondo sólido): `fondo-blanco`, `fondo-negro`, `fondo-azul`, `fondo-rojo`, `fondo-verde` | Alta | ✅ commit 551b04e. 5 landings /herramientas/fondo-* con contenido único por color. SEO_ROUTES 33 |
| GROW-4 | F2 Features | **Añadir texto a la foto** (canvas, client-side) — abre keyword add-text-to-photo (alto volumen) | Media | feature nueva + SEO |
| GROW-5 | F2 Features | **Desenfocar el fondo** (ya segmentamos: blurear en vez de borrar) — blur-photo-background | Media | reutiliza segmentación |
| GROW-6 | F2 Features | **Añadir sombra al recorte** (realismo) — agregar-sombra | Baja | feature chica, alto "wow" |
| GROW-7 | F3 i18n | Traducir a **inglés, portugués (pt-br) e italiano** (español = base) con hreflang. Multiplicador de tráfico | Alta | 🟡 EN tanda 1 (d562f7c): 5 páginas core /en/tools/ + infra hreflang recíproco (I18N_PAIRS en vite.config, inyección en build). Falta: EN de guías + landing home; luego pt-br e it replicando I18N_PAIRS. Estrategia: por tandas, contenido nativo (no traducción literal), NO volcar 87 páginas de golpe (calidad/AdSense) |
| GROW-8 | ~~F4 Alternativas~~ | ~~Páginas "alternativa gratis a remove.bg / Photoroom / photocut.ai"~~ | — | ❌ **DESCARTADA POR EL PO (2026-07-15).** Se implementó (e29a876) y se revirtió entera. **Política permanente: no se nombran competidores ni se hacen comparativas.** Ver nota abajo. F4 queda cerrada sin entregables. |
| GROW-9 | F5 Autoridad | Backlinks: Product Hunt, directorios de herramientas, r/webdev; forzar indexación en Search Console (causa real de "cero visitas") | Alta | sin backlinks el contenido no despega |
| GROW-10 | Transversal | Badge "Gratis · Sin registro · No subimos tus fotos" en cada landing + privacidad como argumento/contenido | Media | refuerza la cuña en todas las páginas |

> Orden recomendado: F0 → F1 (GROW-1/2/3) → F2 → F3 (en/pt/it) → F4/F5 en paralelo.

## F6 — Features nuevas (investigación de mercado 2026-07-16)

**Hallazgo estratégico:** la tesis client-side está VALIDADA por el mercado
(Squoosh de Google Chrome Labs corre MozJPEG/WebP/AVIF en WASM sin subir nada;
hay suites con 35 herramientas 100% en el navegador). Pero eso corta para los
dos lados: **"privado + gratis" ya no diferencia solo**. Lo que sí nos
diferencia es que tenemos **la parte difícil** (segmentación IA en el
navegador) y ellos no; lo que falta son **las utilidades aburridas de alto
volumen** que traen tráfico.

**Clave: el motor de comprimir/convertir/redimensionar YA EXISTE**, enterrado
dentro de otras features — falta exponerlo:
- `canvasToBlob(canvas, mime, quality)` (jsEngine.js:987) → comprimir/convertir
- `stripToBlob(img, mime, quality)` (metadata.js:144) → literalmente ya es un conversor
- `compositePreset({w,h,padding,bg,circle})` (jsEngine.js:634) → redimensionar
- `compositeBlur` (jsEngine.js) → desenfoque

| ID | Tarea | Demanda | Costo | Notas |
|----|-------|---------|-------|-------|
| GROW-17 | **Comprimir / convertir** (PNG↔JPG↔WebP + calidad) | Muy alta | **Casi cero** | El motor ya está. Squoosh valida el modelo. Landing nueva = keywords que hoy no tocamos → ataca también el problema de tráfico. **Primera.** |
| GROW-18 | **Redimensionar** (px/%/presets) | Muy alta | **Casi cero** | `compositePreset` ya lo hace. |
| GROW-19 | **Difuminar caras / censurar** | Alta | Media | **La de mejor encaje de marca.** El blur ya existe; falta detección de caras (modelos tipo BlazeFace pesan cientos de KB vs 4,4 MB de u2netp — VERIFICAR antes de comprometer). Pitch verdadero y demoledor: nadie sube la foto de los chicos del colegio a un servidor ajeno para taparles la cara. Presión GDPR + demanda real de redacción. Acá la privacidad no es un plus, es el requisito. |
| GROW-20 | **HEIC → JPG** | Muy alta | Alta | EL dolor iPhone→Windows, volumen enorme. Los navegadores NO decodifican HEIC (salvo Safari) → necesita libheif en WASM (~MBs). Única con dependencia pesada: vale la pena, pero no primero. |

**DESCARTADAS (rompen la tesis del producto):**
- **Fondos generativos con IA**: necesita GPU en servidor. Mata el "no subimos tu foto".
- **Upscaler con IA**: modelo pesado y resultado mediocre client-side. No compite.

### Hub "Editar" — decisión del PO (2026-07-18)

La pestaña **Texto** pasa a llamarse **"Editar"** (id interno `text` intacto →
no rompe los deep-links `?tab=text` ni las landings). Es el HUB de todo lo que
se aplica/agrega ENCIMA de la foto. Reordenado en el navbar para seguir el
flujo natural: **Recorte · Editar · Lote · Icon Studio · Color · Archivo**
(editás justo después de recortar). Commit del rename+reorden: (ver git).

**El PO pidió que esta sección trabaje directamente con Recorte** — o sea que
pueda tomar el resultado del recorte (sujeto recortado) como base para editar,
no sólo la imagen plana. A cablear al construir las features (hoy Editar
auto-carga la imagen compartida; falta la opción de partir del recorte).

Features trackeadas para el hub Editar (todas 100% client-side):
| ID | Feature | Estado | Nota |
|----|---------|--------|------|
| — | **Texto sobre la foto** | ✅ hecho | ya vive acá (fuente propia incl.) |
| GROW-19 | **Censurar caras** (blur/pixelado) | ✅ **HECHO** | YuNet 227KB en `faceDetect.js` (detect+decode+NMS, 6 tests). Censura con clip elíptico. UI en el hub Editar (sub-switcher Texto\|Caras), toggle por cara, blur/pixelado+intensidad. Detección VERIFICADA en Chrome (retrato real, score 0.946). PENDIENTE PO: probar con variedad de fotos reales (grupos, caras chicas, ángulos). |
| GROW-16 | **Stickers** | trackeado | catálogo para pegar sobre la foto. ¿gratis+premium? assets/licencias a definir. |
| GROW-21 | **Marca de agua repetida** (mosaico/diagonal) | trackeado | alta demanda; distinta del texto suelto. Texto/logo tileado con opacidad/ángulo. |
| GROW-22 | **Difuminar/tapar zona a mano** | ✅ **HECHO** | Plegado en el tool de censurar caras: arrastrar sobre la foto agrega una región (rectángulo completo, sin margen) que se tapa con blur/pixelado. Convive con las caras auto-detectadas. Verificado en Chrome. |
| GROW-23 | **Filtros simples** (B&N, sepia, contraste) | trackeado | baratísimo client-side, mucha búsqueda. |
| GROW-24 | **Formas/flechas para anotar** | trackeado | recuadros y flechas sobre screenshots. |

**Orden sugerido del hub:** GROW-19 (caras) → GROW-16 (stickers) → GROW-21
(marca de agua) → GROW-22 (censura a mano) → 23/24 bonus.

**Orden recomendado:** GROW-17 + GROW-18 (casi gratis, superficie SEO
inmediata) → GROW-19 (marca) → GROW-20 (cuando se quiera invertir en peso).

**PENDIENTE DE DECISIÓN (PO):** dónde vive comprimir/convertir. El editor ya
tiene 6 pestañas y el navbar venía desbordado (arreglado en 956b557); sumar una
7ª empeora eso. Alternativa: extender la pestaña **Datos**, que YA re-encodea
(su "descargar sin metadatos" usa `stripToBlob`, o sea el mismo motor) y
renombrarla a algo más amplio. Las landings de SEO pueden deep-linkear con
`?tab=`.

### ⛔ POLÍTICA DE CONTENIDO — decisión del PO (2026-07-15)

> **Nunca se publica una página "alternativa a X" ni una comparativa contra
> otra herramienta. No se nombran competidores en el sitio. No proponer esta
> táctica de nuevo.**

Origen: GROW-8 se implementó (4 páginas ES+EN vs remove.bg y Photoroom,
e29a876) y el PO la descartó de raíz. Revertido entero en 5a5f8f2: páginas
borradas, enlaces de los hubs quitados, rutas fuera de SEO_ROUTES/I18N_GROUPS.
Sitemap vuelve a 63. Verificado: 0 menciones a competidores en dist/, 0 links
rotos, 0 huérfanas.

**Razones del PO (válidas y por encima del SEO):** le hace publicidad gratis a
la competencia, mete sus marcas en nuestro sitio, expone a reclamos por datos
que además envejecen solos, y nos posiciona como "el reemplazo barato de" en
vez de como producto propio.

**Señal de alarma que confirmó la decisión:** antes de publicar, la táctica ya
había obligado a frenar dos páginas — una por dato falso (el backlog asumía que
photocut.ai exigía registro; ellos anuncian "no signup required") y otra por
colisión de marca (PhotoCut Studio vs PhotoCut).

**Qué hacer en su lugar:** comunicar nuestra ventaja en positivo y sin
nombrar a nadie — "tu foto no se sube a ningún servidor", "sin registro",
"sin marca de agua". Ya es lo que hacen las landings de herramientas.


## Sprint 5 — F6: utilidades de archivo (GROW-17/18) — PLAN

> **Decisión de ubicación (PO, 2026-07-16): NO se crea una 7ª pestaña.** Se
> extiende la pestaña **Datos** (`tab=meta`), que ya re-encodea con el mismo
> motor (`stripToBlob` = `canvas.toBlob(mime, quality)`). Motivos: el navbar
> venía desbordado (arreglado en 956b557) y una 7ª pestaña lo empeora; y
> "inspeccionar el archivo" + "transformar el archivo" son la misma tarea
> mental. Las landings de SEO entran por `?tab=meta`.
>
> **Renombre pendiente:** "Datos" ya no describe lo que hace. Propuesta:
> **"Archivo"** (cubre info + EXIF + convertir + redimensionar sin prometer de
> más). Alternativa: "Optimizar" (dice el beneficio, pero deja afuera el visor
> EXIF). **Decide el PO.**

| ID | Ext | Tarea | Asignado | Estado | Niv | Criterios de aceptación | Rama |
|----|-----|-------|----------|--------|-----|--------------------------|------|
| T-014 | GROW-17 | **Comprimir / convertir** (PNG↔JPG↔WebP + calidad) en la pestaña Archivo | Orquestador | **Done (4c3d337)** | S | (1) Sección nueva en el rail de `MetadataPage.jsx`: selector de formato (PNG/JPG/WebP) + slider de calidad; (2) **el slider NO se muestra con PNG**: `canvas.toBlob` ignora `quality` en PNG — un control que no hace nada es mentirle al usuario; (3) muestra **peso original → peso estimado + % de ahorro**, recalculado al cambiar formato/calidad, con debounce y sin bloquear la UI (re-encodear es sincrónico y en fotos grandes jankea); (4) **GOTCHA: PNG/WebP transparente → JPG.** JPG no tiene canal alfa y el canvas rellena el fondo de NEGRO por defecto. Detectar transparencia y (a) avisar y (b) rellenar en blanco, no en negro; (5) descarga con nombre y extensión correctos (`foto.png` → `foto.jpg`); (6) reusa `stripToBlob`/`canvasToBlob` — NO escribir un re-encoder nuevo; (7) efecto colateral honesto: al re-encodear se pierden los metadatos, decirlo en la UI (es una feature, no un accidente); (8) i18n es/en/pt; (9) jest + `npm run test:web` verdes | — |
| T-015 | GROW-18 | **Redimensionar** (px / % / presets) en la pestaña Archivo | Orquestador | **Done** | S | (1) Ancho/alto en px + porcentaje, con **candado de proporción** activado por defecto; (2) presets reusando `compositePreset` (redes/marketplace ya definidos); (3) no permitir agrandar más de 1× sin avisar (interpolar no agrega detalle: prometerlo sería vender un upscaler que no tenemos → ver GROW-20 descartadas); (4) combina con T-014: redimensionar + convertir en una sola descarga; (5) muestra dimensiones y peso resultantes antes de descargar; (6) i18n es/en/pt; (7) jest + test:web verdes | — |
| T-016 | GROW-17/18 | **Landings SEO** de comprimir/convertir/redimensionar (ES+EN) | Orquestador | **Done** | A | (1) `/herramientas/comprimir-imagen.html` + `/herramientas/redimensionar-imagen.html` + sus pares EN; (2) sumar a `SEO_ROUTES` **y** a `I18N_GROUPS` (el hreflang lo inyecta el build solo); (3) enlazar desde ambos hubs — **0 huérfanas**; (4) CTA con deep-link `?tab=meta`; (5) JSON-LD válido; (6) **NO nombrar competidores** (política del PO, ver § POLÍTICA DE CONTENIDO) | — |

**Riesgo transversal (T-014/T-015):** re-encodear en el hilo principal jankea
con fotos grandes. El proyecto ya tiene worker (`cutoutWorker.js`) y la lección
del Sprint 1 fue justamente memoria/OOM con fotos grandes. Si el estimado en
vivo se siente pesado, mover el re-encode al worker antes que bajar la calidad
del preview.

**Verificar antes de prometer (GROW-19):** el peso real de un modelo de
detección de caras (BlazeFace y similares rondan cientos de KB, vs 4,4 MB de
u2netp) — NO comprometer la feature hasta medirlo, igual que se hizo con D-04.


### Spike GROW-19 — difuminar caras: peso MEDIDO, viable (2026-07-17)

**Se resolvió la incógnita que frenaba la feature** (peso del modelo), midiendo
en vez de suponer — como con D-04.

**Detección de caras client-side, candidatos ONNX** (reusan el runtime que YA
tenemos cargado para u2netp → cero peso de runtime nuevo):

| Modelo | Peso REAL (medido) | Licencia | Fuente |
|--------|--------------------|----------|--------|
| **YuNet** | **227 KB** | **MIT** | OpenCV (oficial, HuggingFace) |
| yolov8n-face | 11,6 MB | — | deepghs — DESCARTADO, más pesado que u2netp entero |
| Ultra-Light-1MB / BlazeFace | ~1 MB | MIT | alternativas si YuNet no rindiera |

Referencia: u2netp, que ya shippeamos, pesa **4,36 MB**. **YuNet es 1/20 de
eso.** El peso deja de ser un argumento en contra: 227 KB es despreciable.

**Recomendación: YuNet.** MIT, minúsculo, de OpenCV (mantenido, confiable),
milisegundos por imagen, reusa onnxruntime-web. Da bbox + 5 landmarks + score.

**Lo que SÍ queda por hacer (no es gratis, pero es acotado):**
- Pre/post-proceso de YuNet: resize+normalize de entrada, y NMS
  (non-max suppression) sobre las cajas de salida. Bien documentado, pero hay
  que escribirlo y **verificar la forma real del output con el modelo cargado**
  (no se puede a ciegas).
- El blur en sí YA EXISTE (compositeBlur / canvas). Aplicarlo sólo dentro de
  cada caja detectada es la parte fácil.
- Lazy-load + cache por service worker, igual que u2netp (bajar el modelo sólo
  al usar la feature, no en cada carga).
- **Trampa tipo D-04:** si no detecta caras, NO hacer como que funcionó —
  decirlo. YuNet da un score por caja: usarlo como umbral.

**DECISIÓN DE PRODUCTO PENDIENTE (PO): ¿blur o pixelado?** La investigación de
mercado señaló que para GDPR el blur reversible puede no alcanzar — el pixelado
fuerte o la caja sólida son irreversibles y más defendibles legalmente.
Sugerencia: ofrecer ambos, default al pixelado fuerte. Es tu decisión de marca,
no técnica.

**Por qué NO se implementó en esta corrida autónoma:** agregar un modelo de ML
nuevo al producto + pipeline de detección que sólo se puede verificar bien con
caras reales en el navegador, más la decisión blur/pixelado, es demasiado para
shippear sin que el PO lo vea. El spike (medir + recomendar) es el paso
responsable; la implementación queda como ticket listo para arrancar.

## Veredictos QA
| Tarea | Veredicto | Defectos (si rechazo) | Fecha |
|-------|-----------|------------------------|-------|
| T-002a/b/c (intento 2) | APROBADO (nerv-qa Adversarial + nerv-verifier ciego, ambos PASA) | — D1-D4 cerrados y verificados. nerv-verifier confirmó por prueba de mutación que los tests nuevos atrapan el race (quitar el guard → 2/4 fallan). Gate determinista P-12 PASS (archivos declarados == diff; 81/81 tests). Hallazgo no bloqueante → D-02. | 2026-06-28 |
| T-002a/b/c (intento 1) | RECHAZADO (nerv-qa + nerv-verifier, convergen) | D1 [CRÍTICO/bloqueante] race use-after-free: releaseAi() puede liberar la sesión ONNX durante una inferencia/warmup en vuelo — timer 30s armado al INICIO de la op (cutoutWorker.js:57-74, backend.js:69-85), sin guard de op-activa; session.run usa la instancia ya liberada (aiSegmenter.js:99-133). D2 [reliability] cero tests para la lógica nueva (releaseAi, dispose en finally, contrato {blob,bitmap}, pintado por ImageBitmap). D3 [menor] CanvasEditor.jsx:141 no hace bitmap.close() en rama feliz (depende implícitamente de backend). D4 [bajo] doc falsa en backend.js:217-219 (dice que inline no tiene bitmap, sí lo tiene). VERIFICADO OK: dispose tensores (A2), transporte ImageBitmap worker+inline (B1), undo cap 10 (C1), reuso canvases aiMatte (C2). | 2026-06-28 |

## Deuda técnica
| ID | Descripción | Origen | Prioridad |
|----|-------------|--------|-----------|
| D-01 | jsEngine.js (motor web) es intencionalmente simple; paridad real con desktop requiere compilar photocut-core a WASM | README §Upgrading | Media |
| ~~D-03~~ | ~~Sidebar/rail se corta en desktop~~ | PO test | ✅ **NO REPRODUCE (2026-07-18):** verificado en 2560×1400, el rail scrollea (overflow-y:auto) y todo el contenido es accesible, nada se corta. Lo resolvió el layout de T-011. |
| D-04 | Recorte IA "alucina" en imágenes SIN sujeto saliente claro (capturas de pantalla/escritorio Windows) — limitación del modelo u2net (salient object detection), no bug del lote. **Fix real = otro modelo — CONFIRMADO EMPÍRICAMENTE 2026-07-16, ver nota abajo. NO reintentar detectarlo por confianza.** | PO test batch | Baja |
| ~~D-02~~ | ~~Canvases reusados en aiMatte NO son seguros ante dos aiMatte concurrentes~~ | QA T-002 | ✅ **CERRADA (b36c595)**: la cola vive ahora en `aiMatte()`, el módulo es seguro por sí mismo sin perder el reuso de canvases (T-002c/A3). `inFlight` cubre la espera en cola → releaseAi() no libera con trabajo encolado. 3 tests, verificados por mutación. |
| ~~D-05~~ | ~~`npm run test:web` en rojo (2 suites)~~ | Auditoría D-04 | ✅ **CERRADA — `✓ todo verde`.** NINGUNA era regresión: los dos tests medían comportamiento viejo tras decisiones de producto deliberadas. (a) `cutRect: 84.7% > 93%` → cutRect ya NO segmenta, es recorte rectangular por pedido del PO ("lo que el usuario marca y nada más"); 84.7% es EXACTO al teórico de un crop rectangular con ese margen (calculado). Ahora se mide contra el recuadro (100%) y la precisión de GrabCut se exige a autoCut, que es donde vive (99.9%). (b) botón ⬇ oculto a propósito en T-012 → el test ahora afirma que sigue oculto. **BONUS: el bloque WASM del test no ejercitaba el WASM** — cutRect es JS puro y el wasm sólo expone `segment()`; ahora mide autoCut (100%). |

### Nota D-04 — hipótesis de "confianza" REFUTADA con datos (2026-07-16)

**No reintentar esto.** Se probó detectar la alucinación sin cambiar de modelo y
la medición lo descartó.

**Hipótesis:** en `aiSegmenter.aiMatteInner` el post-procesado hace min-max
(`(out-mi)/(ma-mi)*255`), que estira SIEMPRE la salida a 0..255. Se suponía que
sin sujeto saliente u2netp devolvería valores casi uniformes (rango `ma-mi`
chico) y que el min-max amplificaría ese ruido hasta una máscara nítida y
falsa — o sea que el rango crudo servía como medida de confianza gratis, ya
calculada y descartada. Con eso se podía avisar en la UI.

**Medición** (u2netp real en Chrome vía el harness de `test/run-tests.mjs`,
tres imágenes sintéticas de 320×320):

| caso | confidence (rango crudo) | cobertura del matte |
|------|--------------------------|---------------------|
| sujeto saliente claro | **1.0000** | 17.7% |
| captura de escritorio (el caso de D-04) | **1.0000** | 48.5% |
| ruido plano sin estructura | 0.0089 | 2.4% |

**Conclusión: la señal no separa nada.** La captura de escritorio da confianza
**idéntica** a la foto con sujeto real (separación 0.0000). u2netp no está
"inseguro" cuando alucina: produce una saliencia perfectamente bimodal (~0 vs
~1) — simplemente elige mal *qué* es saliente. El rango sólo cae con ruido
plano, que no es el caso reportado. La cobertura (48.5% vs 17.7%) tampoco
sirve: un retrato de primer plano cubre igual o más, legítimamente.

**Por qué importa:** de haber shipeado el umbral sin medir, habría quedado un
aviso que nunca dispara en el caso real y que sí molestaría en fotos válidas,
más un cambio de contrato en aiMatte/worker/backend para nada.

**El fix real sigue siendo cambiar de modelo** (uno con noción de "no hay
objeto saliente", o calibrado en confianza — p.ej. IS-Net/BiRefNet). Eso es un
proyecto, no deuda menor: revisar tamaño del modelo (hoy u2netp pesa 4,4 MB y
se descarga en el navegador) y licencia antes de considerarlo.

## Histórico (sprints cerrados: 3 líneas c/u, máx. 5 sprints; el resto a ~/.nerv/archive/)
- (ninguno aún)

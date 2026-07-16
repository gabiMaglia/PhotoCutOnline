# STATE — photocut · actualizado: 2026-07-15 (Sprint 4: SEO/Growth)
**Sprint:** 4 — Contenido + Roadmap competitivo (rehabilitar AdSense + indexación)
**Rama activa:** main (todo mergeado)
**En curso:** ✅ F0 CERRADA: 20/20 guías (commits d136462 +6, 57a371a +5, sitemap 9→26 URLs). Roadmap competitivo persistido en 03_backlog (GROW-0…10, análisis photocut.ai). PO confirmó i18n a es(base)/en/pt-br/it.
**AdSense:** RECHAZADO "contenido de poco valor" → F0 cerrada. Pendiente: capturas reales en guías + RE-APLICAR (decisión PO).
**Bloqueos:** ninguno
**✅ F1 CERRADA:** hub /herramientas/ + landings quitar-fondo/cambiar-fondo (GROW-2, 80309bb) + 5 landings por color (GROW-3, 551b04e) + herramienta Colores (paleta+cuentagotas, e07f2fa, fix canvas 3e6b171) + landing paleta.
**✅ F2 análisis (GROW-12 a+b):** contraste WCAG en pestaña Colores (adcfb18) + visor metadata/EXIF + "descargar sin metadatos" en pestaña Datos + landing (10bbb32). Editor ahora 5 pestañas (cut/icons/batch/colors/meta). Sitemap 9→36 URLs. Todo pusheado a main. Tests 108/108.
**🟡 F3 i18n en marcha (EN + PT):** infra hreflang N-idiomas en vite.config (I18N_GROUPS mapa idioma→ruta; inyecta hreflang de todos los idiomas del grupo + x-default→ES; escala a `it` agregando la clave). CSS de landing extraído a public/landing.css compartido.
- **EN completo (11 págs)**: home /en/ + /en/tools/ (hub, remove/change-background, color-palette, exif, white/black/blue/red/green-background). commits d562f7c, ab75458, c969c24.
- **PT-BR (6 págs, a1eccfe)**: home /pt/ + /pt/ferramentas/ (hub, remover-fundo, trocar-fundo, paleta-de-cores, metadados-exif). Faltan las 5 pt por color.
Sitemap 36→54. Tests 123/123.
**✅ Color Studio (05c4a5b + c5906d5):** pestaña "Color Studio" (id tab "colors"). Modo Tema (dark/light desde captura), Recolorear (CSS/Tailwind→gradient map), +paletas bajo cada preview, layout adaptativo, **generador de color scheme** (escalas 50–900 por rol + semánticos → CSS/Tailwind). libs recolor.js+scheme.js (24 tests). Guía generar-modo-oscuro. Font-ID descartado. Tests 132/132, sitemap 54.
**✅ Análisis F2 cerrado (d39c9c0):** histograma + daltonismo/CVD (modos en Color Studio, lib/analysis.js) + color promedio. Color Studio = Paleta·Tema·Recolorear·Histograma·Daltonismo. Tests 137/137.
**✅ GROW-15 COMPLETO:** Texto (tab "text", 7a262b0) + fuente propia via FontFace (4ce7491). **Blur de fondo/portrait** (53a3901, jsEngine.compositeBlur en ExportPanel, gated features.finish). **Sombra ya existía** (FinishPanel). Fixes de canvas deadlock (Color Studio 3e6b171 + Texto a378c93) → memoria [[photocut-canvas-mount-deadlock]]. Topbar 6 tabs. Sitemap 55. Tests 137/137.
**Landings features nuevas (06c2ca7):** desenfocar-fondo/blur-background + simulador-daltonismo/color-blindness-simulator (ES+EN, hreflang). Texto: quitada la alineación (sin marco de ref).
**Contenido AdSense (174eedf):** +4 guías → **25 guías** (paleta-de-colores, marca-de-agua, quitar-ubicacion-GPS, accesibilidad-contraste-daltonismo). Enlazan a las herramientas nuevas. **Sitemap 63 URLs.**
**AUDITORÍA DE CONTENIDO OK (2026-07-15):** 0 huérfanas (100% en sitemap), los 3 hubs enlazan el 100% de sus páginas (25 guías, 12 herram. ES, 11 EN), landing enlaza ambos hubs, robots Allow+Sitemap. **LISTO para re-aplicar a AdSense.**
**⛔ F4 CERRADA SIN ENTREGABLES — GROW-8 DESCARTADA POR EL PO (2026-07-15).** Se implementó (e29a876: 4 págs "alternativa a" remove.bg/Photoroom ES+EN) y se revirtió entera (5a5f8f2). **POLÍTICA PERMANENTE: no se nombran competidores ni se hacen comparativas — no volver a proponerlo.** Motivos + qué hacer en su lugar: 03_backlog.md § "POLÍTICA DE CONTENIDO". Sitemap vuelve a 63, 0 menciones a competidores, 0 links rotos, 0 huérfanas, tests 137/137.
**🟡 F5 autoridad (GROW-9) — plan en engram/07_f5_autoridad.md.** Auditoría sobre el sitio EN VIVO: **el problema NO es técnico.** 63/63 URLs 200, texto en HTML crudo (no depende de JS), sin noindex, canonical+hreflang OK, robots OK, apex→www 308, og.png 1200×630 OK. Google puede indexar todo → el cuello es que **nadie enlaza**. Trabajo restante es 100% del PO (requiere sus cuentas): propiedad www en Search Console + sitemap + solicitar indexación de 6 URLs + Bing. Límite fijado: **no comprar/intercambiar enlaces ni astroturfear**; difusión la publica el PO como autor. Ángulo honesto = IA 100% en el navegador, la foto no se sube (WASM+ONNX).
**Redeploy Vercel:** disparado con commit vacío ca86475 (auto-deploy en push; si estuviera off → clic Redeploy en dashboard). CLI de Vercel NO instalado local.
**Idea futura trackeada:** GROW-16 store de stickers (PO).
**NOTA:** layout adaptativo Color Studio espacio-óptimo (opuesto a palabra literal del PO), ofrecido invertir.
**Próximo paso sugerido:** F3 seguir por tandas → EN de guías top + landing home; luego pt-br e it (replicar I18N_PAIRS). NO volcar todo de golpe (calidad/AdSense). Alternativa: F2 extra (histograma/daltonismo). En paralelo PO: REDEPLOY Vercel (publica todo, incl. fix canvas); re-aplicar AdSense; Umami env; propiedad www Search Console; indexar URLs nuevas.
**CLAVE i18n:** para agregar un par ES↔EN nuevo → sumar a I18N_PAIRS en vite.config + crear el archivo /en/... + agregar la ruta EN a SEO_ROUTES. El hreflang lo inyecta el build solo. Gestión PO pendiente: setear VITE_UMAMI_SRC/WEBSITE_ID en Vercel + redeploy; crear propiedad www en Search Console; pedir indexación de guías nuevas.
**INCIDENTE (lección):** el agente T-013 hizo un `git reset` que revirtió jsEngine.js → se perdieron el Recuadro crop + su autoCut (sin commitear). Rehechos y commiteados. Lección: commitear cada unidad apenas se termina, no dejar el árbol enorme sin commitear.
**Deuda:** D-04 IA alucina en imgs sin sujeto (limit. modelo u2net). D-02, D-03(resuelto).
**Sprint 2 (CERRADO):** sitio monetizable LIVE www.photocutapp.com; AdSense en revisión (pub ca-pub-3865058604661161); Search Console OK.
**Preguntas abiertas al PO:** 1 (Figma — 01_requirements.md §6)

Dominio www.photocutapp.com (Namecheap→Vercel, apex→www). SEO completo live: home crawleable, About/Contacto, 9 guías (JSON-LD HowTo/FAQPage), sitemap 15 URLs "Correcto" en Search Console.
AdSense: código+ads.txt+CMP 3-opciones, EN REVISIÓN (pub ca-pub-3865058604661161). Search Console verificado (archivo).
CLAVE: sitemap/robots/canonical los GENERA vite.config.js desde VITE_SITE_URL (env Vercel=www) + SEO_ROUTES. NO editar a mano. Runbook: ~/.nerv/recipes/web-monetizacion-adsense-seo.md.

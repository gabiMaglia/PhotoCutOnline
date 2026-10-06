# STATE — photocut · actualizado: 2026-10-06 18:05
**Sprint:** 7 — Fase B auditoría 2026-10 (contenido) ✅ CERRADO · Sprint 6 Fase A ✅ CERRADO · auditoría completa en engram/10
**Rama activa:** main @ 0a181a1 = origin/main → deploy Vercel automático, CI verde (ahora corre `npm test`: 223 jest + 62 scripts + harness Chrome)
**En curso:** nada técnico. GROW-33 (autor verificable) BLOQUEADO: espera 2-3 proyectos con enlace del PO.
**Bloqueos:** GROW-33 espera input PO · BUG-01 (presets ignoran color) y BUG-06 (pestaña Stickers desactivada) esperan decisión PO.
**Hecho en producción (2026-10-06):** hero con ilustración del PO · legales EN/PT · footer de confianza 6 enlaces/126 págs · fuentes propias + AdSense diferido (LCP móvil 4,2→2,4 s) · editor i18n/móvil/teclado/voseo/progreso modelo · varita corregida (estaba invertida) · Recuadro→"Recortar área" · 25→20 guías/idioma con 18 redirects 308 · "Lo probamos" con 20 mediciones reales reproducibles (`scripts/pruebas.json`, `npm run pruebas`) en 60 guías · datePublished/dateModified reales · /novedades ES/EN/PT.
**Convenciones:** commits mecánicos masivos `[lastmod-skip]`; tras tocar páginas `npm run lastmod` + commit del json; merge sin squash; footer desde `scripts/lib/trust.mjs`; pruebas desde `scripts/pruebas.json` (+ `npm run pruebas:render`).
**Línea base (Umami 90 d al 2026-10-06):** 86 visitantes/mes, 36 % llega a /editor/, Google≈Bing. GDPR activo en AdSense.
**Próximo paso sugerido:** Fase C = PO: publicar launch kit (engram/08), pasar datos de autor, decidir BUG-01/06. Reaplicar AdSense SOLO con ≥1.000 visitantes/mes y ≥300 clics/mes GSC sostenido 4 semanas (engram/10 §6). Técnico opcional: BUG-01..07, D-08/D-09/D-10.
**Preguntas abiertas al PO:** 4 (GROW-33 datos, BUG-01, BUG-06, Figma §6 heredada)

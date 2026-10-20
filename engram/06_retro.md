# Retro — photocut

> Entradas nuevas ARRIBA. Una por sesión, ≤8 líneas. La escribe el Orquestador en el
> cierre (P-10). Las lecciones de proceso que aplican a CUALQUIER proyecto se promueven
> a ~/.nerv/playbook.md; lo específico de este proyecto queda acá.

### 2026-10-20 — Sprint 9 cierre (lanzamiento desbloqueado)
✅ El PO encontró en su iPhone lo que ningún test veía (BUG-13: BiRefNet 115 MB tumba iOS); una prueba de 2 min (flag WebGPU off) confirmó la hipótesis antes de tocar código. Verificador ciego + QA X coincidieron y midieron el rojo en Chrome real. El diagnóstico de C2 en docker con CPU limitada encontró la causa (arnés con socket.destroy → libsoup) en vez de taparla.
⚠️ 6 rechazos de QA fueron de PROCESO, no de código: el orquestador no registró returns (HANDOFF_INCOMPLETE), un sello quedó fuera de `## CÓMO`, y cada reintento escaló a X exigiendo planes post-hoc para un cambio de CSS. Las ramas no veían engram de main. _state.md estaba desactualizado y el orquestador prometió una fecha de lanzamiento sin leer el backlog (Sprint 9 bloqueaba). Un TL terminó sin return.
🎯 Leer backlog además de _state.md al arrancar · registrar cada return al recibirlo · ramas de agentes: `git merge main` antes del gate · decidir ADR-003 (RECHAZADO-PROCESO) con el PO.

### 2026-10-06 — Sprints 6+7 (auditoría tras 7º rechazo AdSense → Fases A y B)
✅ 10 tickets Done en una sesión con QA Strong y 0 regresiones en vivo: "worktree por agente + QA por mutación + merge sin squash + verificación en producción tras cada push" funcionó. Dos rechazos de QA atraparon defectos de INTEGRACIÓN que los tests no veían (pie EN/PT hardcodeado; guías que describían una herramienta que ya no hacía eso). Las mediciones reales como contenido (JSON fuente de verdad + render + QA que re-ejecuta y compara con tolerancia: 349 campos) convirtieron relleno en evidencia y encontraron 7 bugs de producto.
⚠️ La memoria "AdSense no es tráfico" estaba vencida: el texto literal del rechazo pide "interés de usuarios". CI estuvo meses sin correr `npm test` (solo build+harness) y nadie lo notó. `ensure-dist` tenía una carrera que pasaba local y fallaba en CI (decía "listo" por existencia de archivo). El `lastmod` real colapsó en producción porque Vercel compila sin git: lo descubrió verificar EN VIVO tras el deploy, no los tests.
🎯 Próxima: (1) ante un rechazo repetido de un tercero, pedir el TEXTO LITERAL antes de reusar el diagnóstico guardado; (2) al cerrar infra de build, simular el entorno del hosting (sin git, runner lento) antes de darla por hecha; (3) pedir `engram/qa/<ID>.md` explícito en cada handoff a QA (esta vez se reconstruyeron al cierre).

### 2026-07-03 — Sprint 2 (dominio + monetización AdSense + SEO)
✅ De cero a sitio monetizable en una sesión: dominio www.photocutapp.com, SEO completo (home crawleable, About/Contacto, 9 guías con JSON-LD HowTo/FAQPage, sitemap), AdSense (código+ads.txt+CMP 3-op) y Search Console, todo LIVE. Packs A/B/C por nerv-web con commit-por-guía, verificados con gate+build+validación JSON-LD+Playwright. Ayudé al PO en la gestión no-código (Namecheap, AdSense, Search Console) paso a paso.
⚠️ Confundí un problema de sitemap con "cache de CDN de Vercel" y perdí tiempo, porque NO detecté que vite.config.js GENERA sitemap/robots/canonical desde VITE_SITE_URL — edité archivos estáticos que el build sobrescribe. Causa real doble: env var de Vercel apuntaba al dominio de preview (vercel.app) + SEO_ROUTES sin las guías nuevas. También: mi T-005 metió canonical/sitemap manuales que colisionaban con el generador.
🎯 Próxima: ANTES de tocar sitemap/robots/canonical, grepear el build (vite.config/plugins/scripts) por generadores SEO; si existe, editar la fuente (SEO_ROUTES + SITE_URL env), nunca los archivos. Y "Redeploy" en Vercel reconstruye el commit viejo, no el último main.

### 2026-06-29 — Sprint 1 (perf & memory leaks → v0.1.4)
✅ El verifier ciego (P-12 adversarial) atrapó un use-after-free en el release de ONNX que mi diagnóstico y el 1er QA no vieron; la prueba de mutación confirmó que los tests no eran vacuos. Comparador e Icon Studio verificados visualmente con Playwright (screenshots). Shippeado a main + Release v0.1.4.
⚠️ Mi diagnóstico T-001 erró el blanco: culpé a la presión de memoria por el jank del pincel, pero la causa era render por software del navegador del PO (Chrome sin GPU) — en Safari fluido. Teoricé 3 veces (memoria → ghost CSS → tamaño de canvas) antes de instrumentar de verdad.
🎯 Próxima: ante un síntoma de performance que no se reproduce leyendo código, instrumentar con harness real (Playwright CPU profile, DPR2, vsync off) ANTES de prescribir, y descartar entorno (GPU/navegador) temprano preguntando "¿pasa en otro navegador?".

(sin retros previos — el proyecto recién fue dado de alta)

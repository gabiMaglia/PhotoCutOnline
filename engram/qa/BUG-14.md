# QA BUG-14 — intento 1 — RECHAZADO

Revisado: rama content/BUG-14-model-size (1e7c559) vs main, desde el worktree .claude/worktrees/agent-a527cf654bd4bc0fb.

## Plan
Nivel P-11 declarado: Advisory. nerv-gate (con --files, 7 archivos = diff) computa **S** (path sensible: public/en/author.html) y rechaza: PLAN_GATE_MISSING (falta engram/plans/BUG-14.md con §CÓMO estampado). El gate manda sobre la marca del ticket. Sin gate PASS no hay APROBADO.

## GAP
| Escenario | Etiqueta | Estado |
|---|---|---|
| FAQ + texto visible de como-funciona / en/how-it-works dicen ~120 MB (PC con GPU) / ~6 MB (celular, tablet, sin GPU) | Especificado | Implementado; JSON-LD parsea (Article+FAQPage OK ×2), mismo texto en FAQ y visible |
| llms.txt | Especificado | OK |
| «~7 MB» → «~6 MB» en toda página pública que describa el estado actual | Especificado | **Incompleto** (D2) |
| Novedades/changelog y «Lo probamos» intactos | Especificado | OK (solo quedan 3 «~7 MB» fechados en novedades/changelog/novidades y el bloque medido) |
| lastmod corrido | Especificado | OK (1e7c559) |
| autor.html ×3 cambian a «en computadoras / en celulares y tablets» | Deducido | Va al PO (ver §Observaciones) |

## Casos (1:1 vs Gherkin)
1. Páginas que explican la descarga: PARCIAL. Corregidas como-funciona, en/how-it-works, llms.txt. NO corregidas las 3 guías (D2).
2. Lo histórico no se reescribe: PASA.
3. Consistencia: `grep -rn "7 MB"` literal solo da históricos, pero el HTML usa `7&nbsp;MB`; con ese patrón quedan 3 hits de cuerpo (D2). JSON-LD = visible: PASA. lastmod: PASA.

Cifras vs scripts/pruebas.json: ~120 MB (118,4 MB medidos: 114,8 modelo + motor), ~6 MB (u2netp «unos 6 MB» en caveat): coinciden. «~115 MB» de autor.html = 114,8 del modelo solo, coherente.
Voseo ES: como-funciona sin tuteo nuevo. EN/PT: traducciones correctas («celulares e tablets» en PT de autor).
BUG-13: nada contradice (celular siempre u2netp; el texto dice «computadora con GPU» → BiRefNet; un laptop táctil ≥1366×768 es computadora, coherente).

## Defectos
**D1 [proceso, bloqueante]** nerv-gate computa nivel S (public/en/author.html, path sensible) y rechaza PLAN_GATE_MISSING: no existe engram/plans/BUG-14.md con §CÓMO «Aprobado por:». Declarado «Niv A» y el return no trae plan. Criterio: P-11/P-19.3.

**D2 [contenido, bloqueante]** Siguen diciendo «si no, u2netp (~7 MB)» en cuerpo de guía (no es «Lo probamos» ni histórico), y además «si no» ya es falso tras BUG-13 (celular con GPU baja u2netp):
- public/guias/como-quitar-el-fondo-de-una-imagen.html:268-269
- public/en/guides/how-to-remove-image-background.html:248-249
- public/pt/guias/como-remover-fundo-de-imagem.html:249-250
Violan el escenario 1 («cualquier página pública… ~6 MB») y el escenario 3 (grep «7 MB» solo histórico/Lo probamos). El return dice que el grep da solo novedades: el patrón literal no ve `7&nbsp;MB`. Revisar también FAQ/JSON-LD de esas guías (no tienen «7»). Nota: el backlog de BUG-13 dice «no tocar los textos de las guías (otro ticket)»; este es ese ticket y su criterio las incluye.

## Observaciones (no bloqueantes)
- autor.html ×3: el cambio no toca cifra, pero corrige la frase «cuando no» (condición de cuál modelo corre), que habría quedado falsa tras BUG-13. Es coherente con «páginas que explican la descarga»; se considera dentro de criterio por afirmación de ruteo, aunque sea un Deducido: el PO confirma. Es lo que dispara nivel S por path.
- src/lib/i18n.js ob.2.body* dicen ~7 MB en esta rama: lo cubre la rama BUG-13 (declarado).
- Cambios en HTML dejan líneas largas sin reflujo (legibilidad menor).

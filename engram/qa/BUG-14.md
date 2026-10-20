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

---

# QA BUG-14 — intento 2 — APROBADO

Revisado: content/BUG-14-model-size @ ae224bd vs main (BUG-13 ya mergeado). Nivel X (reintento #2), computado por nerv-gate.

## Plan / gate
`nerv-gate.sh --ticket BUG-14 --attempt 2 --level A` corrido por QA desde el worktree: PASS. Base main, files == diff (12), intento #2 derivado, nivel computado X (declarado A: WARN, QA revisa en X), plan §QUÉ+§CÓMO estampados para X, return P-1 con 4 campos. WARN: sin comando de test configurado, así que la prueba de rojo la hice a mano:
- `node --test scripts/` en la rama: 85/85 verde.
- `public/` de 80c104f (pre-fix) + test nuevo: `not ok 13 EN/PT dicen lo mismo que ES...` (15 pass / 1 fail). Con el fix: 16/16. El test discrimina.
- Jest no corrido (worktree sin node_modules); no hay diff en `src/`, así que no aplica regresión.

## GAP
| Escenario | Etiqueta | Estado |
|---|---|---|
| 3 guías: cuerpo con regla única (computadora+GPU → BiRefNet ~120 MB; celulares/tablets o sin GPU → u2netp ~6 MB) | Especificado (plan §QUÉ, D2) | Implementado ES/EN/PT |
| como-funciona / how-it-works: visible + FAQ + description JSON-LD | Especificado | OK, FAQ = visible |
| llms.txt | Especificado | OK |
| Históricos y «Lo probamos» intactos | Especificado | OK; el diff de public/ no toca tested/limit/byline |
| autor ×3 condición | Deducido, ya aceptado por el orquestador/arquitecto | OK |
| NOTICE de licencias | sin definición | no se toca (fuera de alcance del plan) |

## Casos
- G1 cifra (perl con \xa0/\x{202f}/entidades y grep con U+00A0/U+202F): solo `novedades.html:69`, `pt/novidades.html:69`, `en/changelog.html:69`. Esperado.
- G2 `u2netp|BiRefNet` (html+txt), cada hit: bylines y `<li>`/`.limit` de «Lo probamos» = mediciones, intactos; novedades/changelog:163 históricos; llms.txt:5, como-funciona (description, FAQ, lista), how-it-works (idem), 3 guías (cuerpo), autor ×3: todos nombran la clase de dispositivo o la dan por la cláusula u2netp «celulares y tablets o sin GPU». Sin «si no / otherwise / se não» huérfanos. llms.txt:5 condiciona BiRefNet «on the GPU via WebGPU when the browser supports it» pero lo cierra con «~120 MB on computers with a GPU», lo acepto.
- JSON-LD: JSON.parse OK en las 5 páginas con cambios de texto.
- (1) pruebas.test.mjs: `~7 MB` → `~6 MB` y se agrega `doesNotMatch(/~7 MB/)`; las demás aserciones no cambian. Más estricto, no débil. `~6 MB` no pasa trivialmente: falla contra el pre-fix.
- (2) Texto vs BUG-13: celular/tablet → u2netp siempre, computadora con GPU apta → BiRefNet. Coincide con la regla única del plan y con el veredicto APROBADO de BUG-13.
- (3) Merge a main: `src/lib/i18n.js` ya trae `ob.2.body*` ES/EN/PT con «~6 MB en el celular (~120 MB solo en computadoras con GPU)». Ninguna superficie de BUG-14 lo contradice; esta rama no toca src/.
- Fechas: scripts/lastmod.json commiteado con [lastmod-skip]. Voseo ES sin tuteo nuevo; PT «celulares e tablets».

## Defectos
Ninguno.

## Deuda (no bloqueante, ticket aparte si el PO quiere)
`public/licenses/ai-models-NOTICE.txt:9` y `:59` dicen «devices with / without WebGPU» sin clase de dispositivo. El plan lo declara fuera de alcance (no afirma cifra ni ruteo con peso).

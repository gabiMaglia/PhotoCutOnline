# QA BUG-12: editor mobile sin foto

Nivel P-11: **A (Advisory)**, computado por nerv-gate (270 líneas reviewables; declarado A, coincide).
Revisado: rama `fix/BUG-12-mobile-empty` en **fb13ad5** (el pedido decía 38e86a5; la rama avanzó con un 2º commit que implementa el escenario «header prolijo» agregado por el PO al Gherkin). Se auditó la cabeza de la rama (incluye 38e86a5).
Veredicto: **RECHAZADO**. Solo por un defecto de proceso (D1). Funcionalmente no hay defectos.

## §Plan
- Gate: `nerv-gate.sh --ticket BUG-12 ... --level A` -> REJECTED `HANDOFF_INCOMPLETE` (faltan 'status', 'files touched', 'risks', 'how to test'). Archivos declarados == diff; nivel computado A.
- `npm run test:web` sobre la rama (Chromium + WebKit) y sobre main (worktree limpio) para comparar.
- Prueba de rojo: `mobile-empty-test` copiado sobre main -> FAIL en la 1ª aserción («sin foto: la bandeja (.rail) no se muestra»). Verde en la rama (Chromium y WebKit, ALL_DONE, incluye las aserciones «header prolijo»).
- Escritorio 1280×800: volcado de rects (topbar, brand, actions, tabs, icons, body, rail, canvas-wrap, canvas-empty, h2, canvas-stage, tool) sin foto y con foto, main vs rama.
- Otras pestañas a 390×844: volcado de rects/overflow en Recorte, Editar, Lote, Icon Studio, Color Studio, Archivo, main vs rama.
- Rojo ajeno al ticket: webp-test/reencode-test/webp-retry-test [webkit] fallan con «module doesn't start with \0asm» **también en main** corrido desde worktree (artefacto del worktree con node_modules enlazado; el CI es la fuente de verdad). No atribuible a BUG-12.

## §GAP
| Comportamiento | Tipo | Nota |
|---|---|---|
| `.canvas-empty-hint` («arrastrá/pegá») oculto en móvil (`@media max-width:760px`) | Deducido | Fuera de pedido. Cubierto en espíritu por la decisión PO «sin foto: solo el CTA». Efecto colateral: también se oculta en las otras pestañas y en ventanas de escritorio angostas con mouse (donde arrastrar/pegar sí aplica) y el CTA se muestra ahí. **Al PO para validar**; no bloquea. |
| `.canvas-empty` stretch/flex en móvil afecta a todas las pestañas que lo usan | Deducido | Medido: mejora (en Editar/Icon/Color la zona vacía ya no se solapa con la bandeja: antes 133..492 vs bandeja desde 456; ahora 147..442). Sin overflow horizontal (docW 390). |
| Pestañas Editar / Icon Studio / Color Studio sin foto siguen mostrando la bandeja con herramientas desactivadas (el mismo «asfixia») | Deducido | El alcance excluye rediseñarlas; **debe reportarse con captura en el return handoff** (parte del D1). Ticket de deuda sugerido. |
| Segundo `<input type=file>` oculto en la zona vacía en escritorio | Deducido | `display:none` en escritorio: sin efecto de layout ni de foco. |
| Criterios sin implementación | — | Ninguno. |

## §Casos (1:1 vs Gherkin, medido a 390×844, Chromium y WebKit)
| Escenario | Estado | Evidencia |
|---|---|---|
| Sin foto: sin bandeja, zona llena el alto, sin recorte | Especificado, OK | `.rail` display none; wrap.bottom 844 = viewport; scrollHeight 693 <= 693; borde en 4 lados; zona 695 de 719 |
| CTA «Abrir foto» >= 44 px, abre el mismo selector | Especificado, OK | alto 52; mismo `accept`; el change del CTA carga la foto (cableado a `loader.onFileInput`, el mismo que la topbar). El selector nativo en sí no es automatizable. |
| Con foto: bandeja con aire | Especificado, OK | gap entre `.tool` 12 px (>=10); margen bajo el último control 41 px (>=12), padding inferior 28 px |
| Topbar con aire | Especificado, OK | ☕–ⓘ 10 px; acciones–pestañas 12 px; márgenes laterales 16 px (el commit 2 sube de 12 a 16) |
| Header prolijo (agregado por PO) | Especificado, OK | padding 12/16; 4 controles de 44 px; separaciones 10/10/10; sin `border-left`; zona vacía a 16 px de la topbar y lienzo a 30–31 px |
| Escritorio sin cambios | Especificado, OK (verificado por QA) | 30 líneas de rects idénticas main vs rama, sin foto y con foto; única diferencia: el CTA existe en el DOM con `display:none` |
| Textos nuevos ES/EN/PT | Especificado, OK | no hay textos nuevos: reutiliza `openPhoto` (ES/EN/PT existentes, i18n.js:21/477/933) |

### Puntos pedidos
1. **mobile-test.jsx**: solo se agregó la carga de una foto antes de medir la bandeja (sin foto la bandeja ahora está oculta) y una aserción nueva («foto cargada para medir»). No se eliminó ni se aflojó ninguna aserción; la de `column-reverse` se mantiene. Pasa. En mobile-empty-test el commit 2 sustituye «margen lateral >= 12 por control» por «>= 16 en brand/pestañas/acciones»: más estricto, sin pérdida de cobertura útil. Sin P-18.4/P-18.5.
2. **hint oculto**: ver §GAP (Deducido, al PO).
3. **Escritorio**: verificado, ver §Casos.
4. **Otras pestañas a 390**: sin overflow horizontal ni rotura; la topbar crece 119 -> 133 px en todas (esperado por el padding nuevo) y no se rompió ninguna. Ver §GAP para la deuda.

## §Defectos
**D1 [bloqueante de proceso, P-12/P-18] Falta el return handoff P-1 de nerv-web en `engram/05_handoff_log.md`.** El log solo trae la entrada Orquestador->nerv-web y Orquestador->nerv-qa; no hay entrada de retorno con status, files touched, risks y how to test. `nerv-gate.sh` rechaza con HANDOFF_INCOMPLETE (corrido sobre fb13ad5 y sobre 38e86a5), y sin gate PASS no hay veredicto de aprobación (P-18). Además, el return debe incluir las capturas 390×844 antes/después que pidió el handoff y el reporte con captura de las otras pestañas (Alcance del Gherkin).
Fix: registrar el return handoff con los 4 campos, declarar fb13ad5 (2º commit) y reenviar a QA; el gate debe dar PASS. No requiere cambio de código.

## Observaciones (no bloquean; deuda/atención)
- fb13ad5 modifica `engram/03_backlog.md` dentro de la rama de feature (Gherkin «header prolijo» + BUG-13): riesgo de conflicto al mergear con main. Resolver tomando la versión de main y re-aplicando el escenario nuevo.
- El gate declara los archivos del diff; con fb13ad5 hay 8 (incluye el backlog).
- QA mató por error procesos `vite dev` ajenos (BUG-13) mientras limpiaba puertos; el puerto del harness es fijo (5187), así que correr varias suites en paralelo da falsos resultados.

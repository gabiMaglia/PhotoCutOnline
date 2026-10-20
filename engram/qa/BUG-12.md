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


---

# Intento 2 (rama @ d7ee4d9, 2026-10-20)

Veredicto: **RECHAZADO**, solo por proceso (D1). Funcionalmente sin defectos.

## §Plan
- Gate: en el worktree de la rama (backlog sin veredictos) `nerv-gate` da PASS nivel A y los 4 campos P-1 presentes (D1 del intento 1 resuelto: returns de rondas 1 y 3 en 05_handoff_log.md). Con el backlog de main (1 RECHAZADO de QA) deriva intento #2 -> nivel **X** -> `LEVEL_UNDERSTATED` y falta §CÓMO/§QUÉ estampado en engram/plans/BUG-12.md (P-19.3). Gana el gate. Aviso: sin NERV_TEST_CMD el gate no verifica prueba de rojo; la hice a mano.
- `npm test`: 85/85. `npm run test:web` completo (puerto 5187 libre, sin pkill): mobile-test y mobile-empty-test OK en Chromium y WebKit; fallan webp-test/reencode-test/webp-retry-test [webkit] con «module doesn't start with \0asm» (el .wasm es válido; artefacto del worktree con node_modules enlazado; ya reportado en intento 1 como ajeno, el CI es la fuente de verdad).
- Emulación táctil real (script propio, vite en puerto 5391): Chromium y WebKit con `hasTouch:true, isMobile:true`, 390×844 x3.
- Rojo de la pista: inyecté el CSS viejo (hint oculto siempre) con mouse -> el test FALLA «visible=false con pointer fine». La aserción es discriminante.

## §GAP
| Comportamiento | Tipo | Nota |
|---|---|---|
| Pista arrastrar/pegar solo oculta con `pointer: coarse` | Especificado (escenario nuevo) | Cierra el GAP del intento 1. Medido: coarse=true -> oculta; fine a 390 px -> visible, en ambos motores |
| Idioma/☕/ⓘ círculo 44×44 radio 99px | Especificado | Los 3 miden 44×44 y radio 99px |
| Los 9 escenarios | Especificado | Sin criterio sin implementación, sin comportamiento sin definición nuevo |
| Cuenta con pointer híbrido (laptop táctil con mouse) | Deducido | `pointer` refleja el dispositivo primario; fuera de pedido, no bloquea |

## §Casos (nuevos del intento 2)
| Escenario | Estado | Evidencia |
|---|---|---|
| Controles del header con la misma forma | Especificado, OK | [{44,44,99px} x3] Chromium y WebKit, fine y coarse |
| Pista solo en táctil | Especificado, OK | Chromium touch: coarse/hover:none, hint oculto; WebKit touch idem; mouse 390: hint visible; 5 corridas x4 configuraciones: 20/20 OK |
| Los 7 anteriores | OK | siguen verdes en la corrida completa; la regla de pista se movió de `max-width:760` a `pointer: coarse` sin tocar el resto |

## §Defectos
**D1 [proceso, bloqueante] nivel computado X, sin plan estampado (P-11/P-19.3).** Reproducir: en la raíz del repo (backlog de main) `nerv-gate.sh --ticket BUG-12 ... --level A` -> con el veredicto del intento 1 deriva reintento #2 -> X -> LEVEL_UNDERSTATED + falta §CÓMO/§QUÉ en engram/plans/BUG-12.md. Fix sin código: el orquestador estampa el plan/§QUÉ o el PO dispensa explícitamente la regla de reintento para un ticket Advisory de solo CSS, y se re-gatea. Aviso: este rechazo cuenta como 2º RECHAZADO (el protocolo manda nerv-arquitecto tras 2 rechazos de QA): decide el orquestador si lo invoca o pide dispensa.

## Observaciones (no bloquean)
- Flaky aislado: una corrida en WebKit táctil falló «lienzo a >= 16 px de la topbar (7.2)» (primera carga en frío del vite); 20/20 corridas siguientes verdes y el layout asentado mide 28 px (stage 161 vs topbar 133). La aserción mide apenas aparece `.canvas-stage`, posiblemente antes de que se asiente el tamaño. Deuda: esperar un frame/estabilidad antes de medir.
- Ad slot cut-rail oculto sin foto en móvil y bandeja desactivada en Editar/Icon/Color: deuda ya anotada.

---
## Intento 3 — APROBADO (2026-10-20)
- Gate (worktree, `--files` = 8 archivos del diff, `--handoff` = bug12-handoff.md): **PASS**, nivel X computado (reintento #3), plan estampado, 4 campos P-1. WARN: sin NERV_TEST_CMD no verifica rojo (hecho a mano en intento 2).
- Código sin cambios desde d7ee4d9 (`git diff d7ee4d9 HEAD -- src test` vacío). `npm test` 85/85.
- §CÓMO vs commits: 38e86a5 (7 archivos), fb13ad5, d7ee4d9 coinciden con lo descrito; la reversión de engram/03_backlog.md aparece en d7ee4d9. §CÓMO y §QUÉ declaran escritura posterior al código (commits fa83f27/b08a2c6, 2026-10-20), sin fechas retroactivas.
- §GAP/§Casos: sin cambios respecto al intento 2 (9 escenarios Especificados; híbrido táctil+mouse Deducido, no bloquea).
- §Defectos: ninguno. Deuda vigente en _debt.md.

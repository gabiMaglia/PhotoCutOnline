# Architecture — photocut

## Stack
| Capa | Tech | Versión | ADR |
|------|------|---------|-----|
| Web frontend | React + Vite | React 18.3 / Vite 5.4 | — |
| Desktop shell | Tauri (Rust) | Tauri v2 | ADR-001 |
| Motor desktop | Rust crate `photocut-core` (GrabCut: GMM + Boykov–Kolmogorov maxflow) | — | — |
| Motor web | JS `jsEngine.js` (GrabCut-lite: k-means, trimap, feathering) | — | — |
| IA in-browser | ONNX vía `onnxruntime-web` | ^1.26 | ADR-002 |
| WASM (futuro) | `crates/photocut-wasm` (wasm-pack) | — | — |
| Tests | Jest (UI, jsdom) + Playwright/smoke (motor, Chrome) + `cargo test` (Rust) | — | — |
| Deploy web | Vercel (estático desde `dist/`) | — | — |

## DB (resumen vivo: tablas y relaciones clave)
N/A — sin backend ni base de datos. Procesamiento client-side / nativo offline.

## Índice ADRs
| # | Título | Estado | Fecha |
|---|--------|--------|-------|
| 001 | Desktop con Tauri v2 + Rust, mantenido por nerv-web (no PySide6) | Aceptado | 2026-06-27 |
| 002 | IA in-browser (ONNX), sin involucrar nerv-ai | Aceptado | 2026-06-27 |
| 003 | Rechazos solo de proceso no escalan el nivel P-11 a X; el gate lee los veredictos de la rama base | Propuesto (a promover a NERV) | 2026-10-20 |

---
## ADR-001: Desktop con Tauri v2, a cargo de nerv-web
- **Estado:** Aceptado
- **Contexto:** El proyecto distribuye desktop con Tauri v2 (Rust + WebView), no PySide6. El agente NERV `nerv-desktop` es Python/PySide6 y no aplica.
- **Decisión:** El trabajo desktop lo lleva `nerv-web` apoyado en la skill `tauri-v2`; mismo código React para web y desktop.
- **Descartado:** `nerv-desktop` (PySide6) — stack incompatible con el repo.
- **Consecuencias:** Un solo Tech Lead (web) cubre ambos targets; ojo con permisos/capabilities y comandos Rust de Tauri.

## ADR-002: IA in-browser (ONNX), sin nerv-ai
- **Estado:** Aceptado
- **Contexto:** Hay inferencia de un modelo que corre en el navegador vía `onnxruntime-web` (procesamiento de imágenes), no un feature LLM/multiagente.
- **Decisión:** Marcar `ai=none` en el registry; lo mantiene `nerv-web`. No se involucra `nerv-ai`.
- **Descartado:** `nerv-ai` — está pensado para LLM/RAG/agent loops, no para inferencia de visión client-side.
- **Consecuencias:** Si en el futuro se incorpora un LLM real, revisar esta decisión y dar de alta el stack ai.

## ADR-003: Rechazos solo de proceso no escalan a X; el gate lee los veredictos de la rama base
- **Estado:** Propuesto (nerv-arquitecto, 2026-10-20). El gate es de NERV: si el PO lo acepta, se promueve como ADR del framework en `~/Documents/NERV/engram/02_architecture.md` y recién ahí se cambia `nerv-gate.sh`. Hasta entonces no es vinculante y el gate no se toca.
- **Contexto:** BUG-12 (Advisory, solo CSS, 270 líneas) y BUG-13 (Strong) acumularon 2 RECHAZADO cada uno, todos solo de proceso y con cero defectos de código. `nerv-gate.sh:146-174` cuenta cualquier RECHAZADO como reintento y fija X (`[ "$ATTEMPT" -gt 1 ] && COMPUTED=X`).
  - En BUG-12, el primer rechazo lo causó el orquestador al no registrar un handoff. Eso subió un ticket A a X: §QUÉ + §CÓMO + revisión adversarial, y el 2º rechazo vino justamente de esa escalada. El costo de la regla no guarda relación con el riesgo del cambio.
  - ADR-009 (NERV) cubre el §QUÉ post-hoc, pero no el §CÓMO: a un Advisory en reintento se le exige un §CÓMO «previo» que ya no puede existir.
  - Hay además un fallo de fuente de verdad. El gate lee `engram/03_backlog.md` del checkout donde corre (la rama), y los veredictos se registran en main. Así, el mismo commit da A/PASS en la rama y X/REJECTED en main (QA BUG-12 intento 2). Un gate cuyo resultado depende de qué copia del backlog hay en disco no es determinista (P-12).
- **Decisión (propuesta):**
  1. El valor del veredicto es un enum cerrado: `APROBADO | RECHAZADO | RECHAZADO-PROCESO`. QA usa `RECHAZADO-PROCESO` solo si **todos** los defectos de `qa/<T>.md §Defectos` llevan la etiqueta `[proceso]` y la revisión de fondo quedó limpia. El gate falla cerrado ante un valor desconocido.
  2. Solo `RECHAZADO` escala a X por reintento. `RECHAZADO-PROCESO` incrementa el nº de intento (traza) y cuenta para el tope de P-2, pero no sube el nivel: el ticket sigue en el nivel que computa su diff, con su compuerta de plan propia.
  3. El gate deriva el intento de `git show <BASE_REF>:engram/03_backlog.md`, con el veredicto registrado en la rama base, y no del archivo en disco.
- **Descartado:** dispensa manual del PO por ticket. Contradice ADR-008 (sin exención de sección), no es determinista y convierte cada rechazo de proceso en una consulta al PO. También se descartó dejarlo como está y cubrir el caso con §QUÉ post-hoc (ADR-009): eso paga una revisión adversarial y un §CÓMO post-hoc, que ningún ADR define, por un fallo de bitácora.
- **Consecuencias:**
  - Un rechazo de proceso cuesta lo que cuesta arreglar el proceso.
  - Riesgo nuevo: que QA etiquete como «proceso» un defecto de fondo para no escalar. Mitigación: la etiqueta es auditable en `qa/<T>.md`, y un `PLAN_GATE_MISSING` de un ticket S/X no se rebaja porque la compuerta de plan del nivel computado por el diff sigue aplicando.
  - Requiere cambios en `nerv-gate.sh` (enum, `git show`) y en la regresión `nerv-evals/regression/07-review-level.sh`, para que cubra `RECHAZADO-PROCESO` ⇒ sin X, `RECHAZADO` ⇒ X, valor desconocido ⇒ fail closed, y backlog de la rama ≠ backlog base.


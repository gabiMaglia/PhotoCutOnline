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

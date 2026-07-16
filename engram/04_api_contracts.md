# API Contracts — photocut

## Convenciones
N/A — el proyecto no expone una API HTTP. El procesamiento es client-side (web) o
nativo offline (desktop). El "contrato" relevante es la frontera React ↔ motor:
`src/lib/backend.js` decide en runtime entre comandos Tauri (Rust) y `jsEngine.js` (JS).

## Índice
| Método | Ruta | Estado | Últ. cambio |
|--------|------|--------|-------------|
| — | (sin endpoints HTTP) | — | — |

---
## Frontera interna React ↔ motor (referencia, no HTTP)
- **Punto de decisión:** `src/lib/backend.js` detecta Tauri; si está, invoca comandos Rust (`#[tauri::command]` en `src-tauri/`), si no, corre `jsEngine.js`.
- **Notas:** documentar acá los comandos Tauri expuestos cuando se trabaje sobre ellos.

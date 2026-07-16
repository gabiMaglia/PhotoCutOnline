# Requirements — photocut

## 1. Visión (1 frase)
Herramienta de remoción de fondo de fotos: un solo código React que se distribuye como app web (motor JS in-browser) y app desktop (Tauri + motor GrabCut en Rust, offline).

## 2. Funcionalidades (IN)
| ID | Funcionalidad | MoSCoW | Estado |
|----|---------------|--------|--------|
| F-01 | Cutout workspace (box select, auto cut, brushes keep/remove, feather, undo, shortcuts) | Must | Implementado |
| F-02 | Export (PNG transparente, WebP/JPEG, fondo color/imagen, copiar a clipboard) | Must | Implementado |
| F-03 | Icon Studio (sets iOS/Android/macOS/Windows .ico/favicons/PWA, ZIP in-browser) | Must | Implementado |
| F-04 | Motor desktop GrabCut en Rust (photocut-core) | Must | Implementado |
| F-05 | Motor web GrabCut-lite (jsEngine.js, client-side) | Must | Implementado |
| F-06 | make_icons.py (CLI Python con Pillow, mismo pipeline de íconos) | Should | Implementado |
| F-07 | Sticker Studio | Could | Oculto tras feature flag |
| F-08 | WASM: compilar photocut-core a WebAssembly para paridad web↔desktop | Could | Scaffold (crates/photocut-wasm, build:wasm) |

## 3. Fuera de alcance (OUT)
- Backend/servidor (procesamiento 100% client-side o nativo offline).
- Cuentas/licenciamiento/activación (dejado al PO, no implementado).
- Edición avanzada tipo editor de imágenes general.

## 4. Reglas de negocio
| ID | Regla | Origen/fecha |
|----|-------|--------------|
| R-01 | Código de aplicación es PROPRIETARY; deps solo MIT/Apache-2.0 (sin copyleft) | README / package.json |
| R-02 | Mismo UI React para web y desktop; el único punto de decisión es src/lib/backend.js (detecta Tauri en runtime) | README §Architecture |
| R-03 | Monetización: ads por tráfico (web) + donaciones (Ko-fi); modelo funnel web gratis → desktop pago | MEMORY.md / 2026-06 |

## 5. Enlaces (espejo del registry: tracker, board, Figma)
- Git remoto: https://github.com/gabiMaglia/PhotoCutOnline.git
- Tracker: ninguno · Board: — · Figma: — (pendiente, ver §6)
- Deploy: Vercel (web). Donaciones: Ko-fi.

## 6. Preguntas abiertas al PO
| # | Pregunta | De | Respuesta | Fecha |
|---|----------|----|-----------|-------|
| 1 | ¿Hay diseño en Figma (u otra herramienta) para enlazar, o se trabaja sin diseño formal? | Orquestador | — | 2026-06-27 |

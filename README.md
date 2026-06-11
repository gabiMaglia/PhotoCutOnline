# PhotoCut Studio

Interactive background-removal tool. One React codebase ships as:

- a **desktop app** (Tauri + Rust) — full-quality GrabCut engine running natively, offline; and
- a **web app** (plain browser) — same UI, with its own GrabCut-lite segmenter
  (k-means color models, hard-constraint trimap, component cleanup, alpha
  feathering) running fully client-side.

## Features

- **Cutout workspace** — box select, one-click auto cut (border background
  modeling), keep/remove brushes with live ghost cursor, marching-ants
  selection, edge feathering, undo, keyboard shortcuts (`A` `1` `2` `3`
  `[` `]` `E` `⌘Z`), drag & drop and clipboard paste.
- **Export** — transparent PNG, WebP/JPEG, solid color or image background,
  copy straight to the clipboard.
- **Icon Studio** — turns the cutout (or any PNG) into complete app icon sets:
  iOS `AppIcon.appiconset` (+ legacy sizes), Android mipmaps + adaptive +
  Play Store, macOS `AppIcon.iconset`, a real multi-resolution Windows `.ico`,
  favicons + PWA manifest + maskable icon — all zipped in the browser with
  zero dependencies (own ZIP/ICO writers in `src/lib/zip.js` / `icons.js`).
- **`make_icons.py`** — the same icon pipeline as a Python CLI
  (`public/make_icons.py`, Pillow only; auto-`.icns` via `iconutil` on macOS):

  ```bash
  pip install pillow
  python make_icons.py logo.png -o app-icons --padding 0.08 --name "Mi App"
  ```

This is an original implementation. It is **not** affiliated with, derived from, or
a copy of any existing product. The cutout engine (`photocut-core`) is written from
scratch.

## Architecture

```
photocut/
├─ crates/photocut-core/   Rust GrabCut engine (MIT OR Apache-2.0 deps only)
│   ├─ src/gmm.rs          Gaussian mixture color models
│   ├─ src/maxflow.rs      Boykov–Kolmogorov min-cut (from scratch)
│   ├─ src/grabcut.rs      Iterated graph-cut orchestration
│   └─ src/lib.rs          Public API + compositing + tests
├─ src-tauri/              Tauri desktop shell (Rust backend, commands)
├─ src/                    React frontend
│   ├─ App.jsx             Toolbar, modes, export
│   ├─ components/CanvasEditor.jsx
│   └─ lib/
│       ├─ backend.js      Routes to Tauri (desktop) OR JS engine (web)
│       └─ jsEngine.js     Browser-only fallback segmenter
└─ ...
```

The single decision point is `src/lib/backend.js`: it detects Tauri at runtime
and calls the Rust commands when present, otherwise runs in-browser. The React UI
never changes between the two products.

## Prerequisites

- Node.js 18+
- Rust (stable) + Cargo — https://rustup.rs
- Tauri v2 system deps — https://tauri.app/start/prerequisites/
  (on Linux: webkit2gtk, on macOS: Xcode CLT, on Windows: WebView2 + MSVC)

## Run

Web (no Rust needed):

```bash
npm install
npm run dev          # http://localhost:5173
```

Desktop (Rust required):

```bash
npm install
npm run tauri dev
```

## Build for distribution

Web bundle:

```bash
npm run build        # outputs static site to dist/ — host anywhere
```

Desktop installers (.dmg / .msi / .deb / .AppImage):

```bash
npm run tauri build  # outputs to src-tauri/target/release/bundle/
```

## Test the engines

Rust (desktop):

```bash
cargo test -p photocut-core
```

Web (smoke tests in your installed Chrome, headless — segmentation accuracy,
worker RPC, compositing, icon ZIP, preview panel, 12MP perf benchmark):

```bash
npm run test:web
```

(Each suite is also a plain page under `test/*.html` if you want to watch it
run: `npm run dev` and open them.)

## Workflow in the app

1. **Open photo.**
2. **Box select (1):** drag a rectangle around your subject. The engine runs
   GrabCut and shows the cutout over a checkerboard.
3. **Keep brush (2) / Remove brush (3):** paint to correct any edges the cut
   missed. Each stroke re-runs a quick refinement.
4. **Export:** transparent PNG, a solid color background, or composite over
   another image.

## Selling this

You can sell both products. Notes:

- **Tauri** is MIT/Apache-2.0 and explicitly permits closed-source, commercial
  apps. No royalty, no source-disclosure obligation.
- **`photocut-core` dependencies** are all permissive (MIT / Apache-2.0):
  `image`, `nalgebra`, `thiserror`. No GPL/LGPL/copyleft anywhere in the tree.
  Run `cargo tree` and `cargo deny` (recommended) before each release to confirm
  no copyleft dependency sneaks in via an update.
- **GrabCut** is a published academic algorithm; implementing it yourself (as here)
  carries no license burden. Do not pull in OpenCV's GPL-ish modules — not needed.
- Your **frontend** `package.json` is marked `PROPRIETARY`; set your real company
  name and copyright in `src-tauri/tauri.conf.json` (`copyright`, `identifier`,
  `productName`).
- For paid desktop distribution you'll want **code signing** (Apple Developer ID
  for macOS notarization; an Authenticode cert for Windows) — configure under
  `bundle.macOS` / `bundle.windows` in `tauri.conf.json`. Tauri also has a built-in
  **updater** plugin for shipping updates to paying customers.
- A common model: free/limited web version for funnel, paid desktop version
  (one-time or subscription) with batch export, higher resolution, and the
  full-quality Rust engine. Licensing/activation is app-level logic you add; this
  scaffold leaves that to you.

## Upgrading the web engine (optional)

The browser fallback in `jsEngine.js` is intentionally simple. For parity with
desktop, compile `photocut-core` to WebAssembly (add a `wasm-bindgen` wrapper crate
and load it from `backend.js`). Then both products share the exact same engine.

## License

Your application code: proprietary (yours to license/sell).
Bundled open-source dependencies retain their MIT/Apache-2.0 licenses; include
their notices in an "Acknowledgements" / "Third-party licenses" screen
(`cargo about generate` can produce this automatically).

// Capa de abstracción de backend.
//
// En escritorio (Tauri) el trabajo pesado corre en Rust vía `invoke`.
// En navegador usamos CutoutSession (./jsEngine.js). La misma UI React se
// distribuye como ambos productos.
//
// `backend.features` indica qué hay disponible en el entorno actual para que
// la UI oculte lo que no aplica (auto/undo/feather/webp son web-only hasta que
// el motor Rust los implemente).

import { CutoutSession, loadHtmlImage } from "./jsEngine.js";

function hasTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let invoke = null;
async function getInvoke() {
  if (invoke) return invoke;
  const mod = await import("@tauri-apps/api/core");
  invoke = mod.invoke;
  return invoke;
}

const session = new CutoutSession();
const IS_DESKTOP = hasTauri();

export const backend = {
  isDesktop: IS_DESKTOP,

  features: {
    auto: !IS_DESKTOP,
    undo: !IS_DESKTOP,
    feather: !IS_DESKTOP,
    formats: !IS_DESKTOP,
    clipboard: typeof navigator !== "undefined" && !!navigator.clipboard?.write,
  },

  async loadImage(dataUrl) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("load_image", { dataUrl });
    }
    const img = await loadHtmlImage(dataUrl);
    const { width, height } = img;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    session.load(ctx.getImageData(0, 0, width, height));
    return { width, height };
  },

  async cutRect(rect, iters) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("cut_rect", { rect, iters });
    }
    return session.cutRect(rect);
  },

  async autoCut() {
    if (IS_DESKTOP) throw new Error("Auto no disponible en escritorio todavía");
    return session.autoCut();
  },

  /** stroke: {points:[{x,y}…], radius, foreground} */
  async refine(stroke, iters) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      // El comando Rust espera listas de píxeles [x,y]; expandimos los discos.
      const strokes = [expandStrokeToPixels(stroke)];
      return inv("refine", { strokes, iters });
    }
    return session.addStroke(stroke);
  },

  canUndo() {
    return !IS_DESKTOP && session.canUndo;
  },

  async undo() {
    if (IS_DESKTOP) return null;
    return session.undo();
  },

  async setFeather(px) {
    if (IS_DESKTOP) return null;
    session.setFeather(px);
    return session.hasCut ? session.previewUrl() : null;
  },

  async exportTransparent(opts = {}) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("export_transparent", {});
    }
    return session.composite({ type: "transparent", ...opts });
  },

  async exportSolid(color, opts = {}) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("export_solid", { color });
    }
    return session.composite({ type: "solid", color, ...opts });
  },

  async exportImageBg(bgDataUrl, opts = {}) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("export_image_bg", { bgDataUrl });
    }
    return session.composite({ type: "image", bgDataUrl, ...opts });
  },
};

function expandStrokeToPixels(stroke) {
  const r = Math.max(1, Math.round((stroke.radius || 12) / 2));
  const seen = new Set();
  const points = [];
  for (const p of stroke.points) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.round(p.x + dx);
        const y = Math.round(p.y + dy);
        const key = y * 100000 + x;
        if (x >= 0 && y >= 0 && !seen.has(key)) {
          seen.add(key);
          points.push([x, y]);
        }
      }
    }
  }
  return { points, foreground: stroke.foreground };
}

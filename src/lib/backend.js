// Capa de abstracción de backend.
//
// En escritorio (Tauri) el trabajo pesado corre en Rust vía `invoke`.
// En navegador, el motor (CutoutSession) corre dentro de un Web Worker para
// no congelar la UI; si el navegador no soporta OffscreenCanvas (Safari
// < 16.4) cae a ejecutarlo inline en el hilo principal con la misma API.
//
// Los previews del motor llegan como Blob y aquí se convierten a object URLs
// (revocando el anterior para no fugar memoria). `backend.features` indica
// qué hay disponible para que la UI oculte lo que no aplica.

import { CutoutSession } from "./jsEngine.js";

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

const IS_DESKTOP = hasTauri();
const WORKER_OK =
  typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";

// ---- transporte: worker RPC o sesión inline (mismo contrato async) ----

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./cutoutWorker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e) => {
    const { id, ok, result, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(result);
    else p.reject(new Error(error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "worker error"));
    pending.clear();
  };
  return worker;
}

function callWorker(cmd, args) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, cmd, args });
  });
}

const inlineSession = WORKER_OK || IS_DESKTOP ? null : new CutoutSession();

async function callInline(cmd, args = {}) {
  const s = inlineSession;
  switch (cmd) {
    case "load": {
      // intentar WASM también en el camino inline (no requiere OffscreenCanvas)
      if (!s.WasmCut && !s.wasmTried) {
        s.wasmTried = true;
        try {
          const mod = await import("./wasm/photocut_wasm.js");
          await mod.default();
          s.attachWasm(mod.WasmCut);
        } catch (e) {
          console.warn("photocut-wasm no disponible; motor JS:", e);
        }
      }
      const bmp = await createImageBitmap(await (await fetch(args.dataUrl)).blob());
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(bmp, 0, 0);
      s.load(ctx.getImageData(0, 0, bmp.width, bmp.height));
      return { width: bmp.width, height: bmp.height, engine: s.engineName };
    }
    case "cutRect":
      return s.cutRect(args.rect);
    case "autoCut":
      return s.autoCut();
    case "warmupAi": {
      const mod = await import("./aiSegmenter.js");
      return mod.warmupAi();
    }
    case "aiCut": {
      const mod = await import("./aiSegmenter.js");
      const matte = await mod.aiMatte(s.work);
      return s.aiCutFromMatte(matte);
    }
    case "removeBg": {
      const mod = await import("./aiSegmenter.js");
      const eng = await import("./jsEngine.js");
      const img = new ImageData(
        new Uint8ClampedArray(args.rgba),
        args.width,
        args.height
      );
      const matte = await mod.aiMatte(img);
      return eng.refineMatte(matte, args.width, args.height);
    }
    case "addStroke":
      return s.addStroke(args.stroke);
    case "undo":
      return s.undo();
    case "redo":
      return s.redo();
    case "setFeather":
      s.setFeather(args.px);
      return s.hasCut ? s.previewBlob() : null;
    case "setFinish":
      s.setFinish(args.finish);
      return s.hasCut ? s.previewBlob() : null;
    case "composite":
      return s.composite(args.opts);
    default:
      throw new Error(`comando desconocido: ${cmd}`);
  }
}

const call = WORKER_OK ? callWorker : callInline;

// ---- gestión de object URLs ----

let lastPreviewUrl = null;

function previewUrlFrom(blob) {
  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }
  if (!blob) return null;
  lastPreviewUrl = URL.createObjectURL(blob);
  return lastPreviewUrl;
}

function exportUrlFrom(blob) {
  const url = URL.createObjectURL(blob);
  // margen amplio para que descarga/portapapeles/IconStudio lo consuman
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

// El historial vive en el motor (cap 15); estos contadores lo reflejan en el
// hilo principal para que `canUndo`/`canRedo` sean síncronos para la UI.
let undoDepth = 0;
let redoDepth = 0;

function afterOp() {
  undoDepth = Math.min(undoDepth + 1, 15);
  redoDepth = 0;
}

// ---- API pública ----

export const backend = {
  isDesktop: IS_DESKTOP,

  features: {
    auto: !IS_DESKTOP,
    ai: !IS_DESKTOP, // u2netp local vía onnxruntime-web (worker)
    undo: !IS_DESKTOP,
    feather: !IS_DESKTOP,
    finish: !IS_DESKTOP, // sticker/sombra/presets: motor web
    formats: !IS_DESKTOP,
    clipboard: typeof navigator !== "undefined" && !!navigator.clipboard?.write,
  },

  async loadImage(dataUrl) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("load_image", { dataUrl });
    }
    undoDepth = 0;
    redoDepth = 0;
    previewUrlFrom(null);
    return call("load", { dataUrl });
  },

  async cutRect(rect, iters) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("cut_rect", { rect, iters });
    }
    const blob = await call("cutRect", { rect });
    afterOp();
    return previewUrlFrom(blob);
  },

  async autoCut() {
    if (IS_DESKTOP) throw new Error("Auto no disponible en escritorio todavía");
    const blob = await call("autoCut");
    afterOp();
    return previewUrlFrom(blob);
  },

  /** Pre-carga el modelo IA (primera vez: ~18MB runtime+modelo, luego caché). */
  async warmupAi() {
    if (IS_DESKTOP) return false;
    return call("warmupAi");
  },

  async aiCut() {
    if (IS_DESKTOP) throw new Error("IA no disponible en escritorio todavía");
    const blob = await call("aiCut");
    afterOp();
    return previewUrlFrom(blob);
  },

  /** Matte IA para una imagen arbitraria (no toca la sesión del editor). */
  async removeBg(imageData) {
    if (IS_DESKTOP) throw new Error("IA no disponible en escritorio todavía");
    return call("removeBg", {
      width: imageData.width,
      height: imageData.height,
      rgba: imageData.data,
    });
  },

  /** stroke: {points:[{x,y}…], radius, foreground} */
  async refine(stroke, iters) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      // El comando Rust espera listas de píxeles [x,y]; expandimos los discos.
      const strokes = [expandStrokeToPixels(stroke)];
      return inv("refine", { strokes, iters });
    }
    const blob = await call("addStroke", { stroke });
    afterOp();
    return previewUrlFrom(blob);
  },

  canUndo() {
    return !IS_DESKTOP && undoDepth > 0;
  },

  canRedo() {
    return !IS_DESKTOP && redoDepth > 0;
  },

  async undo() {
    if (IS_DESKTOP) return null;
    const blob = await call("undo");
    undoDepth = Math.max(0, undoDepth - 1);
    redoDepth = Math.min(redoDepth + 1, 15);
    return previewUrlFrom(blob);
  },

  async redo() {
    if (IS_DESKTOP) return null;
    const blob = await call("redo");
    redoDepth = Math.max(0, redoDepth - 1);
    undoDepth = Math.min(undoDepth + 1, 15);
    return previewUrlFrom(blob);
  },

  async setFeather(px) {
    if (IS_DESKTOP) return null;
    const blob = await call("setFeather", { px });
    return blob ? previewUrlFrom(blob) : null;
  },

  async setFinish(finish) {
    if (IS_DESKTOP) return null;
    const blob = await call("setFinish", { finish });
    return blob ? previewUrlFrom(blob) : null;
  },

  async exportTransparent(opts = {}) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("export_transparent", {});
    }
    return exportUrlFrom(await call("composite", { opts: { type: "transparent", ...opts } }));
  },

  async exportSolid(color, opts = {}) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("export_solid", { color });
    }
    return exportUrlFrom(
      await call("composite", { opts: { type: "solid", color, ...opts } })
    );
  },

  async exportImageBg(bgDataUrl, opts = {}) {
    if (IS_DESKTOP) {
      const inv = await getInvoke();
      return inv("export_image_bg", { bgDataUrl });
    }
    return exportUrlFrom(
      await call("composite", { opts: { type: "image", bgDataUrl, ...opts } })
    );
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

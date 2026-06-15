// Capa de abstracción de backend.
//
// El motor (CutoutSession) corre dentro de un Web Worker para no congelar la
// UI; si el entorno no soporta OffscreenCanvas (Safari < 16.4, WKWebView viejo)
// cae a ejecutarlo inline en el hilo principal con la misma API. El mismo motor
// se usa en navegador y en escritorio (Tauri): el desktop es la app web dentro
// de un shell nativo. Lo único propio del desktop es el guardado nativo (ver
// utils/save.js) — por eso `isDesktop` se sigue exponiendo.
//
// Los previews del motor llegan como Blob y aquí se convierten a object URLs
// (revocando el anterior para no fugar memoria). `backend.features` indica
// qué hay disponible para que la UI oculte lo que no aplica.

import { CutoutSession } from "./jsEngine.js";

function hasTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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

const inlineSession = WORKER_OK ? null : new CutoutSession();

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
    case "wand":
      return s.wandSelect(args.seed, args.tolerance, args.additive);
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
    auto: true,
    ai: true, // u2netp local vía onnxruntime-web (worker)
    wand: true, // varita por color (flood-fill)
    undo: true,
    feather: true,
    finish: true, // sticker/sombra/presets: motor web
    formats: true,
    clipboard: typeof navigator !== "undefined" && !!navigator.clipboard?.write,
  },

  async loadImage(dataUrl) {
    undoDepth = 0;
    redoDepth = 0;
    previewUrlFrom(null);
    return call("load", { dataUrl });
  },

  async cutRect(rect) {
    const blob = await call("cutRect", { rect });
    afterOp();
    return previewUrlFrom(blob);
  },

  async autoCut() {
    const blob = await call("autoCut");
    afterOp();
    return previewUrlFrom(blob);
  },

  /** Pre-carga el modelo IA (primera vez: ~18MB runtime+modelo, luego caché). */
  async warmupAi() {
    return call("warmupAi");
  },

  async aiCut() {
    const blob = await call("aiCut");
    afterOp();
    return previewUrlFrom(blob);
  },

  /** Matte IA para una imagen arbitraria (no toca la sesión del editor). */
  async removeBg(imageData) {
    return call("removeBg", {
      width: imageData.width,
      height: imageData.height,
      rgba: imageData.data,
    });
  },

  /** stroke: {points:[{x,y}…], radius, foreground} */
  async refine(stroke) {
    const blob = await call("addStroke", { stroke });
    afterOp();
    return previewUrlFrom(blob);
  },

  /** Varita por color: flood-fill desde un punto. seed:{x,y} en coords completas. */
  async wand(seed, tolerance, additive) {
    const blob = await call("wand", { seed, tolerance, additive });
    afterOp();
    return previewUrlFrom(blob);
  },

  canUndo() {
    return undoDepth > 0;
  },

  canRedo() {
    return redoDepth > 0;
  },

  async undo() {
    const blob = await call("undo");
    undoDepth = Math.max(0, undoDepth - 1);
    redoDepth = Math.min(redoDepth + 1, 15);
    return previewUrlFrom(blob);
  },

  async redo() {
    const blob = await call("redo");
    redoDepth = Math.max(0, redoDepth - 1);
    undoDepth = Math.min(undoDepth + 1, 15);
    return previewUrlFrom(blob);
  },

  async setFeather(px) {
    const blob = await call("setFeather", { px });
    return blob ? previewUrlFrom(blob) : null;
  },

  async setFinish(finish) {
    const blob = await call("setFinish", { finish });
    return blob ? previewUrlFrom(blob) : null;
  },

  async exportTransparent(opts = {}) {
    return exportUrlFrom(await call("composite", { opts: { type: "transparent", ...opts } }));
  },

  async exportSolid(color, opts = {}) {
    return exportUrlFrom(
      await call("composite", { opts: { type: "solid", color, ...opts } })
    );
  },

  async exportImageBg(bgDataUrl, opts = {}) {
    return exportUrlFrom(
      await call("composite", { opts: { type: "image", bgDataUrl, ...opts } })
    );
  },
};

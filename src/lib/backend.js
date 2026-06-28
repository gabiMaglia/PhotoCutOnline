// Capa de abstracción de backend.
//
// El motor (CutoutSession) corre dentro de un Web Worker para no congelar la
// UI; si el entorno no soporta OffscreenCanvas (Safari < 16.4, WKWebView viejo)
// cae a ejecutarlo inline en el hilo principal con la misma API. El mismo motor
// se usa en navegador y en escritorio (Tauri): el desktop es la app web dentro
// de un shell nativo. Lo único propio del desktop es el guardado nativo (ver
// utils/save.js) — por eso `isDesktop` se sigue exponiendo.
//
// Los previews del motor llegan como { blob, bitmap }: `blob` se convierte a
// object URL aquí (revocando el anterior para no fugar memoria) para los
// consumidores que necesitan una URL real (<img> de PreviewPanel/CutGhost);
// `bitmap` es un ImageBitmap (T-002b) que se expone tal cual para que
// CanvasEditor lo pinte sin decodificar PNG en el hilo principal (closeado
// en cada reemplazo, igual criterio que la object URL). Ambos caminos
// (worker y el fallback inline para Safari < 16.4 sin OffscreenCanvas)
// producen el mismo { blob, bitmap } — la única diferencia es que en el
// worker el bitmap llega TRANSFERIDO por postMessage (sin copia, ver
// cutoutWorker.js), mientras que en el camino inline ya nace en el hilo
// principal y no hace falta transferencia alguna.
// `backend.features` indica qué hay disponible para que la UI oculte lo que
// no aplica.

import { CutoutSession, UNDO_CAP } from "./jsEngine.js";

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

// Mismo criterio de liberación de IA que el worker (T-002a/A1), para el
// camino inline (Safari < 16.4 sin OffscreenCanvas): sin worker, el runtime
// ONNX residente vive en el hilo principal, así que pesa todavía más.
//
// D1 (QA, CRÍTICO, paridad R-02): igual que en cutoutWorker.js, el timer se
// arma al TERMINAR la operación de IA, no al iniciarla — armarlo al inicio
// dispararía releaseAi() sobre una sesión todavía en uso si la inferencia
// tarda más que AI_IDLE_MS.
const AI_IDLE_MS = 30_000;
let aiIdleTimer = null;

function scheduleAiRelease() {
  clearTimeout(aiIdleTimer);
  aiIdleTimer = setTimeout(async () => {
    const mod = await import("./aiSegmenter.js");
    mod.releaseAi();
  }, AI_IDLE_MS);
}

/** Envuelve una operación de IA: reprograma el idle-release al TERMINAR (ok o error). */
async function withAiIdleRelease(fn) {
  try {
    return await fn();
  } finally {
    scheduleAiRelease();
  }
}

/** Mismo empaquetado { blob, bitmap } que el worker, para el camino inline. */
async function packPreviewInline(s) {
  if (!s.hasCut) return null;
  const [blob, bitmap] = await Promise.all([s.previewBlob(), s.previewBitmap()]);
  return { blob, bitmap };
}

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
      await s.cutRect(args.rect);
      return packPreviewInline(s);
    case "autoCut":
      await s.autoCut();
      return packPreviewInline(s);
    case "warmupAi":
      return withAiIdleRelease(async () => {
        const mod = await import("./aiSegmenter.js");
        return mod.warmupAi();
      });
    case "aiCut":
      return withAiIdleRelease(async () => {
        const mod = await import("./aiSegmenter.js");
        const matte = await mod.aiMatte(s.work);
        await s.aiCutFromMatte(matte);
        return packPreviewInline(s);
      });
    case "removeBg":
      return withAiIdleRelease(async () => {
        const mod = await import("./aiSegmenter.js");
        const eng = await import("./jsEngine.js");
        const img = new ImageData(
          new Uint8ClampedArray(args.rgba),
          args.width,
          args.height
        );
        const matte = await mod.aiMatte(img);
        return eng.refineMatte(matte, args.width, args.height);
      });
    case "addStroke":
      await s.addStroke(args.stroke);
      return packPreviewInline(s);
    case "wand":
      await s.wandSelect(args.seed, args.tolerance, args.additive);
      return packPreviewInline(s);
    case "undo":
      await s.undo();
      return packPreviewInline(s);
    case "redo":
      await s.redo();
      return packPreviewInline(s);
    case "setFeather":
      s.setFeather(args.px);
      return packPreviewInline(s);
    case "setFinish":
      s.setFinish(args.finish);
      return packPreviewInline(s);
    case "composite":
      return s.composite(args.opts);
    default:
      throw new Error(`comando desconocido: ${cmd}`);
  }
}

const call = WORKER_OK ? callWorker : callInline;

// ---- gestión de object URLs + bitmap del preview ----

let lastPreviewUrl = null;
let lastPreviewBitmap = null;

/**
 * pack: { blob, bitmap } | null, como lo devuelven los handlers del worker
 * (o del camino inline). Revoca la URL y cierra el bitmap anteriores (mismo
 * criterio, T-002b): un ImageBitmap sin close() retiene su buffer hasta el
 * próximo GC, justo la presión de memoria que esto busca evitar. Devuelve la
 * URL (string|null) — el bitmap se consulta aparte vía `lastPreviewBitmap()`.
 */
function previewUrlFrom(pack) {
  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }
  if (lastPreviewBitmap) {
    lastPreviewBitmap.close();
    lastPreviewBitmap = null;
  }
  if (!pack) return null;
  lastPreviewUrl = URL.createObjectURL(pack.blob);
  lastPreviewBitmap = pack.bitmap ?? null;
  return lastPreviewUrl;
}

function exportUrlFrom(blob) {
  const url = URL.createObjectURL(blob);
  // margen amplio para que descarga/portapapeles/IconStudio lo consuman
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

// El historial vive en el motor (cap UNDO_CAP); estos contadores lo reflejan
// en el hilo principal para que `canUndo`/`canRedo` sean síncronos para la UI.
let undoDepth = 0;
let redoDepth = 0;

function afterOp() {
  undoDepth = Math.min(undoDepth + 1, UNDO_CAP);
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
    const pack = await call("cutRect", { rect });
    afterOp();
    return previewUrlFrom(pack);
  },

  async autoCut() {
    const pack = await call("autoCut");
    afterOp();
    return previewUrlFrom(pack);
  },

  /** Pre-carga el modelo IA (primera vez: ~18MB runtime+modelo, luego caché). */
  async warmupAi() {
    return call("warmupAi");
  },

  async aiCut() {
    const pack = await call("aiCut");
    afterOp();
    return previewUrlFrom(pack);
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
    const pack = await call("addStroke", { stroke });
    afterOp();
    return previewUrlFrom(pack);
  },

  /** Varita por color: flood-fill desde un punto. seed:{x,y} en coords completas. */
  async wand(seed, tolerance, additive) {
    const pack = await call("wand", { seed, tolerance, additive });
    afterOp();
    return previewUrlFrom(pack);
  },

  canUndo() {
    return undoDepth > 0;
  },

  canRedo() {
    return redoDepth > 0;
  },

  async undo() {
    const pack = await call("undo");
    undoDepth = Math.max(0, undoDepth - 1);
    redoDepth = Math.min(redoDepth + 1, UNDO_CAP);
    return previewUrlFrom(pack);
  },

  async redo() {
    const pack = await call("redo");
    redoDepth = Math.max(0, redoDepth - 1);
    undoDepth = Math.min(undoDepth + 1, UNDO_CAP);
    return previewUrlFrom(pack);
  },

  async setFeather(px) {
    const pack = await call("setFeather", { px });
    return previewUrlFrom(pack);
  },

  async setFinish(finish) {
    const pack = await call("setFinish", { finish });
    return previewUrlFrom(pack);
  },

  /**
   * Último ImageBitmap de preview (T-002b/B1), o null. CanvasEditor lo
   * consume directo (bitmaprenderer) en vez de decodificar `resultUrl` con
   * `new Image()`. Vive hasta el próximo preview u operación que lo cierre;
   * no se debe retener una referencia entre renders.
   */
  previewBitmap() {
    return lastPreviewBitmap;
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

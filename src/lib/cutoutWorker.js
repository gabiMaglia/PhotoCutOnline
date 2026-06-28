// Web Worker del motor de recorte.
//
// Saca la segmentación (k-means EM + componentes + feather) del hilo
// principal: la UI nunca se congela mientras se calcula. Protocolo RPC
// simple: {id, cmd, args} → {id, ok, result|error}.
//
// Los previews de pincel/recorte viajan como { blob, bitmap }: `blob` (PNG)
// alimenta los <img> que sí necesitan una URL real (PreviewPanel, CutGhost);
// `bitmap` es un ImageBitmap transferible (sin encode/decode, T-002b/B1) que
// CanvasEditor pinta directo en su canvas vía bitmaprenderer, sin pasar por
// `new Image()` en el hilo principal. Nunca base64.

import { CutoutSession, refineMatte } from "./jsEngine.js";
import wasmInit, { WasmCut } from "./wasm/photocut_wasm.js";
import { aiMatte, warmupAi, releaseAi } from "./aiSegmenter.js";

const session = new CutoutSession();

// T-002a (A1): el InferenceSession ONNX + runtime WASM quedan residentes en
// el worker tras el 1er aiCut (decenas-cientos de MB) y presionan el heap
// para TODO lo demás (incl. pinceles). Se libera tras ~30s de inactividad de
// IA; un aiCut/removeBg posterior la vuelve a crear de forma transparente
// (el costo de recrearla solo se paga si el usuario realmente dejó de usar
// IA por un rato, no entre dos cortes seguidos).
//
// D1 (QA, CRÍTICO): el timer se arma al TERMINAR cada operación de IA, no al
// iniciarla — si se armara al inicio, una inferencia (o el warmup) que tarda
// más que AI_IDLE_MS dispararía releaseAi() sobre la sesión que la propia
// operación todavía tiene capturada en su await (use-after-free del runtime
// WASM). aiSegmenter.releaseAi() además respeta un contador de operaciones
// en vuelo y difiere la liberación si hace falta, como defensa en
// profundidad — pero el caller no debe depender de eso para evitar el
// disparo en primer lugar.
const AI_IDLE_MS = 30_000;
let aiIdleTimer = null;

function scheduleAiRelease() {
  clearTimeout(aiIdleTimer);
  aiIdleTimer = setTimeout(() => {
    releaseAi();
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

// Motor GrabCut real (Rust→WASM); si no carga, el motor JS sigue funcionando.
let wasmReady = null;
function ensureWasm() {
  if (!wasmReady) {
    wasmReady = wasmInit()
      .then(() => {
        session.attachWasm(WasmCut);
        return "wasm";
      })
      .catch((e) => {
        console.warn("photocut-wasm no disponible; motor JS:", e);
        return "js";
      });
  }
  return wasmReady;
}

/** Empaqueta blob (URL para <img>) + bitmap (transferible, sin encode) o null. */
async function packPreview() {
  if (!session.hasCut) return null;
  const [blob, bitmap] = await Promise.all([session.previewBlob(), session.previewBitmap()]);
  return { blob, bitmap };
}

const handlers = {
  async load({ dataUrl }) {
    const engine = await ensureWasm();
    const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    session.load(ctx.getImageData(0, 0, bmp.width, bmp.height));
    bmp.close();
    return { width: c.width, height: c.height, engine };
  },

  async cutRect({ rect }) {
    await session.cutRect(rect);
    return packPreview();
  },
  async autoCut() {
    await session.autoCut();
    return packPreview();
  },

  warmupAi: () => withAiIdleRelease(() => warmupAi()),

  aiCut: () =>
    withAiIdleRelease(async () => {
      const matte = await aiMatte(session.work);
      await session.aiCutFromMatte(matte);
      return packPreview();
    }),

  /** Quita el fondo de una imagen arbitraria (Icon Studio) sin tocar la
   *  sesión del editor. Devuelve el matte refinado. */
  removeBg: ({ width, height, rgba }) =>
    withAiIdleRelease(async () => {
      const img = new ImageData(new Uint8ClampedArray(rgba), width, height);
      const matte = await aiMatte(img);
      return refineMatte(matte, width, height);
    }),
  async addStroke({ stroke }) {
    await session.addStroke(stroke);
    return packPreview();
  },
  async wand({ seed, tolerance, additive }) {
    await session.wandSelect(seed, tolerance, additive);
    return packPreview();
  },
  async undo() {
    await session.undo();
    return packPreview();
  },
  async redo() {
    await session.redo();
    return packPreview();
  },

  async setFeather({ px }) {
    session.setFeather(px);
    return packPreview();
  },

  async setFinish({ finish }) {
    session.setFinish(finish);
    return packPreview();
  },

  composite: ({ opts }) => session.composite(opts),
};

self.onmessage = async (e) => {
  const { id, cmd, args } = e.data;
  try {
    const handler = handlers[cmd];
    if (!handler) throw new Error(`comando desconocido: ${cmd}`);
    const result = await handler(args || {});
    // El bitmap es transferible (sin copia); el resto del payload (blob,
    // metadata) se clona como siempre.
    const transfer = result?.bitmap ? [result.bitmap] : [];
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};

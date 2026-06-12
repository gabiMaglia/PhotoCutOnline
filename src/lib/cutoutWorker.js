// Web Worker del motor de recorte.
//
// Saca la segmentación (k-means EM + componentes + feather) del hilo
// principal: la UI nunca se congela mientras se calcula. Protocolo RPC
// simple: {id, cmd, args} → {id, ok, result|error}. Los previews viajan
// como Blob (clon barato), nunca como base64.

import { CutoutSession } from "./jsEngine.js";
import wasmInit, { WasmCut } from "./wasm/photocut_wasm.js";
import { aiMatte, warmupAi } from "./aiSegmenter.js";

const session = new CutoutSession();

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

  cutRect: ({ rect }) => session.cutRect(rect),
  autoCut: () => session.autoCut(),

  warmupAi: () => warmupAi(),

  async aiCut() {
    const matte = await aiMatte(session.work);
    return session.aiCutFromMatte(matte);
  },
  addStroke: ({ stroke }) => session.addStroke(stroke),
  undo: () => session.undo(),
  redo: () => session.redo(),

  setFeather({ px }) {
    session.setFeather(px);
    return session.hasCut ? session.previewBlob() : null;
  },

  setFinish({ finish }) {
    session.setFinish(finish);
    return session.hasCut ? session.previewBlob() : null;
  },

  composite: ({ opts }) => session.composite(opts),
};

self.onmessage = async (e) => {
  const { id, cmd, args } = e.data;
  try {
    const handler = handlers[cmd];
    if (!handler) throw new Error(`comando desconocido: ${cmd}`);
    const result = await handler(args || {});
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};

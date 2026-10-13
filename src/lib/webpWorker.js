// Worker dedicado del encoder WebP para la ventana (A1): una vez llamado, el
// WASM corre sincrónico, y en una foto grande congelaría la UI varios
// segundos. Se crea recién al primer uso.
import { encodeWebPDirect } from "./webpWasm.js";

self.onmessage = async (e) => {
  const { id, width, height, buffer, quality } = e.data;
  try {
    const blob = await encodeWebPDirect({ data: new Uint8ClampedArray(buffer), width, height }, quality);
    const out = await blob.arrayBuffer();
    self.postMessage({ id, ok: true, buffer: out }, [out]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};

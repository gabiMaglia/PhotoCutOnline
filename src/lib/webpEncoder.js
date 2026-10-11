// API pública del WebP: ¿el canvas de ESTE contexto codifica WebP?, y si no,
// el encoder propio. Ventana y workers cargan cada uno su copia del módulo,
// así que el memo es por contexto (A3): no se pasa lo de uno al otro.
import { isWebpEncodeError } from "./webpWasm.js";

export { isWebpEncodeError };

let nativeProbe = null;

export function canEncodeWebP() {
  nativeProbe ??= probeNative();
  return nativeProbe;
}

async function probeNative() {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const oc = new OffscreenCanvas(1, 1);
      oc.getContext("2d"); // sin contexto Chromium lanza y daría un falso negativo
      const b = await oc.convertToBlob({ type: "image/webp" });
      return b.type === "image/webp";
    }
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export function _resetForTests() {
  nativeProbe = null;
}

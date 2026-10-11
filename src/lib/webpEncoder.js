// API pública del WebP: ¿el canvas de ESTE contexto codifica WebP?, y si no,
// el encoder propio. Ventana y workers cargan cada uno su copia del módulo,
// así que el memo es por contexto (A3): no se pasa lo de uno al otro.
import { encodeWebPDirect, isWebpEncodeError, WebpEncodeError, WEBP_ERROR } from "./webpWasm.js";

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

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./webpWorker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, ok, buffer, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(new Blob([buffer], { type: "image/webp" }));
    else {
      p.reject(isWebpEncodeError(error) ? new Error(error) : new WebpEncodeError(error));
      // WebKit guarda el import() fallido en el module map de ese worker y no
      // lo vuelve a pedir: tras un fallo de carga solo sirve un contexto nuevo
      if (String(error).includes(`${WEBP_ERROR}: load:`)) dropWorker();
    }
  };
  worker.onerror = (e) => {
    // p. ej. el chunk del worker no bajó: se rechaza todo y el próximo intento crea otro
    for (const p of pending.values()) p.reject(new WebpEncodeError(`worker: ${e?.message || "error"}`));
    pending.clear();
    dropWorker();
  };
  return worker;
}

function dropWorker() {
  worker?.terminate?.();
  worker = null;
}

/** Codifica a WebP con el encoder propio. Transfiere (consume) el buffer de `imageData`. */
export function encodeWebP(imageData, quality01 = 0.92) {
  // También desde cutoutWorker (Safari ≥ 16.4 anida workers): es el único
  // contexto descartable si falla la carga. Sin Worker, directo.
  if (typeof Worker === "undefined") return encodeWebPDirect(imageData, quality01);
  return new Promise((resolve, reject) => {
    let w;
    try {
      w = getWorker();
    } catch (e) {
      reject(new WebpEncodeError(`worker: ${e?.message || e}`));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    const { width, height, data } = imageData;
    w.postMessage({ id, width, height, buffer: data.buffer, quality: quality01 }, [data.buffer]);
  });
}

export function _resetForTests() {
  nativeProbe = null;
  worker = null;
  pending.clear();
}

// Codificador WebP propio (GROW-35). WebKit devuelve PNG cuando se le pide
// WebP al canvas, así que en ese caso los bytes los produce libwebp en WASM.
// Es el único módulo que toca jSquash, y solo su encoder: el decoder trae
// la superficie de CVE-2023-4863 y no lo necesitamos.

export const WEBP_MAX_DIM = 16383; // máximo del formato por lado
export const WEBP_ERROR = "WEBP_ENCODE_FAILED";

const TOO_LARGE = "too_large";

// kind "failed" (red, memoria, init) deja el mensaje como estaba; "too_large"
// lo marca, porque reconectarse no lo arregla y el aviso tiene que decirlo (D3)
export class WebpEncodeError extends Error {
  constructor(reason, kind = "failed") {
    super(`${WEBP_ERROR}: ${kind === TOO_LARGE ? `${TOO_LARGE}: ` : ""}${reason}`);
    this.name = "WebpEncodeError";
  }
}

// El error cruza workers como texto (postMessage), así que se reconoce por la marca.
export function isWebpEncodeError(e) {
  return String(e?.message ?? e ?? "").includes(WEBP_ERROR);
}

/** "too_large" | "failed" para un error del encoder (Error o texto), null si no es uno. */
export function webpErrorKind(e) {
  if (!isWebpEncodeError(e)) return null;
  return String(e?.message ?? e).includes(`${WEBP_ERROR}: ${TOO_LARGE}:`) ? TOO_LARGE : "failed";
}

export function toWebpQuality(q01 = 0.92) {
  const q = Number.isFinite(q01) ? q01 : 0.92;
  return Math.round(Math.min(1, Math.max(0, q)) * 100);
}

let encoderLoad = null;
function loadEncoder() {
  encoderLoad ??= import("@jsquash/webp/encode.js")
    .then(async (m) => {
      await m.init();
      return m.default;
    })
    .catch((e) => {
      // Se olvida la promesa para que init() (y el .wasm) se reintente. Si lo que
      // falló fue el import(), WebKit lo deja cacheado en este contexto: lo
      // recupera webpEncoder descartando el worker (GROW-35 D2).
      encoderLoad = null;
      throw e;
    });
  return encoderLoad;
}

export async function encodeWebPDirect(imageData, quality01) {
  const { width, height } = imageData;
  if (width > WEBP_MAX_DIM || height > WEBP_MAX_DIM)
    throw new WebpEncodeError(`${width}×${height} supera ${WEBP_MAX_DIM} px`, TOO_LARGE);
  let encode;
  try {
    encode = await loadEncoder();
  } catch (e) {
    throw new WebpEncodeError(`load: ${e?.message || e}`);
  }
  try {
    const buf = await encode(imageData, { quality: toWebpQuality(quality01) });
    return new Blob([buf], { type: "image/webp" });
  } catch (e) {
    throw new WebpEncodeError(`encode: ${e?.message || e}`);
  }
}

export function _resetWasmForTests() {
  encoderLoad = null;
}

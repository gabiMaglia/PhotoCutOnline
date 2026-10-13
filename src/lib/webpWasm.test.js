jest.mock("@jsquash/webp/encode.js", () => ({
  __esModule: true,
  init: jest.fn(async () => ({})),
  default: jest.fn(async () => new Uint8Array([82, 73, 70, 70]).buffer),
}));
import * as jsq from "@jsquash/webp/encode.js";
import {
  encodeWebPDirect, toWebpQuality, isWebpEncodeError, webpErrorKind, WEBP_MAX_DIM, _resetWasmForTests,
} from "./webpWasm.js";

const img = (w = 4, h = 4) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const failure = (p) => p.then(() => null, (e) => e);

beforeEach(() => {
  jest.clearAllMocks();
  _resetWasmForTests();
});

describe("toWebpQuality: 0–1 del canvas → 0–100 de libwebp (A4)", () => {
  it.each([[0, 0], [1, 100], [0.92, 92], [0.82, 82], [0.3, 30], [1.4, 100], [-0.2, 0], [undefined, 92], [NaN, 92]])(
    "%p → %p",
    (q, want) => expect(toWebpQuality(q)).toBe(want)
  );
});

describe("encodeWebPDirect", () => {
  it("codifica con la calidad mapeada y devuelve un Blob image/webp", async () => {
    const b = await encodeWebPDirect(img(), 0.72);
    expect(jsq.default).toHaveBeenCalledWith(expect.objectContaining({ width: 4, height: 4 }), { quality: 72 });
    expect(b.type).toBe("image/webp");
    expect(b.size).toBe(4);
  });

  it("inicializa el WASM una sola vez", async () => {
    await encodeWebPDirect(img(), 0.9);
    await encodeWebPDirect(img(), 0.9);
    expect(jsq.init).toHaveBeenCalledTimes(1);
  });

  it(`acepta ${WEBP_MAX_DIM} px y rechaza ${WEBP_MAX_DIM + 1} sin tocar el WASM`, async () => {
    await encodeWebPDirect({ width: WEBP_MAX_DIM, height: 1, data: new Uint8ClampedArray(0) }, 0.9);
    jest.clearAllMocks();
    _resetWasmForTests();
    const e = await failure(encodeWebPDirect({ width: WEBP_MAX_DIM + 1, height: 900, data: new Uint8ClampedArray(0) }, 0.9));
    expect(isWebpEncodeError(e)).toBe(true);
    expect(jsq.init).not.toHaveBeenCalled();
    expect(jsq.default).not.toHaveBeenCalled();
  });

  it("si el encoder lanza (OOM en iOS) devuelve un error WebP, nunca un blob", async () => {
    jsq.default.mockRejectedValueOnce(new Error("RuntimeError: memory access out of bounds"));
    const e = await failure(encodeWebPDirect(img(), 0.9));
    expect(isWebpEncodeError(e)).toBe(true);
  });

  it("si el init falla (offline la 1ª vez) el próximo intento lo vuelve a pedir", async () => {
    jsq.init.mockRejectedValueOnce(new Error("Failed to fetch"));
    expect(isWebpEncodeError(await failure(encodeWebPDirect(img(), 0.9)))).toBe(true);
    const b = await encodeWebPDirect(img(), 0.9);
    expect(b.type).toBe("image/webp");
    expect(jsq.init).toHaveBeenCalledTimes(2);
  });
});

describe("isWebpEncodeError (el error cruza el worker como texto)", () => {
  it("reconoce la marca en Error o en string, y nada más", () => {
    expect(isWebpEncodeError(new Error("WEBP_ENCODE_FAILED: encode: x"))).toBe(true);
    expect(isWebpEncodeError("Error: WEBP_ENCODE_FAILED: load")).toBe(true);
    expect(isWebpEncodeError(new Error("No hay recorte para exportar"))).toBe(false);
    expect(isWebpEncodeError(undefined)).toBe(false);
  });
});

// GROW-35 D3: el tamaño no se arregla reconectándose; el aviso tiene que decirlo
describe("webpErrorKind (el motivo cruza el worker como texto)", () => {
  it(">16383 px es too_large; OOM e init fallido son failed", async () => {
    const big = await failure(encodeWebPDirect({ width: WEBP_MAX_DIM + 1, height: 900, data: new Uint8ClampedArray(0) }, 0.9));
    expect(webpErrorKind(big)).toBe("too_large");
    expect(webpErrorKind(String(big))).toBe("too_large");
    jsq.default.mockRejectedValueOnce(new Error("RuntimeError: memory access out of bounds"));
    expect(webpErrorKind(await failure(encodeWebPDirect(img(), 0.9)))).toBe("failed");
    _resetWasmForTests();
    jsq.init.mockRejectedValueOnce(new Error("Failed to fetch"));
    expect(webpErrorKind(await failure(encodeWebPDirect(img(), 0.9)))).toBe("failed");
  });
  it("lo que no es del encoder no tiene tipo", () => {
    expect(webpErrorKind(new Error("No hay recorte para exportar"))).toBeNull();
    expect(webpErrorKind(undefined)).toBeNull();
  });
});

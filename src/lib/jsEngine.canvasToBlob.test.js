jest.mock("./webpEncoder.js", () => ({ canEncodeWebP: jest.fn(), encodeWebP: jest.fn() }));
import { canEncodeWebP, encodeWebP } from "./webpEncoder.js";
import { canvasToBlob } from "./jsEngine.js";

// OffscreenCanvas falso. `engineType` simula el motor: WebKit devuelve PNG aunque se pida WebP.
function offscreen(engineType) {
  const img = { width: 4, height: 3, data: new Uint8ClampedArray(48) };
  const ctx = { getImageData: jest.fn(() => img) };
  return {
    width: 4,
    height: 3,
    img,
    ctx,
    getContext: jest.fn(() => ctx),
    convertToBlob: jest.fn(async ({ type }) => new Blob([], { type: engineType ?? type })),
  };
}

beforeEach(() => jest.clearAllMocks());

describe("canvasToBlob — WebP real en cualquier motor (GROW-35)", () => {
  it("con WebP nativo usa el canvas y jamás el WASM (regresión G6)", async () => {
    canEncodeWebP.mockResolvedValue(true);
    const c = offscreen();
    const b = await canvasToBlob(c, "image/webp", 0.8);
    expect(c.convertToBlob).toHaveBeenCalledWith({ type: "image/webp", quality: 0.8 });
    expect(encodeWebP).not.toHaveBeenCalled();
    expect(b.type).toBe("image/webp");
  });

  it("sin WebP nativo: getImageData del lienzo entero + encodeWebP con la calidad pedida", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const c = offscreen("image/png");
    const b = await canvasToBlob(c, "image/webp", 0.7);
    expect(c.ctx.getImageData).toHaveBeenCalledWith(0, 0, 4, 3);
    expect(encodeWebP).toHaveBeenCalledWith(c.img, 0.7);
    expect(c.convertToBlob).not.toHaveBeenCalled();
    expect(b.type).toBe("image/webp");
  });

  it("sin calidad explícita usa 0.92", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const c = offscreen("image/png");
    await canvasToBlob(c, "image/webp");
    expect(encodeWebP).toHaveBeenCalledWith(c.img, 0.92);
  });

  it("HTMLCanvas (camino inline) sin WebP nativo también pasa por el encoder", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockResolvedValue(new Blob([], { type: "image/webp" }));
    const img = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const c = { width: 2, height: 2, getContext: () => ({ getImageData: () => img }), toDataURL: jest.fn() };
    await canvasToBlob(c, "image/webp", 0.5);
    expect(c.toDataURL).not.toHaveBeenCalled();
    expect(encodeWebP).toHaveBeenCalledWith(img, 0.5);
  });

  it("si el encoder falla, rechaza: nunca entrega un PNG en su lugar (A4)", async () => {
    canEncodeWebP.mockResolvedValue(false);
    encodeWebP.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: 16384×900 supera 16383 px"));
    const c = offscreen("image/png");
    await expect(canvasToBlob(c, "image/webp", 0.9)).rejects.toThrow(/WEBP_ENCODE_FAILED/);
    expect(c.convertToBlob).not.toHaveBeenCalled();
  });

  it("PNG y JPEG ni consultan el detector", async () => {
    const c = offscreen();
    await canvasToBlob(c, "image/png");
    await canvasToBlob(c, "image/jpeg", 0.9);
    expect(canEncodeWebP).not.toHaveBeenCalled();
  });
});

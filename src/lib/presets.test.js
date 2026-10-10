import { EXPORT_PRESETS, fitWithinBytes } from "./presets.js";

const byId = (id) => EXPORT_PRESETS.find((p) => p.id === id);

describe("presets de sticker", () => {
  it("Sticker WhatsApp: WebP 512×512 transparente, margen 8 %, ≤100 KB", () => {
    const p = byId("sticker-whatsapp");
    expect(p.labelKey).toBe("preset.stickerWhatsapp");
    expect(p.preset).toMatchObject({ w: 512, h: 512, padding: 0.08, bg: null, format: "webp", maxBytes: 100 * 1024 });
  });

  it("Sticker Telegram: PNG 512×512 transparente", () => {
    const p = byId("sticker-telegram");
    expect(p.labelKey).toBe("preset.stickerTelegram");
    expect(p.preset).toMatchObject({ w: 512, h: 512, bg: null, format: "png" });
    expect(p.preset.maxBytes).toBeUndefined();
  });
});

describe("fitWithinBytes", () => {
  // codificador falso: el peso baja con la calidad (100 KB por punto de calidad)
  const fakeEncode = (kbPerQ) =>
    jest.fn(async (q) => ({ url: `u${q.toFixed(2)}`, bytes: Math.round(q * kbPerQ * 1024) }));

  it("si ya entra, codifica una sola vez con la calidad inicial", async () => {
    const encode = fakeEncode(50); // 0.92 → 46 KB
    const r = await fitWithinBytes(encode, { maxBytes: 100 * 1024 });
    expect(encode).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ url: "u0.92", quality: 0.92, reduced: false, fits: true });
  });

  it("baja la calidad hasta que entra y avisa que la redujo", async () => {
    const encode = fakeEncode(150); // 0.92→138 KB, 0.82→123, 0.72→108, 0.62→93
    const r = await fitWithinBytes(encode, { maxBytes: 100 * 1024 });
    expect(r.quality).toBeCloseTo(0.62, 5);
    expect(r).toMatchObject({ reduced: true, fits: true });
    expect(r.bytes).toBeLessThanOrEqual(100 * 1024);
  });

  it("si ni la calidad mínima entra, devuelve fits=false sin bajar del mínimo", async () => {
    const encode = fakeEncode(1000);
    const r = await fitWithinBytes(encode, { maxBytes: 100 * 1024, min: 0.3 });
    expect(r.fits).toBe(false);
    expect(r.quality).toBeGreaterThanOrEqual(0.3 - 1e-9);
    const qs = encode.mock.calls.map(([q]) => q);
    expect(Math.min(...qs)).toBeGreaterThanOrEqual(0.3 - 1e-9);
  });
});

import { STICKER_TARGETS } from "./stickers.js";

// renderSticker/exportSticker usan canvas 2D (no disponible en jsdom): su
// render se valida en Playwright/manual. Acá fijamos el contrato de los specs.
describe("STICKER_TARGETS", () => {
  it("WhatsApp es WebP 512", () => {
    expect(STICKER_TARGETS.whatsapp).toMatchObject({ size: 512, format: "webp", ext: "webp" });
  });
  it("Telegram es PNG 512", () => {
    expect(STICKER_TARGETS.telegram).toMatchObject({ size: 512, format: "png", ext: "png" });
  });
  it("PNG genérico es 512 sin pérdida", () => {
    expect(STICKER_TARGETS.png).toMatchObject({ size: 512, format: "png", quality: 1 });
  });
});

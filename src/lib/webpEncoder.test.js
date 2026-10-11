import { canEncodeWebP, _resetForTests } from "./webpEncoder.js";

function fakeOffscreen(returns) {
  const calls = { convert: 0 };
  global.OffscreenCanvas = class {
    getContext() {
      this.ctx = true;
      return {};
    }
    async convertToBlob({ type }) {
      calls.convert++;
      // Chromium lanza InvalidStateError si nunca se pidió un contexto
      if (!this.ctx) throw new DOMException("no context", "InvalidStateError");
      if (returns === "throw") throw new Error("boom");
      return new Blob([], { type: returns ?? type });
    }
  };
  return calls;
}

afterEach(() => {
  delete global.OffscreenCanvas;
  _resetForTests();
  jest.restoreAllMocks();
});

describe("canEncodeWebP: detección en el contexto que codifica (A3)", () => {
  it("Chromium (devuelve image/webp, con contexto 2D previo) → true", async () => {
    fakeOffscreen("image/webp");
    expect(await canEncodeWebP()).toBe(true);
  });
  it("WebKit (pide WebP y devuelve PNG) → false", async () => {
    fakeOffscreen("image/png");
    expect(await canEncodeWebP()).toBe(false);
  });
  it("memoiza: dos consultas, una sola sonda", async () => {
    const calls = fakeOffscreen("image/webp");
    await canEncodeWebP();
    await canEncodeWebP();
    expect(calls.convert).toBe(1);
  });
  it("si la sonda lanza → false (se usa el encoder propio)", async () => {
    fakeOffscreen("throw");
    expect(await canEncodeWebP()).toBe(false);
  });
  it("sin OffscreenCanvas (Safari < 16.4) mira toDataURL", async () => {
    const real = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "canvas" ? { toDataURL: () => "data:image/png;base64,AAAA" } : real(tag)
    );
    expect(await canEncodeWebP()).toBe(false);
  });
});

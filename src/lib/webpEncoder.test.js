import { canEncodeWebP, encodeWebP, isWebpEncodeError, _resetForTests } from "./webpEncoder.js";

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

class FakeWorker {
  static instances = [];
  constructor(url, opts) {
    this.url = String(url);
    this.opts = opts;
    this.posted = [];
    FakeWorker.instances.push(this);
  }
  postMessage(msg, transfer) {
    this.posted.push({ msg, transfer });
  }
  reply(i, data) {
    this.onmessage({ data: { id: this.posted[i].msg.id, ...data } });
  }
}
const img = () => ({ width: 4, height: 4, data: new Uint8ClampedArray(64) });

describe("encodeWebP en la ventana: worker dedicado y perezoso (A1)", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    global.Worker = FakeWorker;
  });
  afterEach(() => delete global.Worker);

  it("no crea el worker hasta el primer encode y después lo reutiliza", async () => {
    expect(FakeWorker.instances).toHaveLength(0);
    const p = encodeWebP(img(), 0.8);
    const w = FakeWorker.instances[0];
    expect(w.url).toMatch(/webpWorker\.js/);
    expect(w.opts).toEqual({ type: "module" });
    w.reply(0, { ok: true, buffer: new Uint8Array([1, 2, 3]).buffer });
    const b = await p;
    expect(b.type).toBe("image/webp");
    expect(b.size).toBe(3);
    encodeWebP(img(), 0.8);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("transfiere el buffer de píxeles (no lo copia) y manda la calidad 0–1", () => {
    const im = img();
    encodeWebP(im, 0.8);
    const { msg, transfer } = FakeWorker.instances[0].posted[0];
    expect(transfer).toEqual([im.data.buffer]);
    expect(msg).toMatchObject({ width: 4, height: 4, quality: 0.8 });
  });

  it("un fallo dentro del worker llega como error WebP reconocible", async () => {
    const p = encodeWebP(img(), 0.8);
    FakeWorker.instances[0].reply(0, { ok: false, error: "WEBP_ENCODE_FAILED: encode: OOM" });
    expect(isWebpEncodeError(await p.catch((e) => e))).toBe(true);
  });

  it("si el worker muere (chunk sin red) rechaza lo pendiente y el próximo encode crea otro", async () => {
    const p = encodeWebP(img(), 0.8);
    FakeWorker.instances[0].onerror({ message: "load failed" });
    expect(isWebpEncodeError(await p.catch((e) => e))).toBe(true);
    encodeWebP(img(), 0.8);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("sin module workers (new Worker lanza) → error WebP, no una excepción suelta", async () => {
    global.Worker = class {
      constructor() {
        throw new TypeError("module workers not supported");
      }
    };
    expect(isWebpEncodeError(await encodeWebP(img(), 0.8).catch((e) => e))).toBe(true);
  });

  // GROW-35 D2: WebKit cachea el import() fallido en el module map del worker;
  // solo un contexto nuevo vuelve a pedir el chunk
  it("un fallo de CARGA descarta el worker (terminate) y el próximo encode crea otro", async () => {
    FakeWorker.prototype.terminate = jest.fn();
    const p = encodeWebP(img(), 0.8);
    const w = FakeWorker.instances[0];
    w.reply(0, { ok: false, error: "Error: WEBP_ENCODE_FAILED: load: Importing a module script failed." });
    expect(isWebpEncodeError(await p.catch((e) => e))).toBe(true);
    expect(w.terminate).toHaveBeenCalled();
    encodeWebP(img(), 0.8);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("un fallo de ENCODE (no de carga) conserva el worker", async () => {
    FakeWorker.prototype.terminate = jest.fn();
    const p = encodeWebP(img(), 0.8);
    FakeWorker.instances[0].reply(0, { ok: false, error: "WEBP_ENCODE_FAILED: encode: OOM" });
    await p.catch(() => {});
    encodeWebP(img(), 0.8);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].terminate).not.toHaveBeenCalled();
  });
});

/** @jest-environment node */
// Sin document, como dentro de cutoutWorker.
jest.mock("./webpWasm.js", () => ({
  ...jest.requireActual("./webpWasm.js"),
  encodeWebPDirect: jest.fn(async () => new Blob([new Uint8Array(3)], { type: "image/webp" })),
}));
const { encodeWebPDirect } = require("./webpWasm.js");
const { encodeWebP, _resetForTests } = require("./webpEncoder.js");

afterEach(() => {
  delete global.Worker;
  _resetForTests();
  jest.clearAllMocks();
});

// GROW-35 D2: el worker dedicado también se usa desde un worker (Safari ≥ 16.4 los
// anida), porque es el único contexto que se puede descartar si falla la carga.
it("dentro de un worker con Worker disponible codifica en el worker dedicado anidado", async () => {
  const made = [];
  global.Worker = class {
    constructor(url, opts) {
      this.url = String(url);
      this.opts = opts;
      made.push(this);
    }
    postMessage(msg) {
      this.onmessage({ data: { id: msg.id, ok: true, buffer: new Uint8Array([1, 2]).buffer } });
    }
  };
  const b = await encodeWebP({ width: 2, height: 2, data: new Uint8ClampedArray(16) }, 0.6);
  expect(made).toHaveLength(1);
  expect(made[0].url).toMatch(/webpWorker\.js/);
  expect(encodeWebPDirect).not.toHaveBeenCalled();
  expect(b.type).toBe("image/webp");
});

it("sin Worker en el contexto codifica directo", async () => {
  const im = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
  const b = await encodeWebP(im, 0.6);
  expect(encodeWebPDirect).toHaveBeenCalledWith(im, 0.6);
  expect(b.type).toBe("image/webp");
});

// Contrato { blob, bitmap } de previewUrlFrom/previewBitmap (D2, QA).
//
// backend.js no exporta esas funciones (son internas) — se las ejercita por
// la API pública (backend.cutRect/undo/etc.) mockeando el Worker real: un
// FakeWorker que responde el protocolo RPC {id,cmd,args} → {id,ok,result}
// con packs { blob, bitmap } controlados por el test, igual forma que
// produce cutoutWorker.js de verdad (eso ya lo cubre test/worker-test.js en
// Chrome real vía Playwright). Lo que se verifica acá es la gestión de
// memoria del lado de backend.js: URL.createObjectURL/revokeObjectURL y
// bitmap.close() en cada reemplazo.

function makeFakeBlob() {
  return { __fakeBlob: true };
}

function makeFakeBitmap() {
  return { closed: false, close() { this.closed = true; } };
}

class FakeWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    FakeWorker.instances.push(this);
  }
  postMessage(msg) {
    FakeWorker.lastPostedMessage = msg;
    // las respuestas las dispara el test explícitamente vía respond()
  }
  respond(result) {
    this.onmessage?.({ data: { id: FakeWorker.lastPostedMessage.id, ok: true, result } });
  }
}
FakeWorker.instances = [];

describe("backend.js — contrato de preview { blob, bitmap }", () => {
  let backend;
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    jest.resetModules();
    FakeWorker.instances = [];

    global.Worker = FakeWorker;
    global.OffscreenCanvas = function FakeOffscreenCanvas() {}; // solo para que WORKER_OK sea true

    createObjectURL = jest.fn((blob) => `blob:fake/${Math.random()}`);
    revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    backend = require("./backend.js").backend;
  });

  afterEach(() => {
    delete global.Worker;
    delete global.OffscreenCanvas;
  });

  function currentWorker() {
    return FakeWorker.instances[FakeWorker.instances.length - 1];
  }

  test("cutRect(): la URL del preview viene de pack.blob y el bitmap queda expuesto vía previewBitmap()", async () => {
    const blob = makeFakeBlob();
    const bitmap = makeFakeBitmap();

    const p = backend.cutRect({ x: 0, y: 0, w: 10, h: 10 });
    currentWorker().respond({ blob, bitmap });
    const url = await p;

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(url).toBe(createObjectURL.mock.results[0].value);
    expect(backend.previewBitmap()).toBe(bitmap);
  });

  test("la siguiente operación revoca la URL anterior y cierra el bitmap anterior", async () => {
    const bitmap1 = makeFakeBitmap();
    const p1 = backend.cutRect({ x: 0, y: 0, w: 10, h: 10 });
    currentWorker().respond({ blob: makeFakeBlob(), bitmap: bitmap1 });
    const url1 = await p1;

    const bitmap2 = makeFakeBitmap();
    const p2 = backend.autoCut();
    currentWorker().respond({ blob: makeFakeBlob(), bitmap: bitmap2 });
    await p2;

    expect(revokeObjectURL).toHaveBeenCalledWith(url1);
    expect(bitmap1.closed).toBe(true);
    expect(backend.previewBitmap()).toBe(bitmap2);
    expect(bitmap2.closed).toBe(false);
  });

  test("pack null (p.ej. undo sin historial) limpia URL/bitmap sin crear uno nuevo", async () => {
    const bitmap1 = makeFakeBitmap();
    const p1 = backend.cutRect({ x: 0, y: 0, w: 10, h: 10 });
    currentWorker().respond({ blob: makeFakeBlob(), bitmap: bitmap1 });
    const url1 = await p1;
    expect(url1).toMatch(/^blob:/);

    const p2 = backend.undo();
    currentWorker().respond(null);
    const url2 = await p2;

    expect(url2).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith(url1);
    expect(bitmap1.closed).toBe(true);
    expect(backend.previewBitmap()).toBeNull();
  });

  test("loadImage() limpia el preview previo (nueva imagen invalida el resultUrl anterior)", async () => {
    const bitmap1 = makeFakeBitmap();
    const p1 = backend.cutRect({ x: 0, y: 0, w: 10, h: 10 });
    currentWorker().respond({ blob: makeFakeBlob(), bitmap: bitmap1 });
    const url1 = await p1;

    const p2 = backend.loadImage("data:image/png;base64,AAA");
    currentWorker().respond({ width: 10, height: 10, engine: "js" });
    await p2;

    expect(revokeObjectURL).toHaveBeenCalledWith(url1);
    expect(bitmap1.closed).toBe(true);
    expect(backend.previewBitmap()).toBeNull();
  });
});

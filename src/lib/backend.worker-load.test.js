// BUG-08 C7: el worker que no carga (404 tras un deploy) no debe dejar la app
// colgada ni mostrar «worker error». Se mockea Worker igual que en
// backend.preview.test.js; el caso real (404 de verdad) lo cubre
// test/sw-deploy-test.mjs en Chrome/WebKit.

class FakeWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this.terminated = false;
    this.posted = [];
    FakeWorker.instances.push(this);
  }
  postMessage(msg) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  respond(result, id = this.posted[this.posted.length - 1].id) {
    this.onmessage?.({ data: { id, ok: true, result } });
  }
  fail(error, id = this.posted[this.posted.length - 1].id) {
    this.onmessage?.({ data: { id, ok: false, error } });
  }
}
FakeWorker.instances = [];

const IMPORT_FAIL =
  "Failed to fetch dynamically imported module: https://www.photocutapp.com/assets/aiSegmenter-OLD.js";

describe("backend.js — worker que no carga (BUG-08 C7)", () => {
  let backend;
  let staleEvents;
  const onStale = () => staleEvents++;

  beforeEach(() => {
    jest.resetModules();
    FakeWorker.instances = [];
    global.Worker = FakeWorker;
    global.OffscreenCanvas = function FakeOffscreenCanvas() {};
    staleEvents = 0;
    window.addEventListener("photocut:stale-build", onStale);
    backend = require("./backend.js").backend;
  });

  afterEach(() => {
    window.removeEventListener("photocut:stale-build", onStale);
    delete global.Worker;
    delete global.OffscreenCanvas;
  });

  const worker = (i) => FakeWorker.instances[i];

  test("error antes del primer mensaje ⇒ rechaza con WORKER_LOAD_FAILED, termina el worker y avisa", async () => {
    const p = backend.loadImage("data:image/png;base64,AA==");
    worker(0).onerror({ message: undefined });
    await expect(p).rejects.toMatchObject({ code: "WORKER_LOAD_FAILED" });
    expect(worker(0).terminated).toBe(true);
    expect(staleEvents).toBe(1);
  });

  test("la llamada siguiente crea un worker nuevo y resuelve (no queda colgada)", async () => {
    const p1 = backend.loadImage("data:image/png;base64,AA==");
    worker(0).onerror({ message: undefined });
    await expect(p1).rejects.toMatchObject({ code: "WORKER_LOAD_FAILED" });

    const p2 = backend.loadImage("data:image/png;base64,AA==");
    expect(FakeWorker.instances).toHaveLength(2);
    worker(1).respond({ width: 4, height: 3, engine: "js" });
    await expect(p2).resolves.toEqual({ width: 4, height: 3, engine: "js" });
  });

  test("un worker que ya respondió no se recrea por un error posterior", async () => {
    const p1 = backend.loadImage("data:image/png;base64,AA==");
    worker(0).respond({ width: 1, height: 1, engine: "js" });
    await p1;

    const p2 = backend.loadImage("data:image/png;base64,AA==");
    worker(0).onerror({ message: "boom" });
    await expect(p2).rejects.toThrow("boom");
    await p2.catch((e) => expect(e.code).toBeUndefined());
    expect(worker(0).terminated).toBe(false);
    expect(staleEvents).toBe(0);

    backend.loadImage("data:image/png;base64,AA==");
    expect(FakeWorker.instances).toHaveLength(1);
  });

  test("un import() fallido dentro del worker ⇒ WORKER_LOAD_FAILED, sin tirar el worker", async () => {
    const p1 = backend.loadImage("data:image/png;base64,AA==");
    worker(0).respond({ width: 1, height: 1, engine: "js" });
    await p1;

    const p2 = backend.warmupAi();
    worker(0).fail(IMPORT_FAIL);
    await expect(p2).rejects.toMatchObject({ code: "WORKER_LOAD_FAILED" });
    expect(worker(0).terminated).toBe(false);
    expect(staleEvents).toBe(1);
  });

  test("un error común del worker sigue siendo un error común", async () => {
    const p = backend.loadImage("data:image/png;base64,AA==");
    worker(0).fail("imagen corrupta");
    await expect(p).rejects.toThrow("imagen corrupta");
    expect(staleEvents).toBe(0);
  });
});

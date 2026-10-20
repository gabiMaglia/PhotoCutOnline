// GROW-36: el aviso «se usó el modelo liviano» nace en aiSegmenter (dentro del
// worker) y tiene que llegar a la UI también desde un corte o un quitar fondo,
// no solo desde el warmup: BiRefNet puede quedarse sin memoria o perder la GPU recién al inferir.

class FakeWorker {
  constructor() {
    this.onmessage = null;
    this.posted = [];
    FakeWorker.instances.push(this);
  }
  postMessage(msg) {
    this.posted.push(msg);
  }
  terminate() {}
  emit(data) {
    this.onmessage?.({ data: { id: this.posted[this.posted.length - 1].id, ...data } });
  }
}
FakeWorker.instances = [];

describe("backend.js — aviso de respaldo desde aiCut/removeBg (GROW-36)", () => {
  let backend;

  beforeEach(() => {
    jest.resetModules();
    FakeWorker.instances = [];
    global.Worker = FakeWorker;
    global.OffscreenCanvas = function FakeOffscreenCanvas() {};
    backend = require("./backend.js").backend;
  });

  afterEach(() => {
    delete global.Worker;
    delete global.OffscreenCanvas;
  });

  test("aiCut(onProgress) recibe el aviso que manda el worker antes del resultado", async () => {
    const seen = [];
    const p = backend.aiCut((e) => seen.push(e));
    const w = FakeWorker.instances[0];
    expect(w.posted[0].cmd).toBe("aiCut");
    w.emit({ progress: { stage: "fallback", model: "u2netp" } });
    w.emit({ ok: true, result: null });
    await p;
    expect(seen).toEqual([{ stage: "fallback", model: "u2netp" }]);
  });

  // BUG-13: el worker no tiene maxTouchPoints (WorkerNavigator): el hilo principal decide
  // si es un celular/tablet y se lo manda en cada comando de IA.
  describe("BUG-13: el hilo principal avisa al worker si es un dispositivo móvil", () => {
    const IPHONE =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
    const IPAD_AS_MAC =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
    const define = (k, v) => Object.defineProperty(window.navigator, k, { configurable: true, value: v });
    afterEach(() => {
      delete window.navigator.userAgent;
      delete window.navigator.maxTouchPoints;
      delete window.navigator.platform;
    });
    const calls = {
      warmupAi: () => backend.warmupAi(),
      aiCut: () => backend.aiCut(),
      removeBg: () => backend.removeBg({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
    };

    test.each(Object.keys(calls))("%s manda mobile:true en un iPhone", (cmd) => {
      define("userAgent", IPHONE);
      calls[cmd]().catch(() => {});
      expect(FakeWorker.instances[0].posted[0].args.mobile).toBe(true);
    });

    test.each(Object.keys(calls))("%s manda mobile:true en un iPad que se presenta como Mac", (cmd) => {
      define("userAgent", IPAD_AS_MAC);
      define("platform", "MacIntel");
      define("maxTouchPoints", 5);
      calls[cmd]().catch(() => {});
      expect(FakeWorker.instances[0].posted[0].args.mobile).toBe(true);
    });

    test.each(Object.keys(calls))("%s manda mobile:false en una computadora", (cmd) => {
      define("platform", "MacIntel");
      define("maxTouchPoints", 0);
      calls[cmd]().catch(() => {});
      expect(FakeWorker.instances[0].posted[0].args.mobile).toBe(false);
    });
  });

  test("removeBg(imageData, onProgress) también lo recibe", async () => {
    const seen = [];
    const img = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    const p = backend.removeBg(img, (e) => seen.push(e));
    const w = FakeWorker.instances[0];
    expect(w.posted[0].cmd).toBe("removeBg");
    w.emit({ progress: { stage: "fallback", model: "u2netp" } });
    w.emit({ ok: true, result: new Uint8ClampedArray(1) });
    await p;
    expect(seen).toEqual([{ stage: "fallback", model: "u2netp" }]);
  });
});

describe("cutoutWorker — pasa el canal de progreso a aiMatte (GROW-36)", () => {
  let aiMatte;
  let posted;

  beforeEach(() => {
    jest.resetModules();
    posted = [];
    aiMatte = jest.fn(async (img, onNotice) => {
      onNotice?.({ stage: "fallback", model: "u2netp" });
      return { matte: new Uint8ClampedArray(img.width * img.height), refine: undefined };
    });
    jest.doMock("./aiSegmenter.js", () => ({ aiMatte, warmupAi: jest.fn(), releaseAi: jest.fn(), aiIdleMs: () => 30_000 }));
    jest.doMock("./wasm/photocut_wasm.js", () => ({ __esModule: true, default: jest.fn(), WasmCut: class {} }));
    jest.doMock("./jsEngine.js", () => ({
      CutoutSession: class {
        constructor() {
          this.work = { width: 2, height: 1, data: new Uint8ClampedArray(8) };
          this.hasCut = false;
        }
        aiCutFromMatte() {}
      },
      refineMatte: (m) => m,
    }));
    global.ImageData = class {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    };
    self.postMessage = (msg) => posted.push(msg);
    require("./cutoutWorker.js");
  });

  test.each(["aiCut", "removeBg"])("%s: el aviso de aiMatte sale como progreso del mismo id", async (cmd) => {
    const args = cmd === "removeBg" ? { width: 1, height: 1, rgba: new Uint8ClampedArray(4) } : {};
    await self.onmessage({ data: { id: 42, cmd, args } });
    expect(aiMatte).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
    expect(posted[0]).toEqual({ id: 42, progress: { stage: "fallback", model: "u2netp" } });
    expect(posted[1]).toMatchObject({ id: 42, ok: true });
  });
});

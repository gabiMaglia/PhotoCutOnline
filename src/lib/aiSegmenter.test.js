// Tests de la guarda anti use-after-free de aiSegmenter (T-002a, D1/D2 QA).
//
// onnxruntime-web se mockea por completo: lo que se ejercita acá es la
// lógica propia de aiSegmenter (contador de operaciones en vuelo, diferido
// de releaseAi(), dispose de tensores en finally), no onnxruntime real (eso
// lo cubre test/ai-test.js en Chrome real vía Playwright).

// jsdom no expone setImmediate; varias vueltas de microtasks alcanzan para
// dejar correr las cadenas de promesas internas de aiSegmenter (getSession →
// session.run → finally).
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

// jsdom no implementa un 2d context real (no hay paquete `canvas` nativo en
// este proyecto — los tests de UI no lo necesitan). aiSegmenter.js sí dibuja
// en canvas (reescalado del matte), así que se stubea lo mínimo que usa:
// putImageData/getImageData/drawImage/clearRect, sin pixel-perfect real —
// alcanza para ejercitar la lógica de in-flight/dispose, que es lo que estos
// tests cubren (el resultado visual del matte ya lo valida test/ai-test.js
// en Chrome real).
beforeAll(() => {
  if (typeof global.ImageData === "undefined") {
    global.ImageData = class ImageData {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
  HTMLCanvasElement.prototype.getContext = function fakeGetContext() {
    return {
      putImageData() {},
      clearRect() {},
      drawImage() {},
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      getImageData(_x, _y, w, h) {
        return { data: new Uint8ClampedArray(w * h * 4) };
      },
    };
  };
});

function makeOrtMock() {
  let runDeferred = null; // {promise, resolve, reject} del próximo session.run()
  let createDeferred = null; // idem para InferenceSession.create()
  const disposed = [];

  const session = {
    inputNames: ["input"],
    outputNames: ["output"],
    run: jest.fn(() => {
      runDeferred = makeDeferred();
      return runDeferred.promise;
    }),
    release: jest.fn(() => Promise.resolve()),
  };

  function makeDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  class FakeTensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
    dispose() {
      disposed.push(this);
    }
  }

  const ort = {
    env: { wasm: {} },
    Tensor: FakeTensor,
    InferenceSession: {
      create: jest.fn(() => {
        createDeferred = makeDeferred();
        return createDeferred.promise;
      }),
    },
  };

  return {
    ort,
    session,
    disposed,
    resolveCreate: () => createDeferred.resolve(session),
    rejectCreate: (e) => createDeferred.reject(e),
    resolveRun: (out320 = new Float32Array(320 * 320).fill(0.5)) =>
      runDeferred.resolve({ output: { data: out320 } }),
    rejectRun: (e) => runDeferred.reject(e),
  };
}

describe("aiSegmenter", () => {
  let ortMock;

  beforeEach(() => {
    jest.resetModules();
    ortMock = makeOrtMock();
    jest.doMock("onnxruntime-web/wasm", () => ortMock.ort, { virtual: true });
    jest.doMock("./ort-runtime/ort-wasm-simd-threaded.wasm?url", () => "wasm-url", {
      virtual: true,
    });
    jest.doMock("./ort-runtime/ort-wasm-simd-threaded.mjs?url", () => "mjs-url", {
      virtual: true,
    });
  });

  function imageData(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }

  test("releaseAi() difiere la liberación mientras una inferencia está en vuelo, y la concreta al terminar", async () => {
    const { aiMatte, releaseAi } = require("./aiSegmenter.js");

    const mattePromise = aiMatte(imageData(4, 4));
    await flushMicrotasks();
    ortMock.resolveCreate(); // la sesión queda creada; aiMatte sigue en session.run()
    await flushMicrotasks();

    // releaseAi() llega MIENTRAS la inferencia está en vuelo (caso del informe QA)
    await releaseAi();
    expect(ortMock.session.release).not.toHaveBeenCalled();

    ortMock.resolveRun();
    await mattePromise;

    // ahora que la operación terminó, el release diferido se concreta
    await flushMicrotasks();
    expect(ortMock.session.release).toHaveBeenCalledTimes(1);
  });

  test("releaseAi() libera de inmediato si no hay ninguna operación en vuelo", async () => {
    const { aiMatte, releaseAi } = require("./aiSegmenter.js");

    const mattePromise = aiMatte(imageData(4, 4));
    await flushMicrotasks();
    ortMock.resolveCreate();
    await flushMicrotasks();
    ortMock.resolveRun();
    await mattePromise;

    await releaseAi();
    expect(ortMock.session.release).toHaveBeenCalledTimes(1);
  });

  test("un releaseAi() diferido no libera una sesión recién creada por warmup si aiCut ya está corriendo sobre ella", async () => {
    // Caso explícito del informe QA: warmup termina, pero antes de que el
    // idle-timer del caller llegue a reprogramarse, ya arrancó un aiCut que
    // depende de la MISMA sesión. releaseAi() no debe tirarla abajo.
    const { warmupAi, aiMatte, releaseAi } = require("./aiSegmenter.js");

    const warmPromise = warmupAi();
    await flushMicrotasks();
    ortMock.resolveCreate();
    await warmPromise;

    const mattePromise = aiMatte(imageData(4, 4));
    await flushMicrotasks(); // aiMatte ya está en vuelo (dentro de session.run)

    await releaseAi(); // no debe liberar: aiMatte sigue en vuelo
    expect(ortMock.session.release).not.toHaveBeenCalled();

    ortMock.resolveRun();
    await mattePromise;
    await flushMicrotasks();
    expect(ortMock.session.release).toHaveBeenCalledTimes(1);
  });

  test("(GROW-27 e) warmupAi(onProgress) descarga el modelo en streaming, informa % y luego la etapa 'init'", async () => {
    const chunks = [new Uint8Array(1000), new Uint8Array(1000), new Uint8Array(2000)];
    let i = 0;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: (h) => (h.toLowerCase() === "content-length" ? "4000" : null) },
      body: {
        getReader: () => ({
          read: async () =>
            i < chunks.length ? { done: false, value: chunks[i++] } : { done: true },
        }),
      },
    });
    const { warmupAi } = require("./aiSegmenter.js");
    const seen = [];
    const warm = warmupAi((p) => seen.push(p));
    await new Promise((r) => setTimeout(r, 0));
    ortMock.resolveCreate();
    await warm;

    const model = seen.filter((p) => p.stage === "model");
    expect(model.map((p) => p.loaded)).toEqual([0, 1000, 2000, 4000]); // 0 = arranque
    expect(model.slice(1).every((p) => p.total === 4000)).toBe(true);
    expect(seen[seen.length - 1].stage).toBe("init");
    // la sesión se crea con los bytes descargados, no con la URL
    const arg = ortMock.ort.InferenceSession.create.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Uint8Array);
    expect(arg.byteLength).toBe(4000);
  });

  test("dispose() de feeds/results corre en finally aunque session.run() rechace", async () => {
    const { aiMatte } = require("./aiSegmenter.js");

    const mattePromise = aiMatte(imageData(4, 4));
    await flushMicrotasks();
    ortMock.resolveCreate();
    await flushMicrotasks();

    ortMock.rejectRun(new Error("inferencia falló"));
    await expect(mattePromise).rejects.toThrow("inferencia falló");

    // el tensor de entrada (feeds) se dispone en finally aunque no haya
    // resultados (results nunca se llegó a construir)
    expect(ortMock.disposed.length).toBeGreaterThanOrEqual(1);
  });

  // D-02: aiSegmenter reusa canvases a nivel módulo (T-002c/A3) para evitar el
  // GC churn. Eso sólo es seguro si nunca hay dos aiMatte solapadas: si se
  // pisan entre sus awaits, el matte sale corrupto en silencio. Antes eso lo
  // garantizaba la UI (serializa); ahora lo garantiza el módulo.
  //
  // Prueba de mutación: quitando la cadena de serialización en aiMatte(), las
  // dos llamadas entran a session.run() a la vez → maxConcurrent 2 y este test
  // falla.
  function instrumentRunConcurrency() {
    const state = { active: 0, max: 0 };
    const origRun = ortMock.session.run;
    ortMock.session.run = jest.fn((...args) => {
      state.active++;
      state.max = Math.max(state.max, state.active);
      return origRun(...args).finally(() => {
        state.active--;
      });
    });
    return state;
  }

  test("D-02: dos aiMatte concurrentes se serializan (nunca dos session.run a la vez)", async () => {
    const { aiMatte } = require("./aiSegmenter.js");
    const conc = instrumentRunConcurrency();

    const p1 = aiMatte(imageData(4, 4));
    const p2 = aiMatte(imageData(4, 4));

    await flushMicrotasks();
    ortMock.resolveCreate();
    await flushMicrotasks();

    // la primera ya está infiriendo; la segunda debe seguir encolada, sin
    // haber tocado todavía los canvases compartidos
    expect(ortMock.session.run).toHaveBeenCalledTimes(1);

    ortMock.resolveRun();
    await p1;
    await flushMicrotasks();

    // recién ahora arranca la segunda
    expect(ortMock.session.run).toHaveBeenCalledTimes(2);
    ortMock.resolveRun();
    await p2;

    expect(conc.max).toBe(1);
  });

  test("D-02: una aiMatte que falla no traba la cola de las siguientes", async () => {
    const { aiMatte } = require("./aiSegmenter.js");

    const p1 = aiMatte(imageData(4, 4));
    const p2 = aiMatte(imageData(4, 4));
    // p1 rechaza; sin capturarlo acá, el rechazo se evalúa en el expect de abajo
    p1.catch(() => {});

    await flushMicrotasks();
    ortMock.resolveCreate();
    await flushMicrotasks();

    ortMock.rejectRun(new Error("inferencia falló"));
    await expect(p1).rejects.toThrow("inferencia falló");
    await flushMicrotasks();

    // la cadena no debe quedar rota: la segunda toma su turno igual
    expect(ortMock.session.run).toHaveBeenCalledTimes(2);
    ortMock.resolveRun();
    await expect(p2).resolves.toMatchObject({ matte: expect.any(Uint8ClampedArray) });
  });

  test("D-02: releaseAi() no libera con trabajo encolado", async () => {
    const { aiMatte, releaseAi } = require("./aiSegmenter.js");

    const p1 = aiMatte(imageData(4, 4));
    const p2 = aiMatte(imageData(4, 4));

    await flushMicrotasks();
    ortMock.resolveCreate();
    await flushMicrotasks();

    // p2 está encolada (todavía no corrió): liberar acá dejaría a p2 sin sesión
    await releaseAi();
    expect(ortMock.session.release).not.toHaveBeenCalled();

    ortMock.resolveRun();
    await p1;
    await flushMicrotasks();
    ortMock.resolveRun();
    await p2;
    await flushMicrotasks();

    // con la cola vacía, el release diferido se concreta
    expect(ortMock.session.release).toHaveBeenCalledTimes(1);
  });
});

// GROW-36: BiRefNet-lite fp16 sobre WebGPU si el navegador tiene GPU apta;
// u2netp sobre WASM si no, o si BiRefNet falla. Mock propio, sin deferreds: las
// sesiones se identifican por el execution provider y se les puede pedir que
// fallen al crearse o al correr.
describe("aiSegmenter — BiRefNet (WebGPU) + u2netp (GROW-36)", () => {
  const { createHash, webcrypto } = require("node:crypto");
  const PART_BYTES = [[1, 2, 3], [4, 5]];
  const ALL = Uint8Array.from(PART_BYTES.flat());
  let orts; // ep → módulo ORT falso
  let sessions; // "birefnet" | "u2netp" → sesión
  let fail;
  let fetched;
  let partOverride;
  let mark; // BUG-13: estado de la marca persistente (sobrevive a jest.resetModules = «recarga»)

  function makeOrt(ep) {
    class FakeTensor {
      constructor(type, data, dims) {
        Object.assign(this, { type, data, dims });
      }
      dispose() {}
    }
    return {
      env: { wasm: {} },
      Tensor: FakeTensor,
      InferenceSession: {
        create: jest.fn(async (model, opts) => {
          const name = opts.executionProviders[0] === "webgpu" ? "birefnet" : "u2netp";
          expect(opts.executionProviders).toEqual([ep]); // cada runtime con su EP
          if (fail.create.has(name)) throw new Error(`create ${name} falló`);
          const size = name === "birefnet" ? 1024 : 320;
          const s = {
            model,
            inputNames: [name === "birefnet" ? "input_image" : "input"],
            outputNames: ["out"],
            feeds: [],
            run: jest.fn(async (feeds) => {
              s.feeds.push(Object.values(feeds)[0]);
              if (fail.run.has(name)) throw new Error(`run ${name} falló`);
              // logits de BiRefNet: 0 → sigmoid 0,5 → 127/128
              return { out: { data: new Float32Array(size * size).fill(0) } };
            }),
            release: jest.fn(async () => {}),
          };
          sessions[name] = s;
          return s;
        }),
      },
    };
  }

  function setGpu(adapter) {
    Object.defineProperty(global.navigator, "gpu", {
      configurable: true,
      value: adapter === undefined ? undefined : { requestAdapter: jest.fn(async () => adapter) },
    });
  }
  const goodAdapter = () => ({ limits: { maxStorageBuffersPerShaderStage: 10 }, features: new Set(["shader-f16"]) });

  beforeEach(() => {
    jest.resetModules();
    sessions = {};
    fail = { create: new Set(), run: new Set() };
    fetched = [];
    partOverride = null;
    mark = { set: false, events: [] };
    jest.doMock("./aiAttemptMark.js", () => ({
      hasAttempt: async () => mark.set,
      markAttempt: async () => {
        mark.set = true;
        mark.events.push({ ev: "mark", gpuCreates: orts.webgpu.InferenceSession.create.mock.calls.length });
      },
      clearAttempt: async () => {
        mark.set = false;
        mark.events.push({ ev: "clear" });
      },
    }), { virtual: true });
    orts = { wasm: makeOrt("wasm"), webgpu: makeOrt("webgpu") };
    jest.doMock("onnxruntime-web/wasm", () => orts.wasm, { virtual: true });
    jest.doMock("onnxruntime-web/webgpu", () => orts.webgpu, { virtual: true });
    for (const f of [
      "./ort-runtime/ort-wasm-simd-threaded.wasm?url",
      "./ort-runtime/ort-wasm-simd-threaded.mjs?url",
      "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url",
      "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url",
    ])
      jest.doMock(f, () => f, { virtual: true });
    jest.doMock("./modelParts.json", () => ({
      birefnet: {
        bytes: ALL.length,
        sha256: createHash("sha256").update(ALL).digest("hex"),
        parts: [
          { url: "/models/m.onnx.part0", bytes: 3 },
          { url: "/models/m.onnx.part1", bytes: 2 },
        ],
      },
    }));
    if (!global.crypto?.subtle) Object.defineProperty(global, "crypto", { configurable: true, value: webcrypto });
    global.fetch = jest.fn(async (url) => {
      fetched.push(url);
      const i = url.endsWith("part0") ? 0 : url.endsWith("part1") ? 1 : -1;
      const chunks = i < 0 ? [new Uint8Array(4)] : [Uint8Array.from((partOverride || PART_BYTES)[i])];
      let k = 0;
      return {
        ok: true,
        headers: { get: () => null },
        body: { getReader: () => ({ read: async () => (k < chunks.length ? { done: false, value: chunks[k++] } : { done: true }) }) },
      };
    });
    setGpu(goodAdapter());
  });

  afterAll(() => setGpu(undefined));

  const photo = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

  test("con GPU apta usa BiRefNet en WebGPU: entrada input_image 1×3×1024×1024 ImageNet, salida sigmoid", async () => {
    const { aiMatte } = require("./aiSegmenter.js");
    const { matte, refine, model } = await aiMatte(photo(8, 6));
    expect(model).toBe("birefnet");
    const input = sessions.birefnet.feeds[0];
    expect(input.dims).toEqual([1, 3, 1024, 1024]);
    expect(input.data[0]).toBeCloseTo((0 - 0.485) / 0.229); // canvas falso: píxeles en 0
    expect(input.data[2 * 1024 * 1024]).toBeCloseTo((0 - 0.406) / 0.225);
    expect(Array.from(new Set(matte))).toEqual([0]); // el canvas falso devuelve alfa 0 al reescalar
    expect(refine).toEqual(expect.objectContaining({ stretch: false }));
    expect(sessions.u2netp).toBeUndefined();
    expect(orts.wasm.InferenceSession.create).not.toHaveBeenCalled(); // sin GPU-path no se baja el runtime wasm
  });

  test("las partes se bajan en orden, se concatenan y la sesión se crea con esos bytes", async () => {
    const { warmupAi } = require("./aiSegmenter.js");
    const seen = [];
    await warmupAi((p) => seen.push(p));
    expect(fetched).toEqual(["/models/m.onnx.part0", "/models/m.onnx.part1"]);
    expect(Array.from(sessions.birefnet.model)).toEqual(Array.from(ALL));
    const model = seen.filter((p) => p.stage === "model");
    expect(model.map((p) => p.loaded)).toEqual([0, 3, 5]); // progreso sumado sobre el total
    expect(model.every((p) => p.total === 5)).toBe(true);
    expect(seen.at(-1).stage).toBe("init");
  });

  test("sha256 que no coincide ⇒ no crea BiRefNet, pasa a u2netp y avisa", async () => {
    partOverride = [[1, 2, 3], [4, 9]];
    const { warmupAi } = require("./aiSegmenter.js");
    const seen = [];
    await warmupAi((p) => seen.push(p));
    expect(orts.webgpu.InferenceSession.create).not.toHaveBeenCalled();
    expect(sessions.u2netp).toBeDefined();
    expect(seen.filter((p) => p.stage === "fallback")).toEqual([{ stage: "fallback", model: "u2netp" }]);
  });

  test.each([
    ["sin navigator.gpu", undefined],
    ["requestAdapter() sin adapter", null],
    ["adapter con maxStorageBuffersPerShaderStage < 8", { limits: { maxStorageBuffersPerShaderStage: 4 }, features: new Set(["shader-f16"]) }],
    ["adapter sin shader-f16", { limits: { maxStorageBuffersPerShaderStage: 10 }, features: new Set() }],
    ["adapter de software (fallback)", { isFallbackAdapter: true, limits: { maxStorageBuffersPerShaderStage: 10 }, features: new Set(["shader-f16"]) }],
    ["adapter de software (info.isFallbackAdapter)", { info: { isFallbackAdapter: true }, limits: { maxStorageBuffersPerShaderStage: 10 }, features: new Set(["shader-f16"]) }],
  ])("%s ⇒ u2netp en WASM como hoy, sin aviso y sin bajar BiRefNet", async (_n, adapter) => {
    setGpu(adapter);
    const { aiMatte } = require("./aiSegmenter.js");
    const seen = [];
    const { refine, model } = await aiMatte(photo(4, 4), (p) => seen.push(p));
    expect(model).toBe("u2netp");
    expect(sessions.u2netp.feeds[0].dims).toEqual([1, 3, 320, 320]);
    expect(sessions.birefnet).toBeUndefined();
    expect(fetched.filter((u) => u.includes("part"))).toEqual([]);
    expect(refine).toBeUndefined(); // u2netp: post-proceso de siempre
    expect(seen).toEqual([]);
  });

  test("si crear BiRefNet falla (OOM, device lost), cae a u2netp y avisa una vez", async () => {
    fail.create.add("birefnet");
    const { aiMatte } = require("./aiSegmenter.js");
    const seen = [];
    const { matte } = await aiMatte(photo(4, 4), (p) => seen.push(p));
    expect(matte).toHaveLength(16);
    expect(sessions.u2netp.feeds[0].dims).toEqual([1, 3, 320, 320]);
    expect(seen.filter((p) => p.stage === "fallback")).toEqual([{ stage: "fallback", model: "u2netp" }]);
  });

  test("si BiRefNet falla al correr, libera su sesión y u2netp corta la MISMA imagen", async () => {
    fail.run.add("birefnet");
    const { aiMatte } = require("./aiSegmenter.js");
    const seen = [];
    const { matte } = await aiMatte(photo(5, 3), (p) => seen.push(p));
    expect(matte).toHaveLength(15);
    expect(sessions.birefnet.release).toHaveBeenCalledTimes(1);
    expect(sessions.u2netp.run).toHaveBeenCalledTimes(1);
    expect(seen.some((p) => p.stage === "fallback")).toBe(true);
  });

  test("el respaldo es pegajoso: tras liberar, el siguiente corte no reintenta BiRefNet ni repite el aviso", async () => {
    fail.create.add("birefnet");
    const { aiMatte, releaseAi } = require("./aiSegmenter.js");
    const seen = [];
    await aiMatte(photo(4, 4), (p) => seen.push(p));
    await releaseAi();
    await aiMatte(photo(4, 4), (p) => seen.push(p));
    expect(orts.webgpu.InferenceSession.create).toHaveBeenCalledTimes(1);
    expect(seen.filter((p) => p.stage === "fallback")).toHaveLength(1);
  });

  // Recrear BiRefNet tras liberarlo cuesta ~21 s de compilar shaders: una pausa
  // corta no puede costar eso. u2netp abre en 0,5 s y conserva su liberación rápida.
  test("aiIdleMs(): 5 min con BiRefNet, 30 s con u2netp (y 30 s antes de abrir nada)", async () => {
    const seg = require("./aiSegmenter.js");
    expect(seg.aiIdleMs()).toBe(30_000);
    await seg.aiMatte(photo(4, 4));
    expect(seg.aiIdleMs()).toBe(5 * 60_000);
  });

  test("sin GPU, aiIdleMs() es 30 s", async () => {
    setGpu(undefined);
    const seg = require("./aiSegmenter.js");
    await seg.aiMatte(photo(4, 4));
    expect(seg.aiIdleMs()).toBe(30_000);
  });

  test("tras el respaldo a u2netp, aiIdleMs() vuelve a 30 s", async () => {
    fail.run.add("birefnet");
    const seg = require("./aiSegmenter.js");
    await seg.aiMatte(photo(4, 4));
    expect(seg.aiIdleMs()).toBe(30_000);
  });

  // ---- BUG-13: celulares y marca persistente anti-bucle ----
  const IPHONE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
  const setUA = (ua) => Object.defineProperty(global.navigator, "userAgent", { configurable: true, value: ua });
  const realUA = global.navigator.userAgent;
  afterEach(() => setUA(realUA));

  const expectU2netpOnly = (seen) => {
    expect(sessions.u2netp).toBeDefined();
    expect(sessions.birefnet).toBeUndefined();
    expect(orts.webgpu.InferenceSession.create).not.toHaveBeenCalled();
    expect(fetched.filter((u) => u.includes("birefnet") || u.includes("part"))).toEqual([]);
    expect(seen).toEqual([]); // no es un respaldo: no hay aviso
  };

  test("BUG-13: celular con WebGPU y shader-f16 (aviso del hilo principal) ⇒ u2netp, sin pedir BiRefNet", async () => {
    const seg = require("./aiSegmenter.js");
    seg.setDeviceHint(true); // p.ej. iPad que se presenta como Mac: solo el hilo principal lo sabe
    const seen = [];
    const { model } = await seg.aiMatte(photo(4, 4), (p) => seen.push(p));
    expect(model).toBe("u2netp");
    expectU2netpOnly(seen);
    expect(mark.events).toEqual([]); // ni siquiera toca la marca
  });

  test("BUG-13: celular reconocido por el UA del propio worker ⇒ u2netp", async () => {
    setUA(IPHONE_UA);
    const { aiMatte } = require("./aiSegmenter.js");
    const seen = [];
    const { model } = await aiMatte(photo(4, 4), (p) => seen.push(p));
    expect(model).toBe("u2netp");
    expectU2netpOnly(seen);
  });

  test("BUG-13: warmupAi en celular tampoco baja BiRefNet", async () => {
    const seg = require("./aiSegmenter.js");
    seg.setDeviceHint(true);
    await seg.warmupAi(() => {});
    expectU2netpOnly([]);
  });

  test("BUG-13: computadora (aviso móvil=false) con GPU apta sigue usando BiRefNet", async () => {
    const seg = require("./aiSegmenter.js");
    seg.setDeviceHint(false);
    const { model } = await seg.aiMatte(photo(4, 4));
    expect(model).toBe("birefnet");
  });

  test("BUG-13: con la marca puesta (la pestaña murió abriendo BiRefNet) ⇒ u2netp sin reintentar", async () => {
    mark.set = true;
    const { aiMatte } = require("./aiSegmenter.js");
    const seen = [];
    const { model } = await aiMatte(photo(4, 4), (p) => seen.push(p));
    expect(model).toBe("u2netp");
    expectU2netpOnly(seen);
  });

  test("BUG-13: la marca se escribe ANTES de crear la sesión de BiRefNet y se borra al terminar bien", async () => {
    const { aiMatte } = require("./aiSegmenter.js");
    const { model } = await aiMatte(photo(4, 4));
    expect(model).toBe("birefnet");
    expect(mark.events[0]).toEqual({ ev: "mark", gpuCreates: 0 });
    expect(mark.events.at(-1)).toEqual({ ev: "clear" });
    expect(mark.set).toBe(false);
  });

  test("BUG-13: un BiRefNet exitoso limpia la marca y el próximo recorte («recarga») vuelve a usarlo", async () => {
    let seg = require("./aiSegmenter.js");
    await seg.aiMatte(photo(4, 4));
    jest.resetModules();
    seg = require("./aiSegmenter.js");
    expect((await seg.aiMatte(photo(4, 4))).model).toBe("birefnet");
  });

  test("BUG-13: proceso muerto en medio de crear la sesión ⇒ tras recargar va u2netp", async () => {
    const first = require("./aiSegmenter.js");
    orts.webgpu.InferenceSession.create.mockImplementationOnce(() => new Promise(() => {})); // jetsam: nunca vuelve
    first.aiMatte(photo(4, 4)); // sin await: la pestaña «murió»
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(mark.set).toBe(true); // la marca ya está confirmada
    // recarga: módulo nuevo, mismo almacenamiento
    jest.resetModules();
    jest.doMock("onnxruntime-web/wasm", () => orts.wasm, { virtual: true });
    const second = require("./aiSegmenter.js");
    const { model } = await second.aiMatte(photo(4, 4));
    expect(model).toBe("u2netp");
    expect(sessions.birefnet).toBeUndefined();
  });

  test("BUG-13: proceso muerto en medio de la inferencia ⇒ la marca también está puesta", async () => {
    const seg = require("./aiSegmenter.js");
    await seg.warmupAi(() => {}); // sesión BiRefNet abierta y marca puesta
    mark.set = false; // (la dejó limpia un corte anterior)
    sessions.birefnet.run.mockImplementationOnce(() => new Promise(() => {}));
    seg.aiMatte(photo(4, 4));
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(mark.set).toBe(true);
  });

  test("BUG-13: si BiRefNet falla con error atrapable la marca queda (no se vuelve a bajar 115 MB)", async () => {
    fail.create.add("birefnet");
    const { aiMatte } = require("./aiSegmenter.js");
    await aiMatte(photo(4, 4), () => {});
    expect(mark.set).toBe(true);
  });

  test("si u2netp también falla, se propaga el error ORIGINAL de BiRefNet", async () => {
    fail.create.add("birefnet");
    fail.create.add("u2netp");
    const { aiMatte } = require("./aiSegmenter.js");
    await expect(aiMatte(photo(4, 4))).rejects.toThrow("create birefnet falló");
  });
});

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
    await expect(p2).resolves.toBeInstanceOf(Uint8ClampedArray);
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

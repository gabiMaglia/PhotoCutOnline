// GROW-36: el tiempo de liberación por inactividad depende del modelo. BiRefNet
// tarda ~21 s en recompilar sus shaders, así que se queda 5 min; u2netp abre en
// medio segundo y se libera a los 30 s como siempre. Lo decide aiSegmenter
// (aiIdleMs) y lo respetan los dos timers: el del worker y el del camino inline.

const BIREFNET_IDLE = 5 * 60_000;
const U2NETP_IDLE = 30_000;

function mockSegmenter(idleMs) {
  const seg = {
    aiMatte: jest.fn(async (img) => ({ matte: new Uint8ClampedArray(img.width * img.height), refine: undefined })),
    warmupAi: jest.fn(async () => true),
    setDeviceHint: jest.fn(),
    releaseAi: jest.fn(),
    aiIdleMs: jest.fn(() => idleMs),
  };
  jest.doMock("./aiSegmenter.js", () => seg);
  return seg;
}

function mockEngine() {
  jest.doMock("./jsEngine.js", () => ({
    UNDO_CAP: 20,
    CutoutSession: class {
      constructor() {
        this.work = { width: 2, height: 1, data: new Uint8ClampedArray(8) };
        this.hasCut = false;
      }
      attachWasm() {}
      aiCutFromMatte() {}
    },
    refineMatte: (m) => m,
  }));
}

// deja correr el import() dinámico y el finally que arma el timer
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

afterEach(() => {
  jest.useRealTimers();
});

describe("cutoutWorker — idle-release según el modelo (GROW-36)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.doMock("./wasm/photocut_wasm.js", () => ({ __esModule: true, default: jest.fn(), WasmCut: class {} }));
    mockEngine();
    self.postMessage = () => {};
  });

  test.each([
    ["BiRefNet", BIREFNET_IDLE],
    ["u2netp", U2NETP_IDLE],
  ])("con %s libera recién a los %i ms de inactividad", async (_n, idle) => {
    const seg = mockSegmenter(idle);
    require("./cutoutWorker.js");
    await self.onmessage({ data: { id: 1, cmd: "warmupAi", args: {} } });
    jest.advanceTimersByTime(idle - 1);
    expect(seg.releaseAi).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(seg.releaseAi).toHaveBeenCalledTimes(1);
  });
});

describe("backend inline — idle-release según el modelo (GROW-36)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    delete global.Worker; // sin Worker ⇒ camino inline
    mockEngine();
  });

  test.each([
    ["BiRefNet", BIREFNET_IDLE],
    ["u2netp", U2NETP_IDLE],
  ])("con %s libera recién a los %i ms de inactividad", async (_n, idle) => {
    const seg = mockSegmenter(idle);
    const { backend } = require("./backend.js");
    await backend.warmupAi();
    await settle();
    jest.advanceTimersByTime(idle - 1);
    await settle();
    expect(seg.releaseAi).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await settle();
    expect(seg.releaseAi).toHaveBeenCalledTimes(1);
  });
});

// Segmentación IA 100% local (N1 del roadmap): u2netp (Apache-2.0, 4.6MB)
// sobre onnxruntime-web (backend WASM). Todo same-origin — el modelo y el
// runtime se descargan de NUESTRO hosting bajo demanda y quedan cacheados por
// el service worker: la promesa "tu foto nunca sale de tu equipo" se mantiene.
//
// Corre dentro del worker de recorte (OffscreenCanvas). Entrada: ImageData a
// resolución de trabajo. Salida: matte suave 0..255 al mismo tamaño.

// runtime vendoreado (ver ort-runtime/LEEME.md): el package no expone ./dist/*
import ortWasmUrl from "./ort-runtime/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "./ort-runtime/ort-wasm-simd-threaded.mjs?url";

const MODEL_URL = "/models/u2netp.onnx";
const INPUT_SIZE = 320; // entrada fija de u2netp

// normalización ImageNet usada por u2net
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let sessionPromise = null;

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web/wasm"); // build wasm-only (sin jsep/webgpu)
      // URLs del runtime resueltas por Vite (?url): deterministas en dev y
      // build, same-origin (el SW las cachea como cualquier asset)
      ort.env.wasm.wasmPaths = {
        wasm: new URL(ortWasmUrl, self.location.href).href,
        mjs: new URL(ortMjsUrl, self.location.href).href,
      };
      // sin COOP/COEP no hay SharedArrayBuffer: un solo hilo
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
      });
      return { ort, session };
    })().catch((e) => {
      sessionPromise = null; // permitir reintento
      throw e;
    });
  }
  return sessionPromise;
}

/** Pre-descarga el modelo (para mostrar progreso antes del primer corte). */
export function warmupAi() {
  return getSession().then(() => true);
}

function createCanvas(w, h) {
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

/**
 * imageData: ImageData (resolución de trabajo).
 * Devuelve Uint8ClampedArray (matte 0..255) de width×height.
 */
export async function aiMatte(imageData) {
  const { ort, session } = await getSession();
  const { width, height } = imageData;

  // 1. reescalar a 320×320
  const src = createCanvas(width, height);
  src.getContext("2d").putImageData(imageData, 0, 0);
  const small = createCanvas(INPUT_SIZE, INPUT_SIZE);
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(src, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const px = sctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  // 2. CHW float32 normalizado
  const N = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    input[i] = (px[i * 4] / 255 - MEAN[0]) / STD[0];
    input[N + i] = (px[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    input[2 * N + i] = (px[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }

  // 3. inferencia
  const feeds = {
    [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  };
  const results = await session.run(feeds);
  const out = results[session.outputNames[0]].data; // d0: 1×1×320×320

  // 4. normalización min-max (post-procesado estándar de u2net)
  let mi = Infinity;
  let ma = -Infinity;
  for (let i = 0; i < N; i++) {
    if (out[i] < mi) mi = out[i];
    if (out[i] > ma) ma = out[i];
  }
  const range = ma - mi || 1;
  const matte320 = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) matte320[i] = ((out[i] - mi) / range) * 255;

  // 5. reescalar el matte a la resolución de trabajo (suavizado bilineal)
  const mImg = new ImageData(INPUT_SIZE, INPUT_SIZE);
  for (let i = 0; i < N; i++) {
    mImg.data[i * 4] = 255;
    mImg.data[i * 4 + 1] = 255;
    mImg.data[i * 4 + 2] = 255;
    mImg.data[i * 4 + 3] = matte320[i];
  }
  const mSmall = createCanvas(INPUT_SIZE, INPUT_SIZE);
  mSmall.getContext("2d").putImageData(mImg, 0, 0);
  const mFull = createCanvas(width, height);
  const fctx = mFull.getContext("2d");
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(mSmall, 0, 0, width, height);
  const fd = fctx.getImageData(0, 0, width, height).data;
  const matte = new Uint8ClampedArray(width * height);
  for (let i = 0; i < matte.length; i++) matte[i] = fd[i * 4 + 3];
  return matte;
}

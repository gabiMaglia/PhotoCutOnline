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

// Guard contra el use-after-free detectado en QA (D1): releaseAi() puede
// llegar (vía timer de inactividad del caller) mientras getSession()/aiMatte
// están en vuelo — p.ej. InferenceSession.create() o session.run() tardando
// >30s. Sin este contador, releaseAi() libera la MISMA instancia que aiMatte
// tiene capturada en su await, y el runtime WASM queda liberado bajo una
// inferencia en curso. Mientras inFlight > 0, releaseAi() solo marca el
// pedido (pendingRelease) y lo re-evalúa cuando la última operación termina.
let inFlight = 0;
let pendingRelease = false;

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
export async function warmupAi() {
  inFlight++;
  try {
    await getSession();
    return true;
  } finally {
    inFlight--;
    settleRelease();
  }
}

/**
 * Libera el InferenceSession ONNX y el runtime WASM asociado (T-002a/A1):
 * sin esto, tras el primer aiCut el runtime + modelo u2netp quedan
 * residentes en el worker toda la sesión (decenas-cientos de MB), lo que
 * presiona el heap y jankea TODO (incl. pinceles). Idempotente y seguro de
 * llamar aunque no haya sesión activa (warmup nunca corrió o ya se liberó).
 * Un aiCut/removeBg posterior vuelve a crear la sesión transparentemente.
 *
 * D1 (QA): si hay una inferencia/warmup en vuelo (inFlight > 0), NO libera
 * de inmediato — el caller (worker/inline) tiene una promesa de sesión
 * capturada en su await y liberar ahora sería un use-after-free del runtime
 * WASM. En cambio, marca `pendingRelease` y `settleRelease()` la concreta en
 * cuanto la última operación en vuelo termina.
 */
export async function releaseAi() {
  if (inFlight > 0) {
    pendingRelease = true;
    return;
  }
  await doRelease();
}

async function doRelease() {
  pendingRelease = false;
  const p = sessionPromise;
  sessionPromise = null;
  if (!p) return;
  try {
    const { session } = await p;
    await session.release();
  } catch {
    // sesión nunca llegó a crearse (warmup falló) o ya estaba liberada: ok
  }
}

/** Concreta un releaseAi() diferido si quedó pendiente y ya no hay nada en vuelo. */
function settleRelease() {
  if (pendingRelease && inFlight === 0) doRelease();
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

function resizeCanvas(c, w, h) {
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
}

// T-002c (A3): aiMatte corría 4-5 canvases full-res nuevos + getImageData por
// llamada → GC churn en cada IA. Se reusan entre invocaciones: los de
// INPUT_SIZE (src/small) tienen tamaño fijo; los full-res (mFull) se
// redimensionan in place si la foto cambia de tamaño entre cortes.
let cSrc = null; // full-res: imagen de entrada reescalada a 320×320
let cSmall = null; // INPUT_SIZE×INPUT_SIZE: imagen de entrada a 320×320
let cMaskSmall = null; // INPUT_SIZE×INPUT_SIZE: matte crudo antes de reescalar
let cMaskFull = null; // full-res: matte reescalado a la resolución de trabajo

/**
 * imageData: ImageData (resolución de trabajo).
 * Devuelve Uint8ClampedArray (matte 0..255) de width×height.
 */
export async function aiMatte(imageData) {
  // D1 (QA): cuenta como operación en vuelo desde ANTES de tener la sesión
  // (getSession() puede ser el propio InferenceSession.create() tardando) y
  // hasta después de session.run() — todo el rango en el que releaseAi()
  // liberaría una sesión que esta función todavía usa.
  inFlight++;
  try {
    return await aiMatteInner(imageData);
  } finally {
    inFlight--;
    settleRelease();
  }
}

async function aiMatteInner(imageData) {
  const { ort, session } = await getSession();
  const { width, height } = imageData;

  // 1. reescalar a 320×320
  cSrc = resizeCanvas(cSrc || createCanvas(width, height), width, height);
  cSrc.getContext("2d").putImageData(imageData, 0, 0);
  cSmall = cSmall || createCanvas(INPUT_SIZE, INPUT_SIZE);
  const sctx = cSmall.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.clearRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  sctx.drawImage(cSrc, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const px = sctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  // 2. CHW float32 normalizado
  const N = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    input[i] = (px[i * 4] / 255 - MEAN[0]) / STD[0];
    input[N + i] = (px[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    input[2 * N + i] = (px[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }

  // 3. inferencia — feeds/results se liberan en finally (T-002a/A2): los
  // tensores WASM no se recolectan solos, se acumulan en el heap del worker.
  let feeds = null;
  let results = null;
  let matte320;
  try {
    feeds = {
      [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    };
    results = await session.run(feeds);
    const out = results[session.outputNames[0]].data; // d0: 1×1×320×320

    // 4. normalización min-max (post-procesado estándar de u2net)
    let mi = Infinity;
    let ma = -Infinity;
    for (let i = 0; i < N; i++) {
      if (out[i] < mi) mi = out[i];
      if (out[i] > ma) ma = out[i];
    }
    const range = ma - mi || 1;
    matte320 = new Uint8ClampedArray(N);
    for (let i = 0; i < N; i++) matte320[i] = ((out[i] - mi) / range) * 255;
  } finally {
    for (const t of Object.values(feeds || {})) t.dispose?.();
    for (const t of Object.values(results || {})) t.dispose?.();
  }

  // 5. reescalar el matte a la resolución de trabajo (suavizado bilineal)
  const mImg = new ImageData(INPUT_SIZE, INPUT_SIZE);
  for (let i = 0; i < N; i++) {
    mImg.data[i * 4] = 255;
    mImg.data[i * 4 + 1] = 255;
    mImg.data[i * 4 + 2] = 255;
    mImg.data[i * 4 + 3] = matte320[i];
  }
  cMaskSmall = cMaskSmall || createCanvas(INPUT_SIZE, INPUT_SIZE);
  cMaskSmall.getContext("2d").putImageData(mImg, 0, 0);
  cMaskFull = resizeCanvas(cMaskFull || createCanvas(width, height), width, height);
  const fctx = cMaskFull.getContext("2d");
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  fctx.clearRect(0, 0, width, height);
  fctx.drawImage(cMaskSmall, 0, 0, width, height);
  const fd = fctx.getImageData(0, 0, width, height).data;
  const matte = new Uint8ClampedArray(width * height);
  for (let i = 0; i < matte.length; i++) matte[i] = fd[i * 4 + 3];
  return matte;
}

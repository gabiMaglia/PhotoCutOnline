// Segmentación IA 100% local (N1 del roadmap) sobre onnxruntime-web.
//
// Dos caminos (GROW-36, BUG-13):
//  - Solo en computadoras: con GPU apta (WebGPU con adapter de hardware, ≥ 8 storage buffers por
//    etapa y shader-f16): BiRefNet-lite 1024 fp16 (MIT) sobre el EP WebGPU. 115 MB en
//    partes, verificadas por sha256 antes de crear la sesión.
//  - Celular/tablet, sin GPU, con una marca de intento que no terminó, o si BiRefNet falla: u2netp (Apache-2.0, 4,6 MB) sobre WASM, como
//    siempre. Quien no tiene GPU no baja nada del camino GPU.
// Todo same-origin — modelos y runtimes salen de NUESTRO hosting bajo demanda y
// los cachea el service worker: «tu foto nunca sale de tu equipo» se mantiene.
//
// Corre dentro del worker de recorte (OffscreenCanvas): Chrome expone WebGPU en
// workers (verificado en GROW-36); si un navegador no lo hace, la detección corre
// acá mismo y cae a u2netp. Entrada: ImageData a resolución de trabajo. Salida:
// matte suave 0..255 al mismo tamaño + las opciones de post-proceso del modelo.

// runtime WASM vendoreado (ver ort-runtime/LEEME.md)
import ortWasmUrl from "./ort-runtime/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "./ort-runtime/ort-wasm-simd-threaded.mjs?url";
// runtime WebGPU (asyncify) de la misma versión: el paquete 1.26 lo exporta
import gpuWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import gpuMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import modelParts from "./modelParts.json";
import { isMobileDevice } from "./deviceClass.js";
import { hasAttempt, markAttempt, clearAttempt } from "./aiAttemptMark.js";

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

// La model card de BiRefNet-lite-1024-webgpu exige ≥ 8; el fp16 necesita shader-f16
export const MIN_STORAGE_BUFFERS = 8;

export const MODELS = {
  birefnet: {
    name: "birefnet",
    ep: "webgpu",
    parts: modelParts.birefnet.parts,
    bytes: modelParts.birefnet.bytes,
    sha256: modelParts.birefnet.sha256,
    size: 1024,
    mean: IMAGENET_MEAN,
    std: IMAGENET_STD,
    post: "sigmoid", // la salida son logits
    // su matte ya es casi binario y sin niebla: sin estiramiento, y el filtro de
    // componentes por área absoluta para no borrar las letras de un logo
    refine: { stretch: false, minComponentFrac: 0.0005 },
    // recrearlo tras liberarlo cuesta ~21 s de compilar shaders: una pausa corta
    // no puede pagar eso otra vez
    idleMs: 5 * 60_000,
  },
  u2netp: {
    name: "u2netp",
    ep: "wasm",
    url: "/models/u2netp.onnx",
    bytes: 4_574_861, // total de respaldo si el server no informa Content-Length
    size: 320,
    mean: IMAGENET_MEAN,
    std: IMAGENET_STD,
    post: "minmax",
    refine: undefined, // post-proceso de siempre (refineMatte por defecto)
    idleMs: 30_000, // abre en 0,5 s: conviene soltar la memoria rápido
  },
};

let sessionPromise = null; // → { ort, session, model }
// último modelo abierto: decide cuánto esperar antes de liberarlo (aiIdleMs)
let activeModel = MODELS.u2netp;

// Una vez que BiRefNet falló en este equipo no se reintenta en cada corte: el
// usuario ya vio el aviso, y cada intento cuesta una descarga grande, 20 s de
// compilación y cientos de MB.
let usingFallback = false;
let gpuCheck = null;

// BUG-13: iOS 26 expone WebGPU+shader-f16 y mata la pestaña por memoria al abrir
// BiRefNet (~535 MB) — sin excepción, así que ningún respaldo corre. En celulares
// y tablets BiRefNet no se abre nunca. El hilo principal sabe más que el worker
// (maxTouchPoints no existe en WorkerNavigator): backend.js nos manda su veredicto.
let mobileHint = false;
export function setDeviceHint(mobile) {
  mobileHint = !!mobile;
}
const isMobile = () => mobileHint || isMobileDevice();

// Guard contra el use-after-free detectado en QA (D1): releaseAi() puede
// llegar (vía timer de inactividad del caller) mientras getSession()/aiMatte
// están en vuelo — p.ej. InferenceSession.create() o session.run() tardando
// >30s. Sin este contador, releaseAi() libera la MISMA instancia que aiMatte
// tiene capturada en su await, y el runtime queda liberado bajo una
// inferencia en curso. Mientras inFlight > 0, releaseAi() solo marca el
// pedido (pendingRelease) y lo re-evalúa cuando la última operación termina.
let inFlight = 0;
let pendingRelease = false;

/** ¿Hay una GPU con la que BiRefNet pueda correr? Se pregunta una sola vez. */
function gpuUsable() {
  if (!gpuCheck) {
    gpuCheck = (async () => {
      const gpu = globalThis.navigator?.gpu;
      if (!gpu) return false;
      try {
        const adapter = await gpu.requestAdapter();
        return (
          !!adapter &&
          // un adapter de software (SwiftShader) correría 115 MB de modelo en la CPU
          !(adapter.isFallbackAdapter ?? adapter.info?.isFallbackAdapter) &&
          adapter.limits.maxStorageBuffersPerShaderStage >= MIN_STORAGE_BUFFERS &&
          adapter.features.has("shader-f16")
        );
      } catch {
        return false;
      }
    })();
  }
  return gpuCheck;
}

async function readBody(res, onChunk) {
  const reader = res.body?.getReader?.();
  if (!reader) {
    onChunk(new Uint8Array(await res.arrayBuffer()));
    return;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    onChunk(value);
  }
}

/**
 * Descarga u2netp en streaming informando bytes. Devuelve null si el entorno
 * no soporta streaming (se cae a que ORT lo pida por URL, sin progreso).
 * `total` cae a model.bytes cuando el server comprime (el Content-Length no
 * coincide con los bytes decodificados).
 */
async function fetchModelWithProgress(model, onProgress) {
  const res = await fetch(model.url);
  if (!res.ok) throw new Error(`Model download failed (${res.status})`);
  if (!res.body?.getReader) return null;
  const encoded = !!res.headers.get("content-encoding");
  const total = (!encoded && Number(res.headers.get("content-length"))) || model.bytes;
  const parts = [];
  let loaded = 0;
  await readBody(res, (value) => {
    parts.push(value);
    loaded += value.byteLength;
    onProgress({ stage: "model", loaded, total });
  });
  const bytes = new Uint8Array(loaded);
  let off = 0;
  for (const p of parts) {
    bytes.set(p, off);
    off += p.byteLength;
  }
  return bytes;
}

/**
 * Baja las partes en orden escribiendo directo en un solo buffer (115 MB: nada
 * de juntar trozos y copiar) y verifica el sha256 del total. Una parte
 * truncada, cambiada o de otra versión no llega a ORT.
 */
async function fetchParts(model, onProgress) {
  const buf = new Uint8Array(model.bytes);
  let off = 0;
  for (const part of model.parts) {
    const res = await fetch(part.url);
    if (!res.ok) throw new Error(`Model download failed (${res.status}) ${part.url}`);
    const start = off;
    await readBody(res, (value) => {
      if (off + value.byteLength > buf.length) throw new Error(`Model part too large: ${part.url}`);
      buf.set(value, off);
      off += value.byteLength;
      onProgress?.({ stage: "model", loaded: off, total: model.bytes });
    });
    if (off - start !== part.bytes) throw new Error(`Model part size mismatch: ${part.url}`);
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("crypto.subtle no disponible: no se puede verificar el modelo");
  const hex = [...new Uint8Array(await subtle.digest("SHA-256", buf))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex !== model.sha256) throw new Error("Model checksum mismatch");
  return buf;
}

async function loadOrt(ep) {
  // el bundle WebGPU solo se pide en el camino GPU
  const ort = ep === "webgpu" ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web/wasm");
  // URLs resueltas por Vite (?url): deterministas en dev y build, same-origin
  // (el SW las cachea como cualquier asset)
  const [wasm, mjs] = ep === "webgpu" ? [gpuWasmUrl, gpuMjsUrl] : [ortWasmUrl, ortMjsUrl];
  ort.env.wasm.wasmPaths = {
    wasm: new URL(wasm, self.location.href).href,
    mjs: new URL(mjs, self.location.href).href,
  };
  // sin COOP/COEP no hay SharedArrayBuffer: un solo hilo
  ort.env.wasm.numThreads = 1;
  return ort;
}

async function openModel(model, onProgress) {
  const ort = await loadOrt(model.ep);
  let source = model.url;
  if (model.parts) {
    onProgress?.({ stage: "model", loaded: 0, total: model.bytes });
    source = await fetchParts(model, onProgress);
    onProgress?.({ stage: "init" });
  } else if (onProgress) {
    onProgress({ stage: "model", loaded: 0, total: model.bytes });
    source = (await fetchModelWithProgress(model, onProgress)) ?? model.url;
    // el runtime WASM (~2 MB comprimido) lo baja ORT acá adentro, sin eventos
    onProgress({ stage: "init" });
  }
  // la marca se confirma ANTES de la fase que puede matar el proceso (compilar
  // shaders + ~535 MB); la descarga de arriba no la dispara a propósito
  if (model === MODELS.birefnet) await markAttempt();
  const session = await ort.InferenceSession.create(source, {
    executionProviders: [model.ep],
  });
  // sesión abierta sin morir: no queda un intento «en curso» solo por haber
  // precargado (el usuario puede cerrar la pestaña sin cortar nada)
  if (model === MODELS.birefnet) await clearAttempt();
  activeModel = model;
  return { ort, session, model };
}

/**
 * Pasa a u2netp tras un fallo de BiRefNet. Si u2netp tampoco abre, se propaga
 * el error de BiRefNet: es el que explica la causa. El aviso sale solo cuando
 * el respaldo efectivamente quedó andando (no anunciar algo que no pasó).
 */
async function openFallback(gpuError, { onProgress, onNotice }) {
  console.warn("BiRefNet no pudo correr; uso u2netp:", gpuError);
  usingFallback = true;
  let opened;
  try {
    opened = await openModel(MODELS.u2netp, onProgress);
  } catch {
    throw gpuError;
  }
  onNotice?.({ stage: "fallback", model: MODELS.u2netp.name });
  return opened;
}

async function openPreferred(handlers) {
  // móvil se evalúa primero: ni toca el almacenamiento ni pide /models/birefnet-*.
  // La marca persistida (se lee solo si hay GPU apta) dice que un intento anterior
  // murió sin avisar: no se repite.
  if (usingFallback || isMobile() || !(await gpuUsable()) || (await hasAttempt())) {
    return openModel(MODELS.u2netp, handlers.onProgress);
  }
  try {
    return await openModel(MODELS.birefnet, handlers.onProgress);
  } catch (e) {
    return openFallback(e, handlers);
  }
}

// onProgress solo aplica a quien CREA la sesión; si ya hay una en curso o
// cacheada, no hay nada que informar. onNotice recibe el aviso de respaldo.
function getSession(handlers = {}) {
  if (!sessionPromise) sessionPromise = trackSession(openPreferred(handlers));
  return sessionPromise;
}

function trackSession(p) {
  const tracked = p.catch((e) => {
    if (sessionPromise === tracked) sessionPromise = null; // permitir reintento
    throw e;
  });
  return tracked;
}

/**
 * Cuánta inactividad esperan los callers (worker e inline) antes de releaseAi():
 * la del último modelo abierto. Si BiRefNet cayó a u2netp, rige la de u2netp.
 */
export function aiIdleMs() {
  return activeModel.idleMs;
}

/**
 * Pre-descarga el modelo (para mostrar progreso antes del primer corte).
 * onProgress({stage: "model", loaded, total} | {stage: "init"} |
 * {stage: "fallback", model}) es opcional.
 */
export async function warmupAi(onProgress) {
  inFlight++;
  try {
    await getSession({ onProgress, onNotice: onProgress });
    return true;
  } finally {
    inFlight--;
    settleRelease();
  }
}

/**
 * Libera el InferenceSession ONNX y el runtime asociado (T-002a/A1): sin
 * esto, tras el primer aiCut el runtime + modelo quedan residentes en el
 * worker toda la sesión (cientos de MB), lo que presiona el heap y jankea TODO
 * (incl. pinceles). Idempotente y seguro de llamar aunque no haya sesión
 * activa. Un aiCut/removeBg posterior vuelve a crear la sesión.
 *
 * D1 (QA): si hay una inferencia/warmup en vuelo (inFlight > 0), NO libera
 * de inmediato — el caller tiene una promesa de sesión capturada en su await
 * y liberar ahora sería un use-after-free del runtime. En cambio, marca
 * `pendingRelease` y `settleRelease()` la concreta en cuanto la última
 * operación en vuelo termina.
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
  await releaseCurrent();
}

// Sin tocar pendingRelease: también la usa el paso a u2netp en medio de un corte.
async function releaseCurrent() {
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
// llamada → GC churn en cada IA. Se reusan entre invocaciones y se
// redimensionan in place si cambia la foto o el modelo (lado de la entrada).
let cSrc = null; // full-res: imagen de entrada
let cSmall = null; // size×size: imagen de entrada reescalada al modelo
let cMaskSmall = null; // size×size: matte crudo antes de reescalar
let cMaskFull = null; // full-res: matte reescalado a la resolución de trabajo

// D-02 (QA T-002): esos canvases compartidos sólo son seguros si no hay dos
// aiMatte solapadas. Dos llamadas concurrentes se pisarían el mismo buffer
// entre sus awaits (session.run) y devolverían mattes corruptos. Se serializa
// acá dentro: el módulo es seguro por sí mismo y conserva el reuso de canvases.
let chain = Promise.resolve();

/**
 * imageData: ImageData (resolución de trabajo).
 * Resuelve { matte: Uint8ClampedArray (0..255, width×height), refine, model }:
 * `refine` son las opciones de refineMatte del modelo que cortó y `model` su
 * nombre ("birefnet" | "u2netp").
 * onNotice({stage: "fallback", model}) opcional: avisa si se pasó a u2netp.
 *
 * Las llamadas concurrentes se encolan (D-02): la segunda espera a que la
 * primera termine en vez de compartirle los canvases del módulo.
 */
export function aiMatte(imageData, onNotice) {
  // D1 (QA): cuenta como operación en vuelo desde ANTES de tener la sesión
  // y hasta después de session.run() — todo el rango en el que releaseAi()
  // liberaría una sesión que esta función todavía usa. Incluye la espera en
  // cola: releaseAi() no debe liberar con trabajo encolado.
  inFlight++;
  const run = chain.then(() => aiMatteInner(imageData, onNotice));
  // la cadena no debe cortarse si una llamada falla: el rechazo lo recibe
  // quien llamó (vía `run`), acá sólo se mantiene el turno para la siguiente.
  chain = run.then(
    () => {},
    () => {}
  );
  return run.finally(() => {
    inFlight--;
    settleRelease();
  });
}

async function aiMatteInner(imageData, onNotice) {
  let opened = await getSession({ onNotice });
  try {
    return result(opened, await segmentTracked(opened, imageData));
  } catch (e) {
    // la GPU puede quedarse sin memoria o perder el device recién al inferir:
    // se suelta BiRefNet y la MISMA imagen se corta con u2netp
    if (opened.model !== MODELS.birefnet) throw e;
    await releaseCurrent();
    sessionPromise = trackSession(openFallback(e, { onNotice }));
    opened = await sessionPromise;
    return result(opened, await segment(opened, imageData));
  }
}

// La inferencia de BiRefNet también puede matar el proceso: marca antes y limpia
// solo si terminó bien (un BiRefNet exitoso borra la marca).
async function segmentTracked(opened, imageData) {
  if (opened.model !== MODELS.birefnet) return segment(opened, imageData);
  await markAttempt();
  const matte = await segment(opened, imageData);
  await clearAttempt();
  return matte;
}

const result = ({ model }, matte) => ({ matte, refine: model.refine, model: model.name });

async function segment({ ort, session, model }, imageData) {
  const { width, height } = imageData;
  const S = model.size;
  const N = S * S;

  // 1. reescalar a S×S (squish, sin conservar proporción: así se entrenaron)
  cSrc = resizeCanvas(cSrc || createCanvas(width, height), width, height);
  cSrc.getContext("2d").putImageData(imageData, 0, 0);
  cSmall = resizeCanvas(cSmall || createCanvas(S, S), S, S);
  const sctx = cSmall.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.clearRect(0, 0, S, S);
  sctx.drawImage(cSrc, 0, 0, S, S);
  const px = sctx.getImageData(0, 0, S, S).data;

  // 2. CHW float32 normalizado
  const { mean, std } = model;
  const input = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    input[i] = (px[i * 4] / 255 - mean[0]) / std[0];
    input[N + i] = (px[i * 4 + 1] / 255 - mean[1]) / std[1];
    input[2 * N + i] = (px[i * 4 + 2] / 255 - mean[2]) / std[2];
  }

  // 3. inferencia — feeds/results se liberan en finally (T-002a/A2): los
  // tensores no se recolectan solos, se acumulan en el heap del worker.
  let feeds = null;
  let results = null;
  let small;
  try {
    feeds = {
      [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]),
    };
    results = await session.run(feeds);
    small = toMatte8(results[session.outputNames[0]].data, N, model.post);
  } finally {
    for (const t of Object.values(feeds || {})) t.dispose?.();
    for (const t of Object.values(results || {})) t.dispose?.();
  }

  // 4. reescalar el matte a la resolución de trabajo (suavizado bilineal)
  const mImg = new ImageData(S, S);
  for (let i = 0; i < N; i++) {
    mImg.data[i * 4] = 255;
    mImg.data[i * 4 + 1] = 255;
    mImg.data[i * 4 + 2] = 255;
    mImg.data[i * 4 + 3] = small[i];
  }
  cMaskSmall = resizeCanvas(cMaskSmall || createCanvas(S, S), S, S);
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

/** Salida cruda → 0..255: sigmoid de logits (BiRefNet) o min-max (u2net). */
function toMatte8(out, N, post) {
  const m8 = new Uint8ClampedArray(N);
  if (post === "sigmoid") {
    for (let i = 0; i < N; i++) m8[i] = 255 / (1 + Math.exp(-out[i]));
    return m8;
  }
  let mi = Infinity;
  let ma = -Infinity;
  for (let i = 0; i < N; i++) {
    if (out[i] < mi) mi = out[i];
    if (out[i] > ma) ma = out[i];
  }
  const range = ma - mi || 1;
  for (let i = 0; i < N; i++) m8[i] = ((out[i] - mi) / range) * 255;
  return m8;
}

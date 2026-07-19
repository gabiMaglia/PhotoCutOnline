// Detección de caras 100% local con YuNet (OpenCV, MIT, ~227 KB) sobre
// onnxruntime-web. Devuelve las cajas de las caras en píxeles de la imagen
// original. La usa el hub "Editar" para censurar (blur/pixelado) las caras.
//
// La foto NUNCA se sube: el modelo se descarga una vez (bajo demanda) y corre
// en el navegador, igual que el recorte.

import ortWasmUrl from "./ort-runtime/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "./ort-runtime/ort-wasm-simd-threaded.mjs?url";

const MODEL_URL = "/models/yunet_2023mar.onnx";
const STRIDES = [8, 16, 32];
// El ONNX 2023mar tiene la entrada FIJA en 640×640 (no dinámica): la imagen se
// reescala manteniendo proporción para entrar en 640 y se padea (letterbox) a
// 640×640. Las cajas se mapean de vuelta dividiendo por la escala.
const INPUT_SIZE = 640;

let sessionPromise = null;

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = {
        wasm: new URL(ortWasmUrl, self.location.href).href,
        mjs: new URL(ortMjsUrl, self.location.href).href,
      };
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
      return { ort, session };
    })().catch((e) => {
      sessionPromise = null; // permitir reintento
      throw e;
    });
  }
  return sessionPromise;
}

/** Pre-descarga el modelo (para mostrar progreso antes de la primera detección). */
export async function warmupFaces() {
  await getSession();
  return true;
}

// Intersección sobre unión de dos cajas {x,y,w,h}.
function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, x2 - x1), ih = Math.max(0, y2 - y1);
  const inter = iw * ih;
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni <= 0 ? 0 : inter / uni;
}

// Non-max suppression: ordena por score y descarta las cajas muy solapadas.
export function nms(boxes, iouThresh = 0.3) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep = [];
  for (const box of sorted) {
    if (keep.every((k) => iou(k, box) < iouThresh)) keep.push(box);
  }
  return keep;
}

/**
 * Decodifica las 12 salidas de YuNet a cajas {x,y,w,h,score} en coordenadas de
 * la ENTRADA (imagen ya reescalada+padded). Formato YuNet: por cada stride s y
 * celda (row,col): score = √(cls·obj); centro = (col+dx, row+dy)·s; tamaño =
 * (exp(dw), exp(dh))·s. Exportada para poder testear el decode con tensores
 * sintéticos sin cargar el modelo.
 */
export function decodeYunet(outputs, padW, padH, scoreThresh = 0.6) {
  const boxes = [];
  for (const s of STRIDES) {
    const cls = outputs[`cls_${s}`];
    const obj = outputs[`obj_${s}`];
    const bbox = outputs[`bbox_${s}`];
    if (!cls || !obj || !bbox) continue;
    const cols = Math.floor(padW / s), rows = Math.floor(padH / s);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const score = Math.sqrt(Math.max(0, cls[idx]) * Math.max(0, obj[idx]));
        if (score < scoreThresh) continue;
        const cx = (c + bbox[idx * 4]) * s;
        const cy = (r + bbox[idx * 4 + 1]) * s;
        const w = Math.exp(bbox[idx * 4 + 2]) * s;
        const h = Math.exp(bbox[idx * 4 + 3]) * s;
        boxes.push({ x: cx - w / 2, y: cy - h / 2, w, h, score });
      }
    }
  }
  return boxes;
}

/**
 * Dibuja `source` en un canvas nuevo y censura (blur o pixelado) las cajas
 * dadas, recortadas a una elipse (queda más natural sobre una cara que un
 * rectángulo). Devuelve el canvas resultante. 100% en el navegador.
 *
 * boxes: [{x,y,w,h}] en px de la imagen. opts: { mode:'blur'|'pixelate',
 * strength:0..100, pad:0..1 (margen extra alrededor de la caja) }.
 */
export function censorBoxes(source, boxes, opts = {}) {
  const { mode = "blur", strength = 60, pad = 0.14 } = opts;
  const W = source.naturalWidth || source.width;
  const H = source.naturalHeight || source.height;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  ctx.drawImage(source, 0, 0);

  for (const b of boxes) {
    // Regiones a mano (redacción de datos): sin margen extra y con recorte
    // RECTANGULAR, para tapar todo lo dibujado (una elipse dejaría las esquinas
    // de una patente/texto a la vista). Caras: margen + elipse (más natural).
    const p = b.manual ? 0 : pad;
    const rectShape = !!b.manual;
    const bx = Math.max(0, b.x - b.w * p);
    const by = Math.max(0, b.y - b.h * p);
    const bw = Math.min(W - bx, b.w * (1 + 2 * p));
    const bh = Math.min(H - by, b.h * (1 + 2 * p));
    if (bw <= 1 || bh <= 1) continue;

    const tmp = document.createElement("canvas");
    tmp.width = Math.round(bw);
    tmp.height = Math.round(bh);
    const tctx = tmp.getContext("2d");
    if (mode === "pixelate") {
      // más strength → bloques más grandes (12 a 4 celdas de ancho)
      const across = Math.max(3, Math.round(12 - (strength / 100) * 8));
      const sw = across, sh = Math.max(1, Math.round(across * bh / bw));
      const px = document.createElement("canvas");
      px.width = sw; px.height = sh;
      px.getContext("2d").drawImage(source, bx, by, bw, bh, 0, 0, sw, sh);
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(px, 0, 0, sw, sh, 0, 0, tmp.width, tmp.height);
    } else {
      // blur proporcional al tamaño de la cara
      const radius = Math.max(2, Math.round(Math.min(bw, bh) * (strength / 100) * 0.28));
      tctx.filter = `blur(${radius}px)`;
      tctx.drawImage(source, bx, by, bw, bh, 0, 0, tmp.width, tmp.height);
      tctx.filter = "none";
    }

    // pegar el resultado recortado: rectángulo (a mano) o elipse (caras)
    ctx.save();
    ctx.beginPath();
    if (rectShape) ctx.rect(bx, by, bw, bh);
    else ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(tmp, bx, by);
    ctx.restore();
  }
  return out;
}

/**
 * Detecta caras en una imagen dibujable (HTMLImageElement / canvas).
 * Devuelve [{x,y,w,h,score}] en píxeles de la imagen ORIGINAL.
 * opts: { scoreThresh=0.6, iouThresh=0.3 }
 */
export async function detectFaces(source, opts = {}) {
  const { scoreThresh = 0.6, iouThresh = 0.3 } = opts;
  const ow = source.naturalWidth || source.width;
  const oh = source.naturalHeight || source.height;
  if (!ow || !oh) return [];

  // reescalar manteniendo proporción para entrar en 640, letterbox a 640×640
  // (entrada fija del modelo). Offset 0: se dibuja en la esquina superior izq.
  const scale = INPUT_SIZE / Math.max(ow, oh);
  const newW = Math.round(ow * scale), newH = Math.round(oh * scale);
  const padW = INPUT_SIZE, padH = INPUT_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = padW;
  canvas.height = padH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, padW, padH);
  ctx.drawImage(source, 0, 0, newW, newH); // resto en negro (padding)
  const px = ctx.getImageData(0, 0, padW, padH).data;

  // tensor CHW en orden BGR, 0..255 (así lo entrena/consume YuNet en OpenCV)
  const N = padW * padH;
  const input = new Float32Array(3 * N);
  for (let p = 0; p < N; p++) {
    input[p] = px[p * 4 + 2];        // B
    input[N + p] = px[p * 4 + 1];    // G
    input[2 * N + p] = px[p * 4];    // R
  }

  const { ort, session } = await getSession();
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, padH, padW]) };
  let results;
  try {
    results = await session.run(feeds);
  } finally {
    feeds[session.inputNames[0]].dispose?.();
  }
  const outputs = {};
  for (const s of STRIDES) {
    outputs[`cls_${s}`] = results[`cls_${s}`]?.data;
    outputs[`obj_${s}`] = results[`obj_${s}`]?.data;
    outputs[`bbox_${s}`] = results[`bbox_${s}`]?.data;
  }
  for (const k of Object.keys(results)) results[k].dispose?.();

  const raw = decodeYunet(outputs, padW, padH, scoreThresh);
  // de coords de la entrada (padded) a coords de la imagen original
  const mapped = raw.map((b) => ({
    x: Math.max(0, b.x / scale),
    y: Math.max(0, b.y / scale),
    w: b.w / scale,
    h: b.h / scale,
    score: b.score,
  }));
  return nms(mapped, iouThresh);
}

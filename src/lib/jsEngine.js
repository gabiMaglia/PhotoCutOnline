// PhotoCut Studio — motor de recorte en navegador.
//
// Segmentador GrabCut-lite 100% client-side:
//  - Modelos de color por k-means (5 clusters fg / 5 bg), 3 iteraciones EM.
//  - Trimap de restricciones duras (pinceles mantener / quitar).
//  - Modo automático: modelo de fondo a partir del anillo del borde.
//  - Limpieza por componentes conexas (islas y agujeros pequeños).
//  - Feather de canal alfa (box blur separable doble ≈ gaussiana).
//  - Procesa a resolución de trabajo (≤ WORK_MAX px) y exporta a resolución
//    completa escalando la máscara con suavizado.
//
// La app de escritorio (Tauri) usa el motor Rust de photocut-core; este motor
// existe para que la web funcione sola, sin servidor y sin dependencias.
//
// Agnóstico de entorno: corre tanto en la ventana como dentro de un Web
// Worker (usa OffscreenCanvas si no hay DOM). Los previews/exports se
// devuelven como Blob para viajar baratos por postMessage.

const WORK_MAX = 1400;
const K = 5; // clusters por modelo
const EM_ITERS = 3;
const KMEANS_ITERS = 6;
const SAMPLE_CAP = 24000;

const TRI_NONE = 0;
const TRI_FG = 1;
const TRI_BG = 2;

export class CutoutSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.full = null; // ImageData resolución completa
    this.fullCanvas = null;
    this.work = null; // ImageData resolución de trabajo
    this.scale = 1; // work / full
    this.rect = null; // rect en coords de trabajo
    this.trimap = null;
    this.label = null; // 1 fg / 0 bg, resolución de trabajo
    this.history = [];
    this.featherPx = 2; // en px de imagen completa
    this.maskCanvasFull = null; // cache del último alfa a resolución completa
  }

  get hasCut() {
    return this.label != null;
  }

  get canUndo() {
    return this.history.length > 0;
  }

  load(imageData) {
    this.reset();
    this.full = imageData;
    this.fullCanvas = canvasFromImageData(imageData);
    const { width, height } = imageData;
    const s = Math.min(1, WORK_MAX / Math.max(width, height));
    this.scale = s;
    if (s < 1) {
      const w = Math.max(1, Math.round(width * s));
      const h = Math.max(1, Math.round(height * s));
      const c = createCanvas(w, h);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.fullCanvas, 0, 0, w, h);
      this.work = ctx.getImageData(0, 0, w, h);
    } else {
      this.work = imageData;
    }
    this.trimap = new Uint8Array(this.work.width * this.work.height);
  }

  setFeather(px) {
    this.featherPx = Math.max(0, px);
  }

  pushHistory() {
    this.history.push({
      trimap: Uint8Array.from(this.trimap),
      label: this.label ? Uint8Array.from(this.label) : null,
      rect: this.rect ? { ...this.rect } : null,
    });
    if (this.history.length > 15) this.history.shift();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return null;
    this.trimap = prev.trimap;
    this.label = prev.label;
    this.rect = prev.rect;
    return this.previewBlob();
  }

  /** rect en coords de imagen completa. */
  cutRect(rectFull) {
    this.pushHistory();
    const s = this.scale;
    this.rect = clampRect(
      {
        x: Math.round(rectFull.x * s),
        y: Math.round(rectFull.y * s),
        w: Math.round(rectFull.w * s),
        h: Math.round(rectFull.h * s),
      },
      this.work.width,
      this.work.height
    );
    this.trimap = new Uint8Array(this.work.width * this.work.height);
    this.label = null;
    this.segment();
    return this.previewBlob();
  }

  /** Recorte automático: el fondo se modela desde el anillo del borde. */
  autoCut() {
    this.pushHistory();
    const { width, height } = this.work;
    const ring = Math.max(6, Math.round(Math.min(width, height) * 0.04));
    this.rect = { x: 0, y: 0, w: width, h: height };
    this.trimap = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x < ring || y < ring || x >= width - ring || y >= height - ring) {
          this.trimap[y * width + x] = TRI_BG;
        }
      }
    }
    this.label = null;
    this.segment();
    return this.previewBlob();
  }

  /** stroke: {points:[{x,y}…], radius, foreground} en coords completas. */
  addStroke(stroke) {
    if (!this.rect) return null;
    this.pushHistory();
    const s = this.scale;
    const r = Math.max(1, Math.round((stroke.radius || 12) * s));
    const val = stroke.foreground ? TRI_FG : TRI_BG;
    const pts = stroke.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1] || a;
      stampLine(
        this.trimap,
        this.work.width,
        this.work.height,
        a.x * s,
        a.y * s,
        b.x * s,
        b.y * s,
        r,
        val
      );
    }
    // refinamiento: las etiquetas apenas cambian, 1 iteración EM basta
    this.segment(1);
    return this.previewBlob();
  }

  // ---- núcleo de segmentación ----

  segment(emIters = EM_ITERS) {
    const { width, height, data } = this.work;
    const N = width * height;
    const rect = this.rect;
    const tri = this.trimap;
    const inRect = (x, y) =>
      x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

    let label = this.label ? Uint8Array.from(this.label) : new Uint8Array(N);
    if (!this.label) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          label[y * width + x] = inRect(x, y) ? 1 : 0;
        }
      }
    }
    applyConstraints(label, tri);

    for (let it = 0; it < emIters; it++) {
      const fgC = clustersFor(data, label, 1);
      const bgC = clustersFor(data, label, 0);
      if (!fgC || !bgC) break;
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const i = row + x;
          if (tri[i] === TRI_FG) {
            label[i] = 1;
            continue;
          }
          if (tri[i] === TRI_BG || !inRect(x, y)) {
            label[i] = 0;
            continue;
          }
          const o = i * 4;
          const df = minDist2(fgC, data[o], data[o + 1], data[o + 2]);
          const db = minDist2(bgC, data[o], data[o + 1], data[o + 2]);
          label[i] = df <= db ? 1 : 0;
        }
      }
    }

    for (let k = 0; k < 2; k++) {
      label = majoritySmooth(label, width, height);
      applyConstraints(label, tri);
    }
    cleanComponents(label, tri, width, height);

    this.label = label;
  }

  // ---- alfa, preview y exportación ----

  /** Alfa con feather a resolución de trabajo. */
  buildAlphaWork() {
    const { width, height } = this.work;
    let alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = this.label[i] ? 255 : 0;

    const r = Math.round(this.featherPx * this.scale);
    if (r > 0) {
      alpha = boxBlurAlpha(alpha, width, height, r);
      alpha = boxBlurAlpha(alpha, width, height, Math.max(1, r >> 1));
    }
    return alpha;
  }

  /** Canvas a resolución completa cuyo canal alfa es la máscara con feather. */
  buildMaskCanvasFull() {
    const { width, height } = this.work;
    const alpha = this.buildAlphaWork();

    const maskImg = new ImageData(width, height);
    for (let i = 0; i < alpha.length; i++) {
      const o = i * 4;
      maskImg.data[o] = 255;
      maskImg.data[o + 1] = 255;
      maskImg.data[o + 2] = 255;
      maskImg.data[o + 3] = alpha[i];
    }
    const small = canvasFromImageData(maskImg);

    const fullW = this.full.width;
    const fullH = this.full.height;
    const fullMask = createCanvas(fullW, fullH);
    const ctx = fullMask.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(small, 0, 0, fullW, fullH);
    this.maskCanvasFull = fullMask;
    return fullMask;
  }

  /** Canvas del recorte (imagen original con alfa aplicado), full-res. */
  cutoutCanvas() {
    const mask = this.buildMaskCanvasFull();
    const out = createCanvas(this.full.width, this.full.height);
    const ctx = out.getContext("2d");
    ctx.drawImage(this.fullCanvas, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    return out;
  }

  previewBlob() {
    if (!this.label) return Promise.resolve(null);
    // Preview a resolución de trabajo (≤ WORK_MAX px): el editor lo escala a
    // pantalla de todos modos, y codificar PNG full-res en cada trazo cuesta
    // ~800 ms en una foto de 12MP. Full-res solo al exportar.
    const { width, height, data } = this.work;
    const alpha = this.buildAlphaWork();
    const out = new ImageData(width, height);
    for (let i = 0; i < alpha.length; i++) {
      const o = i * 4;
      out.data[o] = data[o];
      out.data[o + 1] = data[o + 1];
      out.data[o + 2] = data[o + 2];
      out.data[o + 3] = alpha[i];
    }
    return canvasToBlob(canvasFromImageData(out));
  }

  /**
   * Composición final.
   * opts: {type:'transparent'|'solid'|'image', color?, bgDataUrl?,
   *        format?:'png'|'webp'|'jpeg', quality?:number}
   */
  async composite(opts) {
    if (!this.label) throw new Error("No hay recorte para exportar");
    const cut = this.cutoutCanvas();
    const out = createCanvas(cut.width, cut.height);
    const ctx = out.getContext("2d");

    if (opts.type === "solid") {
      const [r, g, b, a] = opts.color;
      ctx.fillStyle = `rgba(${r},${g},${b},${(a ?? 255) / 255})`;
      ctx.fillRect(0, 0, out.width, out.height);
    } else if (opts.type === "image") {
      const img = await decodeImage(opts.bgDataUrl);
      drawCover(ctx, img, out.width, out.height);
    }
    ctx.drawImage(cut, 0, 0);

    const format = opts.format || "png";
    const mime =
      format === "webp" ? "image/webp" : format === "jpeg" ? "image/jpeg" : "image/png";
    return canvasToBlob(out, mime, opts.quality ?? 0.92);
  }
}

// ---------------------------------------------------------------- helpers

function applyConstraints(label, tri) {
  for (let i = 0; i < label.length; i++) {
    if (tri[i] === TRI_FG) label[i] = 1;
    else if (tri[i] === TRI_BG) label[i] = 0;
  }
}

function clustersFor(data, label, want) {
  let n = 0;
  for (let i = 0; i < label.length; i++) if (label[i] === want) n++;
  if (n === 0) return null;
  const stride = Math.max(1, Math.floor(n / SAMPLE_CAP));
  const px = new Float32Array(Math.ceil(n / stride) * 3);
  let j = 0;
  let seen = 0;
  for (let i = 0; i < label.length; i++) {
    if (label[i] !== want) continue;
    if (seen++ % stride !== 0) continue;
    const o = i * 4;
    px[j++] = data[o];
    px[j++] = data[o + 1];
    px[j++] = data[o + 2];
  }
  return kmeans(px.subarray(0, j), K, KMEANS_ITERS);
}

function kmeans(px, k, iters) {
  const n = px.length / 3;
  if (n === 0) return null;
  k = Math.min(k, n);
  const centers = new Float64Array(k * 3);
  for (let c = 0; c < k; c++) {
    const i = Math.floor((c + 0.5) * (n / k)) * 3;
    centers[c * 3] = px[i];
    centers[c * 3 + 1] = px[i + 1];
    centers[c * 3 + 2] = px[i + 2];
  }
  for (let it = 0; it < iters; it++) {
    const sum = new Float64Array(k * 3);
    const cnt = new Uint32Array(k);
    for (let i = 0; i < n; i++) {
      const r = px[i * 3];
      const g = px[i * 3 + 1];
      const b = px[i * 3 + 2];
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - centers[c * 3];
        const dg = g - centers[c * 3 + 1];
        const db = b - centers[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      sum[best * 3] += r;
      sum[best * 3 + 1] += g;
      sum[best * 3 + 2] += b;
      cnt[best]++;
    }
    for (let c = 0; c < k; c++) {
      if (cnt[c] > 0) {
        centers[c * 3] = sum[c * 3] / cnt[c];
        centers[c * 3 + 1] = sum[c * 3 + 1] / cnt[c];
        centers[c * 3 + 2] = sum[c * 3 + 2] / cnt[c];
      }
    }
  }
  return centers;
}

function minDist2(centers, r, g, b) {
  let best = Infinity;
  for (let c = 0; c < centers.length; c += 3) {
    const dr = r - centers[c];
    const dg = g - centers[c + 1];
    const db = b - centers[c + 2];
    const d = dr * dr + dg * dg + db * db;
    if (d < best) best = d;
  }
  return best;
}

function majoritySmooth(mask, width, height) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      let fg = 0;
      let total = 0;
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          total++;
          fg += mask[ny * width + nx];
        }
      }
      out[y * width + x] = fg * 2 > total ? 1 : 0;
    }
  }
  return out;
}

/**
 * Limpieza: elimina islas de fg sin semilla de pincel (salvo la mayor) y
 * rellena agujeros de bg pequeños totalmente rodeados de fg.
 */
function cleanComponents(label, tri, width, height) {
  const N = width * height;
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  const seeded = [];
  const stack = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    if (label[i] !== 1 || comp[i] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    let hasSeed = false;
    let sp = 0;
    const tryPush = (q) => {
      if (label[q] === 1 && comp[q] === -1) {
        comp[q] = id;
        stack[sp++] = q;
      }
    };
    stack[sp++] = i;
    comp[i] = id;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      if (tri[p] === TRI_FG) hasSeed = true;
      const x = p % width;
      const y = (p / width) | 0;
      if (x > 0) tryPush(p - 1);
      if (x < width - 1) tryPush(p + 1);
      if (y > 0) tryPush(p - width);
      if (y < height - 1) tryPush(p + width);
    }
    sizes.push(size);
    seeded.push(hasSeed);
  }
  if (sizes.length > 1) {
    let largest = 0;
    for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[largest]) largest = c;
    for (let i = 0; i < N; i++) {
      if (label[i] === 1 && comp[i] !== largest && !seeded[comp[i]]) label[i] = 0;
    }
  }

  // agujeros: flood desde los bordes por bg; lo no alcanzado y pequeño → fg
  const reach = new Uint8Array(N);
  let sp = 0;
  for (let x = 0; x < width; x++) {
    pushBg(x);
    pushBg((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pushBg(y * width);
    pushBg(y * width + width - 1);
  }
  function pushBg(q) {
    if (label[q] === 0 && !reach[q]) {
      reach[q] = 1;
      stack[sp++] = q;
    }
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) pushBg(p - 1);
    if (x < width - 1) pushBg(p + 1);
    if (y > 0) pushBg(p - width);
    if (y < height - 1) pushBg(p + width);
  }
  const holeLimit = Math.max(64, Math.round(N * 0.005));
  const holeComp = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (label[i] !== 0 || reach[i] || holeComp[i] !== -1) continue;
    // medir el agujero
    let size = 0;
    let sp2 = 0;
    const members = [];
    stack[sp2++] = i;
    holeComp[i] = 1;
    let hardBg = false;
    while (sp2 > 0) {
      const p = stack[--sp2];
      size++;
      members.push(p);
      if (tri[p] === TRI_BG) hardBg = true;
      const x = p % width;
      const y = (p / width) | 0;
      const tryQ = (q) => {
        if (label[q] === 0 && !reach[q] && holeComp[q] === -1) {
          holeComp[q] = 1;
          stack[sp2++] = q;
        }
      };
      if (x > 0) tryQ(p - 1);
      if (x < width - 1) tryQ(p + 1);
      if (y > 0) tryQ(p - width);
      if (y < height - 1) tryQ(p + width);
    }
    if (size <= holeLimit && !hardBg) {
      for (const p of members) label[p] = 1;
    }
  }
}

function boxBlurAlpha(src, width, height, r) {
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const div = r * 2 + 1;
  // horizontal
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, width - 1)];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = acc / div;
      acc += src[row + clamp(x + r + 1, 0, width - 1)] - src[row + clamp(x - r, 0, width - 1)];
    }
  }
  // vertical
  for (let x = 0; x < width; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, height - 1) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc / div;
      acc +=
        tmp[clamp(y + r + 1, 0, height - 1) * width + x] -
        tmp[clamp(y - r, 0, height - 1) * width + x];
    }
  }
  return out;
}

function stampLine(tri, width, height, x0, y0, x1, y1, r, val) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / Math.max(1, r / 2)));
  for (let s = 0; s <= steps; s++) {
    const cx = Math.round(x0 + (dx * s) / steps);
    const cy = Math.round(y0 + (dy * s) / steps);
    for (let oy = -r; oy <= r; oy++) {
      const y = cy + oy;
      if (y < 0 || y >= height) continue;
      const span = Math.floor(Math.sqrt(r * r - oy * oy));
      const xs = Math.max(0, cx - span);
      const xe = Math.min(width - 1, cx + span);
      const row = y * width;
      for (let x = xs; x <= xe; x++) tri[row + x] = val;
    }
  }
}

function clampRect(r, width, height) {
  const x = clamp(r.x, 0, width - 1);
  const y = clamp(r.y, 0, height - 1);
  return {
    x,
    y,
    w: clamp(r.w, 1, width - x),
    h: clamp(r.h, 1, height - y),
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function canvasFromImageData(imageData) {
  const c = createCanvas(imageData.width, imageData.height);
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

/** Canvas según entorno: HTMLCanvas en ventana, OffscreenCanvas en worker. */
function createCanvas(w, h) {
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

export function canvasToBlob(canvas, type = "image/png", quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality }); // OffscreenCanvas
  // HTMLCanvas (fallback sin worker): síncrono vía dataURL — toBlob programa
  // el encode en otro hilo y su callback es frágil en headless/virtual-time.
  const dataUrl = canvas.toDataURL(type, quality);
  const [head, b64] = dataUrl.split(",");
  const mime = head.slice(5, head.indexOf(";"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return Promise.resolve(new Blob([out], { type: mime }));
}

/** Decodifica un dataURL/Blob a ImageBitmap (funciona en ventana y worker). */
export async function decodeImage(src) {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  return createImageBitmap(blob);
}

function drawCover(ctx, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

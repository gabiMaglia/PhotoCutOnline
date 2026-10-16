// Filtros y desenfoques calculados en píxeles (BUG-09/BUG-10).
//
// WebKit/Safari no implementa CanvasRenderingContext2D.filter: asignarlo no hace
// nada y no avisa. Por eso PhotoCut calcula estos efectos acá, igual en todos los
// motores, y el navegador solo dibuja. Módulo puro (sin DOM): corre en el hilo
// principal y en cutoutWorker sobre objetos {data, width, height} tipo ImageData.
// Todas las funciones modifican la imagen EN EL LUGAR (12 MP = 48 MB: una copia
// de más puede matar la pestaña en iOS).

// --------------------------------------------------------------- color

// Matrices de Filter Effects Level 1 (fila por canal de salida).
const MATRIX = {
  grayscale(a) {
    const k = 1 - Math.min(1, Math.max(0, a));
    return [
      0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k,
      0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k,
      0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k,
    ];
  },
  sepia(a) {
    const k = 1 - Math.min(1, Math.max(0, a));
    return [
      0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k,
      0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k,
      0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k,
    ];
  },
  saturate(a) {
    const s = Math.max(0, a);
    return [
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
    ];
  },
};

// brightness/contrast son funciones de transferencia lineales; se evalúan como
// tabla de 8 bits truncada, que es como lo hace Chromium (medido: así coincide
// 0 de 256 valores distintos; con redondeo difería en la mitad).
function linearTable(slope, intercept) {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const v = slope * i + 255 * intercept;
    // el épsilon absorbe 59,99999… = 60 (error de punto flotante, no de la spec)
    t[i] = v <= 0 ? 0 : v >= 255 ? 255 : Math.floor(v + 1e-6);
  }
  return t;
}

function compile(ops) {
  const stages = [];
  for (const { op, amount } of ops) {
    let stage;
    if (MATRIX[op]) stage = { m: MATRIX[op](amount) };
    else if (op === "brightness") stage = { t: linearTable(Math.max(0, amount), 0) };
    else if (op === "contrast") {
      const c = Math.max(0, amount);
      stage = { t: linearTable(c, 0.5 - 0.5 * c) };
    } else throw new Error(`Filtro desconocido: ${op}`);
    const prev = stages[stages.length - 1];
    // dos tablas seguidas = una sola (exacto: las dos van de 8 bits a 8 bits)
    if (stage.t && prev?.t) prev.t = prev.t.map((v) => stage.t[v]);
    else stages.push(stage);
  }
  return stages;
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Aplica `ops` ([{op, amount}], en orden) con la semántica de los filtros CSS:
 * cada función se recorta a [0, 255] antes de la siguiente. RGB sin
 * premultiplicar; el alfa no se toca. En el lugar; devuelve `img`.
 */
export function applyColorOps(img, ops) {
  const stages = compile(ops);
  const d = img.data;
  const n = d.length;
  if (!stages.length) return img;

  if (stages.length === 1 && stages[0].t) {
    const t = stages[0].t;
    for (let i = 0; i < n; i += 4) {
      d[i] = t[d[i]];
      d[i + 1] = t[d[i + 1]];
      d[i + 2] = t[d[i + 2]];
    }
    return img;
  }

  // arrays planos: el bucle por píxel no toca objetos
  const S = stages.length;
  const isM = new Uint8Array(S);
  const M = new Float64Array(S * 9);
  const T = new Uint8Array(S * 256);
  stages.forEach((s, k) => {
    if (s.m) {
      isM[k] = 1;
      M.set(s.m, k * 9);
    } else T.set(s.t, k * 256);
  });

  for (let i = 0; i < n; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    for (let k = 0; k < S; k++) {
      if (isM[k]) {
        const o = k * 9;
        const nr = M[o] * r + M[o + 1] * g + M[o + 2] * b;
        const ng = M[o + 3] * r + M[o + 4] * g + M[o + 5] * b;
        const nb = M[o + 6] * r + M[o + 7] * g + M[o + 8] * b;
        r = clamp255(nr);
        g = clamp255(ng);
        b = clamp255(nb);
      } else {
        const o = k * 256;
        r = T[o + ((r + 0.5) | 0)];
        g = T[o + ((g + 0.5) | 0)];
        b = T[o + ((b + 0.5) | 0)];
      }
    }
    d[i] = (r + 0.5) | 0;
    d[i + 1] = (g + 0.5) | 0;
    d[i + 2] = (b + 0.5) | 0;
  }
  return img;
}

// --------------------------------------------------------------- blur

// Por debajo de este sigma se usa el kernel gaussiano exacto: así lo hace
// Chrome y las 3 cajas se alejan (σ 2: máx |Δ| 11 con cajas, 2 con kernel).
const KERNEL_MAX_SIGMA = 3;
// columnas por franja en la pasada vertical: el bloque entra en caché
const STRIP = 64;
// desde este σ se desenfoca a escala 1/f (f = ⌊σ/8⌋, hasta MAX_DOWNSCALE): con
// menos de 8 px de σ a escala chica la interpolación se aleja del nativo (σ 8
// con f = 2: máx |Δ| 12, fuera de tolerancia)
const DOWNSCALE_MIN_SIGMA = 16;
const DOWNSCALE_SIGMA_PER_STEP = 8;
const MAX_DOWNSCALE = 8;

// Anchos de las 3 cajas según la spec de feGaussianBlur. [l, r] = cuántos
// píxeles toma a la izquierda y a la derecha.
function boxPasses(sigma) {
  const d = Math.floor((sigma * 3 * Math.sqrt(2 * Math.PI)) / 4 + 0.5);
  if (d % 2) {
    const h = (d - 1) / 2;
    return [[h, h], [h, h], [h, h]];
  }
  const h = d / 2;
  return [[h, h - 1], [h - 1, h], [h, h]];
}

function gaussKernel(sigma) {
  const rad = Math.ceil(3 * sigma);
  const k = new Float64Array(2 * rad + 1);
  let sum = 0;
  for (let j = -rad; j <= rad; j++) {
    // cuantizado: Math.exp puede diferir en el último bit entre motores y el
    // resultado tiene que ser el mismo en Chrome y en WebKit (F5)
    const w = Math.round(Math.exp((-j * j) / (2 * sigma * sigma)) * 1048576) / 1048576;
    k[j + rad] = w;
    sum += w;
  }
  for (let j = 0; j < k.length; j++) k[j] /= sum;
  return k;
}

// Caja sobre una línea de n píxeles con nc canales (3 o 4); bordes por
// extensión. Los canales van juntos en el mismo bucle: es el bucle caliente.
function boxLine(src, dst, n, nc, l, r) {
  const inv = 1 / (l + r + 1);
  const last = n - 1;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
  for (let i = -l; i <= r; i++) {
    const q = (i < 0 ? 0 : i > last ? last : i) * nc;
    s0 += src[q];
    s1 += src[q + 1];
    s2 += src[q + 2];
    if (nc === 4) s3 += src[q + 3];
  }
  for (let x = 0, o = 0; x < n; x++, o += nc) {
    dst[o] = s0 * inv;
    dst[o + 1] = s1 * inv;
    dst[o + 2] = s2 * inv;
    let a = x + r + 1, b = x - l;
    if (a > last) a = last;
    if (b < 0) b = 0;
    a *= nc;
    b *= nc;
    s0 += src[a] - src[b];
    s1 += src[a + 1] - src[b + 1];
    s2 += src[a + 2] - src[b + 2];
    if (nc === 4) {
      dst[o + 3] = s3 * inv;
      s3 += src[a + 3] - src[b + 3];
    }
  }
}

function kernelLine(src, dst, n, nc, k) {
  const rad = (k.length - 1) >> 1;
  const last = n - 1;
  for (let c = 0; c < nc; c++) {
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let j = -rad; j <= rad; j++) {
        const q = x + j;
        s += src[(q < 0 ? 0 : q > last ? last : q) * nc + c] * k[j + rad];
      }
      dst[x * nc + c] = s;
    }
  }
}

// Copia n píxeles RGBA (paso `step` en bytes) a una línea de nc canales, y vuelta.
function gather(d, o, step, line, lo, nc, n) {
  if (nc === 3) {
    for (let x = 0; x < n; x++, o += step, lo += 3) {
      line[lo] = d[o];
      line[lo + 1] = d[o + 1];
      line[lo + 2] = d[o + 2];
    }
  } else {
    for (let x = 0; x < n; x++, o += step, lo += 4) {
      line[lo] = d[o];
      line[lo + 1] = d[o + 1];
      line[lo + 2] = d[o + 2];
      line[lo + 3] = d[o + 3];
    }
  }
}

function scatter(line, lo, nc, d, o, step, n) {
  for (let x = 0; x < n; x++, o += step, lo += nc) {
    d[o] = line[lo];
    d[o + 1] = line[lo + 1];
    d[o + 2] = line[lo + 2];
    if (nc === 4) d[o + 3] = line[lo + 3];
  }
}

// Desenfoca una línea; devuelve el buffer que tiene el resultado.
function blurLine(a, b, n, nc, plan) {
  if (plan.kernel) {
    kernelLine(a, b, n, nc, plan.kernel);
    return b;
  }
  let src = a, dst = b;
  for (const [l, r] of plan.boxes) {
    boxLine(src, dst, n, nc, l, r);
    const t = src;
    src = dst;
    dst = t;
  }
  return src;
}

function blurFull(d, W, H, nc, plan) {
  // horizontal: fila por fila
  const A = new Float32Array(Math.max(W, H) * nc);
  const B = new Float32Array(Math.max(W, H) * nc);
  for (let y = 0; y < H; y++) {
    const o = y * W * 4;
    gather(d, o, 4, A, 0, nc, W);
    scatter(blurLine(A, B, W, nc, plan), 0, nc, d, o, 4, W);
  }

  // vertical: por franjas de columnas copiadas a un buffer contiguo por
  // columna (recorrer la imagen por columnas directo es 3× más lento: caché)
  const colLen = H * nc;
  const strip = new Float32Array(Math.min(STRIP, W) * colLen);
  const stride = W * 4;
  for (let x0 = 0; x0 < W; x0 += STRIP) {
    const sw = Math.min(STRIP, W - x0);
    for (let s = 0; s < sw; s++) gather(d, x0 * 4 + s * 4, stride, strip, s * colLen, nc, H);
    for (let s = 0; s < sw; s++) {
      const col = strip.subarray(s * colLen, (s + 1) * colLen);
      const res = blurLine(col, B, H, nc, plan);
      if (res !== col) col.set(res.subarray(0, colLen));
    }
    for (let s = 0; s < sw; s++) scatter(strip, s * colLen, nc, d, x0 * 4 + s * 4, stride, H);
  }
}

// Desenfoque a escala 1/f: promedio de bloques f×f, blur con σ/f y vuelta a
// tamaño completo con interpolación bilineal. Todo en Float32 a escala chica.
function blurDownscaled(d, W, H, nc, sigma, f) {
  const w = Math.ceil(W / f), h = Math.ceil(H / f);
  const small = new Float32Array(w * h * nc);
  const xcell = new Int32Array(W);
  for (let x = 0; x < W; x++) xcell[x] = ((x / f) | 0) * nc;
  const acc = new Float64Array(w * nc);
  for (let sy = 0; sy < h; sy++) {
    acc.fill(0);
    const y0 = sy * f, y1 = Math.min(H, y0 + f);
    for (let y = y0; y < y1; y++) {
      for (let x = 0, o = y * W * 4; x < W; x++, o += 4) {
        const q = xcell[x];
        acc[q] += d[o];
        acc[q + 1] += d[o + 1];
        acc[q + 2] += d[o + 2];
        if (nc === 4) acc[q + 3] += d[o + 3];
      }
    }
    for (let sx = 0; sx < w; sx++) {
      const n = (Math.min(W, (sx + 1) * f) - sx * f) * (y1 - y0);
      const q = sx * nc, o = (sy * w + sx) * nc;
      for (let c = 0; c < nc; c++) small[o + c] = acc[q + c] / n;
    }
  }

  // σ escalado tal cual: descontar la varianza del promedio y la interpolación
  // alejaba el resultado del nativo (σ 33: máx |Δ| 15, QA BUG-09 H-1)
  const ss = sigma / f;
  const plan = ss < KERNEL_MAX_SIGMA ? { kernel: gaussKernel(ss) } : { boxes: boxPasses(ss) };
  const A = new Float32Array(Math.max(w, h) * nc);
  const B = new Float32Array(Math.max(w, h) * nc);
  for (let y = 0; y < h; y++) {
    const line = small.subarray(y * w * nc, (y + 1) * w * nc);
    const res = blurLine(line, B, w, nc, plan);
    if (res !== line) line.set(res.subarray(0, w * nc));
  }
  for (let x = 0; x < w; x++) {
    gather(small, x * nc, w * nc, A, 0, nc, h);
    scatter(blurLine(A, B, h, nc, plan), 0, nc, small, x * nc, w * nc, h);
  }

  // bilineal: el píxel chico j representa el centro j·f + (f−1)/2
  const half = (f - 1) / 2;
  const hx0 = new Int32Array(W), hx1 = new Int32Array(W), ht = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const u = (x - half) / f, j = Math.floor(u);
    hx0[x] = Math.min(w - 1, Math.max(0, j)) * nc;
    hx1[x] = Math.min(w - 1, Math.max(0, j + 1)) * nc;
    ht[x] = u - j;
  }
  const rows = [new Float32Array(W * nc), new Float32Array(W * nc)];
  const rowIdx = [-1, -1];
  const hrow = (sy) => {
    if (rowIdx[0] === sy) return rows[0];
    if (rowIdx[1] === sy) return rows[1];
    // se pisa la fila que no se va a volver a usar (la de índice menor)
    const k = rowIdx[0] < rowIdx[1] ? 0 : 1;
    const out = rows[k], base = sy * w * nc;
    for (let x = 0, o = 0; x < W; x++, o += nc) {
      const a = base + hx0[x], b = base + hx1[x], t = ht[x];
      for (let c = 0; c < nc; c++) out[o + c] = small[a + c] + (small[b + c] - small[a + c]) * t;
    }
    rowIdx[k] = sy;
    return out;
  };
  for (let y = 0; y < H; y++) {
    const v = (y - half) / f, j = Math.floor(v), t = v - j;
    const r0 = hrow(Math.min(h - 1, Math.max(0, j)));
    const r1 = hrow(Math.min(h - 1, Math.max(0, j + 1)));
    for (let x = 0, o = y * W * 4, q = 0; x < W; x++, o += 4, q += nc) {
      d[o] = r0[q] + (r1[q] - r0[q]) * t;
      d[o + 1] = r0[q + 1] + (r1[q + 1] - r0[q + 1]) * t;
      d[o + 2] = r0[q + 2] + (r1[q + 2] - r0[q + 2]) * t;
      if (nc === 4) d[o + 3] = r0[q + 3] + (r1[q + 3] - r0[q + 3]) * t;
    }
  }
}

/**
 * Desenfoque gaussiano (sigma = el radio de `blur(Npx)` de CSS). σ < 3: kernel
 * exacto; si no, 3 cajas separables (costo independiente de σ); σ ≥ 16: a escala
 * 1/⌊σ/8⌋. Bordes por extensión (no se mezcla con transparente: sin orla). Alfa
 * premultiplicado por dentro para que lo transparente no tiña. En el lugar;
 * devuelve `img`. Memoria extra: líneas y una franja de columnas en Float32, o
 * la copia a escala 1/f (≤ 1× la imagen); nunca Float32 a resolución completa.
 */
export function gaussianBlur(img, sigma) {
  const { data: d, width: W, height: H } = img;
  if (!(sigma >= 0.5) || !Number.isFinite(sigma) || !W || !H) return img;
  const plan = sigma < KERNEL_MAX_SIGMA ? { kernel: gaussKernel(sigma) } : { boxes: boxPasses(sigma) };

  let opaque = true;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { opaque = false; break; }
  const nc = opaque ? 3 : 4;
  if (!opaque) {
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a !== 255) {
        const f = a / 255;
        d[i] *= f;
        d[i + 1] *= f;
        d[i + 2] *= f;
      }
    }
  }

  // σ grande: se desenfoca a escala reducida y se reescala (permitido por el
  // plan si cumple las tolerancias; Chrome hace lo mismo). Costo ÷ f².
  const f = sigma >= DOWNSCALE_MIN_SIGMA ? Math.min(MAX_DOWNSCALE, Math.floor(sigma / DOWNSCALE_SIGMA_PER_STEP)) : 1;
  if (f >= 2) blurDownscaled(d, W, H, nc, sigma, f);
  else blurFull(d, W, H, nc, plan);

  if (!opaque) {
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a === 0) d[i] = d[i + 1] = d[i + 2] = 0;
      else if (a !== 255) {
        const f = 255 / a;
        d[i] *= f;
        d[i + 1] *= f;
        d[i + 2] *= f;
      }
    }
  }
  return img;
}

// --------------------------------------------------------------- pixelado

/**
 * BUG-10: lado del bloque del pixelado, relativo al ancho REAL de la cara.
 * strength 10 → 18 bloques sobre la cara, 65 → 13, 100 → 10. Más de ~18 y la
 * cara empieza a ser reconocible (Harmon, 1973). Piso de 3 px.
 */
export function pixelBlockPx(faceW, strength) {
  const s = Math.min(100, Math.max(10, strength));
  const n = Math.round(18 - ((s - 10) / 90) * 8);
  return Math.max(3, faceW / n);
}

function gridEdges(len, s, o) {
  let k = Math.ceil(-o / s);
  while (Math.round(o + k * s) > 0) k--;
  const edges = [0];
  for (;; k++) {
    const e = Math.round(o + (k + 1) * s);
    if (e >= len) break;
    if (e > edges[edges.length - 1]) edges.push(e);
  }
  edges.push(len);
  return edges;
}

/**
 * Pixela `img` con bloques cuadrados de lado `s` anclados en (ox, oy): la
 * grilla arranca ahí y se extiende hacia los dos lados. Cada bloque toma el
 * promedio de su área ponderado por alfa (lo transparente no oscurece).
 */
export function pixelateBlocks(img, s, ox = 0, oy = 0) {
  const { data: d, width: W, height: H } = img;
  if (!W || !H || !(s > 0)) return img;
  const xs = gridEdges(W, s, ox), ys = gridEdges(H, s, oy);
  for (let yi = 0; yi < ys.length - 1; yi++) {
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const x0 = xs[xi], x1 = xs[xi + 1], y0 = ys[yi], y1 = ys[yi + 1];
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4, a = d[i + 3];
          sr += d[i] * a;
          sg += d[i + 1] * a;
          sb += d[i + 2] * a;
          sa += a;
        }
      const count = (x1 - x0) * (y1 - y0);
      const r = sa ? sr / sa : 0, g = sa ? sg / sa : 0, b = sa ? sb / sa : 0, a = sa / count;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
          d[i + 3] = a;
        }
    }
  }
  return img;
}

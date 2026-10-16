// Imagen sintética fija y hash para BUG-09 (F5). Sin DOM: la usan Jest (Node)
// y el arnés (Chrome y WebKit), así que el mismo valor dorado vale en los tres.

export function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rampas en R, G y B, las 8 esquinas del cubo RGB, ruido con semilla y una
// franja semitransparente (para que el camino premultiplicado también cuente).
export function syntheticPixels(W = 96, H = 80, seed = 7) {
  const rnd = mulberry32(seed);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (y < H / 4) {
        data[i] = (x * 255) / (W - 1);
        data[i + 1] = (y * 255) / (H / 4 - 1);
        data[i + 2] = 255 - (x * 255) / (W - 1);
      } else if (y < (H * 3) / 8) {
        const k = Math.floor((x * 8) / W);
        data[i] = (k & 1) * 255;
        data[i + 1] = ((k >> 1) & 1) * 255;
        data[i + 2] = ((k >> 2) & 1) * 255;
      } else {
        data[i] = Math.floor(rnd() * 256);
        data[i + 1] = Math.floor(rnd() * 256);
        data[i + 2] = Math.floor(rnd() * 256);
      }
      data[i + 3] = y >= H - 8 ? Math.floor((x * 255) / (W - 1)) : 255;
    }
  }
  return { data, width: W, height: H };
}

export const cloneImg = (img) => ({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height });

// FNV-1a de 32 bits sobre los bytes, en hex.
export function fnv1a(bytes, h = 0x811c9dc5) {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// La cadena más larga que arma la UI de Filtros (Vívido + 3 ajustes).
export const GOLDEN_OPS = [
  { op: "saturate", amount: 1.4 },
  { op: "contrast", amount: 1.08 },
  { op: "brightness", amount: 1.3 },
  { op: "contrast", amount: 1.4 },
  { op: "saturate", amount: 1.5 },
];

// Hash combinado de color + blur σ 2 (kernel exacto) + blur σ 16 (3 cajas).
export function pixelFiltersHash({ applyColorOps, gaussianBlur }) {
  const base = syntheticPixels();
  const a = fnv1a(applyColorOps(cloneImg(base), GOLDEN_OPS).data);
  const b = fnv1a(gaussianBlur(cloneImg(base), 2).data);
  const c = fnv1a(gaussianBlur(cloneImg(base), 16).data);
  return `${a}-${b}-${c}`;
}

// Valor dorado: sale del algoritmo commiteado. Si cambia el algoritmo, este
// test se rompe a propósito (y hay que re-medir F4 antes de actualizarlo).
export const GOLDEN_HASH = "pending";

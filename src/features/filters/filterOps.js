import { applyColorOps } from "../../lib/pixelFilters.js";

// Filtros y ajustes (GROW-23) como lista de operaciones que calcula
// pixelFilters, no como string de ctx.filter: Safari no lo implementa (BUG-09).

export const PRESET_OPS = {
  none: [],
  bw: [{ op: "grayscale", amount: 1 }],
  sepia: [{ op: "sepia", amount: 0.75 }],
  vivid: [{ op: "saturate", amount: 1.4 }, { op: "contrast", amount: 1.08 }],
  soft: [{ op: "contrast", amount: 0.92 }, { op: "brightness", amount: 1.04 }],
};

// Lado mayor de la vista previa: recalcularla a 12 MP en cada movimiento de un
// slider congelaría la UI; la descarga sí va a resolución completa.
export const PREVIEW_MAX_SIDE = 1280;

/** Preset y después brillo, contraste y saturación (en %), sin los neutros. */
export function buildOps(preset, brightness, contrast, saturation) {
  const ops = [...(PRESET_OPS[preset] || [])];
  if (brightness !== 100) ops.push({ op: "brightness", amount: brightness / 100 });
  if (contrast !== 100) ops.push({ op: "contrast", amount: contrast / 100 });
  if (saturation !== 100) ops.push({ op: "saturate", amount: saturation / 100 });
  return ops;
}

function sizeOf(source) {
  return [source.naturalWidth || source.width, source.naturalHeight || source.height];
}

/** Píxeles de `source` reescalada a lado mayor ≤ maxSide (sin agrandar). */
export function toImageData(source, maxSide = Infinity) {
  const [W, H] = sizeOf(source);
  const k = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Pinta en `canvas` una copia de `base` con las ops aplicadas (base no cambia). */
export function paintFiltered(canvas, base, ops) {
  const img = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
  applyColorOps(img, ops);
  if (canvas.width !== img.width) canvas.width = img.width;
  if (canvas.height !== img.height) canvas.height = img.height;
  canvas.getContext("2d").putImageData(img, 0, 0);
  return canvas;
}

/** Canvas nuevo con la fuente (a lado mayor ≤ maxSide) filtrada. */
export function renderFiltered(source, ops, maxSide = Infinity) {
  const base = toImageData(source, maxSide);
  const out = document.createElement("canvas");
  // la base ya es una copia propia: se filtra en el lugar, sin otro buffer de 48 MB
  applyColorOps(base, ops);
  out.width = base.width;
  out.height = base.height;
  out.getContext("2d").putImageData(base, 0, 0);
  return out;
}

// Motor de stickers: toma un PNG transparente (idealmente un recorte) y le
// agrega el "look sticker" — contorno de color uniforme + sombra opcional — y
// lo exporta con los tamaños/forma que piden WhatsApp y Telegram.
//
// El contorno se calcula con una transformada de distancia chamfer (3/4) hacia
// afuera del alfa: misma técnica que el finish del recorte, pero standalone.

/** Specs de destino. WhatsApp: WebP 512 (<100KB); Telegram: PNG 512. */
export const STICKER_TARGETS = {
  whatsapp: { id: "whatsapp", size: 512, format: "webp", quality: 0.9, ext: "webp" },
  telegram: { id: "telegram", size: 512, format: "png", quality: 1, ext: "png" },
  png: { id: "png", size: 512, format: "png", quality: 1, ext: "png" },
};

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/**
 * Renderiza el sticker en un canvas cuadrado de `size`.
 * opts: { size=512, padding=0.06, outline=true, outlineWidth=16 (px @512),
 *         outlineColor="#ffffff", shadow=false }
 */
export function renderSticker(source, opts = {}) {
  const {
    size = 512,
    padding = 0.06,
    outline = true,
    outlineWidth = 16,
    outlineColor = "#ffffff",
    shadow = false,
  } = opts;

  // el contorno y la sombra se dibujan hacia afuera: reservamos margen para que
  // no se corten contra el borde del lienzo
  const reserve = (outline ? outlineWidth : 0) + (shadow ? 14 : 0);
  const pad = size * padding + reserve;
  const avail = size - pad * 2;

  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  const s = Math.min(avail / sw, avail / sh);
  const dw = sw * s;
  const dh = sh * s;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;

  // arte recortado a su caja (sin el contorno) en un canvas de trabajo
  const art = makeCanvas(size, size);
  const actx = art.getContext("2d");
  actx.imageSmoothingEnabled = true;
  actx.imageSmoothingQuality = "high";
  actx.drawImage(source, dx, dy, dw, dh);

  const out = makeCanvas(size, size);
  const ctx = out.getContext("2d");
  const alpha = alphaOf(art);

  if (shadow) {
    const blurred = boxBlur(boxBlur(alpha, size, size, 6), size, size, 3);
    const img = new ImageData(size, size);
    for (let i = 0; i < blurred.length; i++) img.data[i * 4 + 3] = Math.round(blurred[i] * 0.3);
    ctx.drawImage(canvasFrom(img), 0, 6); // leve desplazamiento hacia abajo
  }

  if (outline && outlineWidth > 0) {
    const [r, g, b] = hexToRgb(outlineColor);
    const dist = distanceOutside(alpha, size, size); // unidades chamfer (≈3/px)
    const wpx = outlineWidth * 3;
    const img = new ImageData(size, size);
    for (let i = 0; i < dist.length; i++) {
      const a = Math.max(0, Math.min(1, (wpx + 3 - dist[i]) / 3)); // 1px de anti-alias
      if (a > 0) {
        const o = i * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = Math.round(a * 255);
      }
    }
    ctx.drawImage(canvasFrom(img), 0, 0);
  }

  ctx.drawImage(art, 0, 0);
  return out;
}

/** Renderiza y exporta como Blob según el target (whatsapp/telegram/png). */
export async function exportSticker(source, target, opts = {}) {
  const t = STICKER_TARGETS[target] || STICKER_TARGETS.png;
  const canvas = renderSticker(source, { ...opts, size: t.size });
  const mime = t.format === "webp" ? "image/webp" : "image/png";
  return await toBlob(canvas, mime, t.quality);
}

// ---------------------------------------------------------------- helpers

function makeCanvas(w, h) {
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

function canvasFrom(imageData) {
  const c = makeCanvas(imageData.width, imageData.height);
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

function alphaOf(canvas) {
  const { width, height } = canvas;
  const d = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const a = new Uint8ClampedArray(width * height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  return a;
}

function toBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/** Transformada de distancia chamfer (3/4) hacia afuera del alfa (>127 dentro). */
function distanceOutside(alpha, width, height) {
  const INF = 1e7;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = alpha[i] > 127 ? 0 : INF;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - width] + 3);
        if (x > 0) v = Math.min(v, d[i - width - 1] + 4);
        if (x < width - 1) v = Math.min(v, d[i - width + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let v = d[i];
      if (x < width - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < height - 1) {
        v = Math.min(v, d[i + width] + 3);
        if (x < width - 1) v = Math.min(v, d[i + width + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + width - 1] + 4);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Box blur separable del canal alfa (para la sombra). */
function boxBlur(src, width, height, r) {
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const div = r * 2 + 1;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, width - 1)];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = acc / div;
      acc += src[row + clamp(x + r + 1, 0, width - 1)] - src[row + clamp(x - r, 0, width - 1)];
    }
  }
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

// Análisis de color de una imagen — 100% en el cliente, sin dependencias.
//
// - extractPalette(): paleta dominante por median-cut (el algoritmo estándar
//   para cuantización de color; da una paleta diversa y representativa).
// - Helpers de conversión (hex/rgb/hsl), luminancia relativa (WCAG) y color de
//   texto legible sobre un fondo — usados por la UI de muestras.

export function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

// HSL a partir de rgb 0-255. Útil para mostrar el color en otro sistema.
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Luminancia relativa (WCAG 2.1) — para decidir el contraste del texto.
export function luminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

// Color de texto (negro/blanco) legible sobre un fondo rgb dado.
export function contrastText(r, g, b) {
  return luminance(r, g, b) > 0.36 ? "#10130a" : "#f5f7fa";
}

// ── median-cut ───────────────────────────────────────────────────────────────

function channelRanges(box) {
  const min = [255, 255, 255], max = [0, 0, 0];
  for (const p of box) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
    }
  }
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}

function widestChannel(box) {
  const r = channelRanges(box);
  let c = 0;
  if (r[1] > r[c]) c = 1;
  if (r[2] > r[c]) c = 2;
  return [c, r[c]];
}

function averageColor(box) {
  let r = 0, g = 0, b = 0;
  for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
  const n = box.length || 1;
  return [r / n, g / n, b / n];
}

// Devuelve hasta `count` colores dominantes de un ImageData.
// Descarta píxeles transparentes; submuestrea para acotar el costo.
export function extractPalette(imageData, count = 6) {
  const { data, width, height } = imageData;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 24000)); // ~24k muestras máx.
  const pixels = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < 125) continue; // ignora fondo transparente
    pixels.push([data[o], data[o + 1], data[o + 2]]);
  }
  if (pixels.length === 0) return [];

  let boxes = [pixels];
  // Divide siempre la caja con mayor rango de color hasta llegar a `count`.
  while (boxes.length < count) {
    let bestIdx = -1, bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const [, range] = widestChannel(boxes[i]);
      if (range > bestRange) { bestRange = range; bestIdx = i; }
    }
    if (bestIdx === -1 || bestRange <= 0) break; // no hay nada más que dividir
    const box = boxes[bestIdx];
    const [c] = widestChannel(box);
    box.sort((a, b) => a[c] - b[c]);
    const mid = box.length >> 1;
    boxes.splice(bestIdx, 1, box.slice(0, mid), box.slice(mid));
  }

  const pal = boxes
    .filter((b) => b.length)
    .map((b) => {
      const [r, g, b2] = averageColor(b);
      const R = Math.round(r), G = Math.round(g), B = Math.round(b2);
      return { r: R, g: G, b: B, hex: rgbToHex(R, G, B), weight: b.length };
    });
  // Orden agradable: por luminancia (de oscuro a claro).
  pal.sort((a, b) => luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b));
  return pal;
}

// Exporta la paleta a distintos formatos de texto para copiar/pegar.
export function paletteToText(palette, format) {
  const hexes = palette.map((c) => c.hex);
  switch (format) {
    case "css":
      return ":root {\n" + palette.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n") + "\n}";
    case "json":
      return JSON.stringify(hexes, null, 2);
    default:
      return hexes.join(", ");
  }
}

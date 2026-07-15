// Transformaciones de color de una imagen — 100% en el cliente.
//
// - themeFlip(): genera el tema opuesto (claro↔oscuro) invirtiendo la
//   luminosidad y conservando el tono. Ideal para capturas de UI.
// - extractColorsFromText(): saca los colores de un CSS / variables / config de
//   Tailwind / cualquier texto (hex, rgb(), hsl()).
// - recolorToPalette(): "gradient map" — remapea la imagen a una paleta de
//   referencia según la luminosidad de cada píxel.
//
// Las funciones devuelven un Uint8ClampedArray (los píxeles resultantes); la UI
// lo vuelca a un canvas con ctx.createImageData()+putImageData. Así son puras y
// testeables sin depender del constructor ImageData del navegador.

import { luminance, rgbToHex, hexToRgb } from "./palette.js";

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hsl2rgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Luminosidad media de la imagen (0..1), submuestreada.
export function avgLuminance(imageData) {
  const { data } = imageData;
  const step = Math.max(4, Math.floor(data.length / 4 / 8000) * 4);
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 8) continue;
    sum += luminance(data[i], data[i + 1], data[i + 2]);
    n++;
  }
  return n ? sum / n : 0;
}

// ¿Hay que invertir para llegar al tema pedido? "dark"/"light" solo invierten
// si hace falta (según la luminosidad media); "flip" siempre invierte.
export function shouldFlip(imageData, target) {
  if (target === "flip") return true;
  const isLight = avgLuminance(imageData) > 0.5;
  return target === "dark" ? isLight : !isLight;
}

// Genera el tema opuesto invirtiendo la luminosidad (L→1−L) y conservando tono
// y saturación. target: "dark" | "light" | "flip".
export function themeFlip(imageData, target = "dark") {
  const { data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  const flip = shouldFlip(imageData, target);
  for (let i = 0; i < data.length; i += 4) {
    if (!flip) {
      out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2];
    } else {
      const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
      const [r, g, b] = hsl2rgb(h, s, 1 - l);
      out[i] = r; out[i + 1] = g; out[i + 2] = b;
    }
    out[i + 3] = data[i + 3];
  }
  return out;
}

// Extrae colores de un texto CSS/Tailwind/cualquiera: hex (#rgb/#rrggbb/#rrggbbaa),
// rgb()/rgba() y hsl()/hsla(). Devuelve [{r,g,b,hex}] sin duplicados.
export function extractColorsFromText(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  const push = (r, g, b) => {
    const hex = rgbToHex(r, g, b);
    if (seen.has(hex)) return;
    seen.add(hex);
    out.push({ r, g, b, hex });
  };

  // hex
  for (const m of text.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const rgb = hexToRgb("#" + h.slice(0, 6));
    if (rgb) push(rgb.r, rgb.g, rgb.b);
  }
  // rgb() / rgba()
  for (const m of text.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/gi)) {
    push(Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]));
  }
  // hsl() / hsla()
  for (const m of text.matchAll(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/gi)) {
    const [r, g, b] = hsl2rgb((+m[1] % 360) / 360, +m[2] / 100, +m[3] / 100);
    push(r, g, b);
  }
  return out;
}

function rel(r, g, b) {
  return luminance(r, g, b);
}

// "Gradient map": ordena la paleta por luminosidad y remapea cada píxel según su
// luminosidad, interpolando entre los colores contiguos (sin bandas).
export function recolorToPalette(imageData, palette) {
  const { data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  if (!palette || palette.length === 0) {
    out.set(data);
    return out;
  }
  const ramp = palette
    .map((c) => ({ r: c.r, g: c.g, b: c.b, l: rel(c.r, c.g, c.b) }))
    .sort((a, b) => a.l - b.l);
  const n = ramp.length;
  for (let i = 0; i < data.length; i += 4) {
    const L = rel(data[i], data[i + 1], data[i + 2]);
    if (n === 1) {
      out[i] = ramp[0].r; out[i + 1] = ramp[0].g; out[i + 2] = ramp[0].b;
    } else {
      const p = L * (n - 1);
      const lo = Math.floor(p);
      const hi = Math.min(n - 1, lo + 1);
      const t = p - lo;
      out[i] = Math.round(ramp[lo].r + (ramp[hi].r - ramp[lo].r) * t);
      out[i + 1] = Math.round(ramp[lo].g + (ramp[hi].g - ramp[lo].g) * t);
      out[i + 2] = Math.round(ramp[lo].b + (ramp[hi].b - ramp[lo].b) * t);
    }
    out[i + 3] = data[i + 3];
  }
  return out;
}

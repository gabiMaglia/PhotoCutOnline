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

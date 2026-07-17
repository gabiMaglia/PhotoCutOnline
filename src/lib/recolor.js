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

// Inversión de luminosidad en OKLab (Björn Ottosson) en vez de HSL. La "L" de
// HSL no es perceptualmente uniforme —un amarillo y un azul con la misma L se
// ven con brillos muy distintos—, así que invertir L en HSL desbalancea los
// tonos. OKLab tiene una L que sí mide brillo percibido de forma consistente
// entre tonos, que es justo lo que hace falta para pasar una captura a modo
// oscuro sin virar los colores. (Investigación 2026-07-17: es el enfoque
// recomendado para dark-mode de UI/capturas, por encima de HSL y del truco
// CSS invert+hue-rotate, que oscurece de más.)

const srgb2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin2srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// sRGB 0..255 → OKLab {L,a,b} (L en 0..1)
function rgbToOklab(r, g, b) {
  const lr = srgb2lin(r / 255), lg = srgb2lin(g / 255), lb = srgb2lin(b / 255);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// OKLab {L,a,b} → sRGB [r,g,b] 0..255 (clamp implícito por Uint8ClampedArray)
function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = lin2srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = lin2srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = lin2srgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255)];
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

// Genera el tema opuesto invirtiendo la luminosidad perceptual (L de OKLab
// → 1−L) y conservando el color (a,b, o sea tono y croma). target: "dark" |
// "light" | "flip".
export function themeFlip(imageData, target = "dark") {
  const { data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  const flip = shouldFlip(imageData, target);
  for (let i = 0; i < data.length; i += 4) {
    if (!flip) {
      out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2];
    } else {
      const [L, a, b] = rgbToOklab(data[i], data[i + 1], data[i + 2]);
      const [r, g, bl] = oklabToRgb(1 - L, a, b);
      out[i] = r; out[i + 1] = g; out[i + 2] = bl;
    }
    out[i + 3] = data[i + 3];
  }
  return out;
}

// Extrae colores de un texto CSS/Tailwind/cualquiera: hex (#rgb/#rrggbb/#rrggbbaa),

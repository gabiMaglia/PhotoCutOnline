// Generación de un color scheme listo para dev a partir de una paleta —
// escalas 50–900 por rol (primary/secondary/accent/neutral) + tokens
// semánticos (success/warning/error/info), como variables CSS o config Tailwind.
// 100% local, sin dependencias.

import { rgbToHsl, hslToRgb, rgbToHex, luminance } from "./palette.js";

// Luminosidad objetivo por escalón (0–1). El tono y la saturación vienen del
// color base; en los escalones muy claros se baja un poco la saturación.
const STOPS = {
  50: 0.96, 100: 0.91, 200: 0.83, 300: 0.72, 400: 0.61,
  500: 0.5, 600: 0.42, 700: 0.34, 800: 0.26, 900: 0.17,
};

// Color promedio de la imagen (submuestreado). Devuelve {r,g,b,hex}.
export function imageAverage(imageData) {
  const { data } = imageData;
  const step = Math.max(4, Math.floor(data.length / 4 / 12000) * 4);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 8) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  if (!n) return { r: 0, g: 0, b: 0, hex: "#000000" };
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  return { r, g, b, hex: rgbToHex(r, g, b) };
}

// Cuánto corre la escala hacia la luminosidad del color base (0 = nada, 1 =
// del todo). 0.5 desplaza como máximo ±0.25 de luminosidad: suficiente para que
// una versión clara y una oscura den escalas visiblemente distintas, sin romper
// el barrido claro→oscuro que hace que la escala sea usable como token 50–900.
const L_BIAS = 0.5;

// Escala 50–900 a partir de un color base {r,g,b}, conservando el tono.
//
// El sesgo por luminosidad NO es cosmético: antes esta función tomaba sólo `h` y
// `s` y descartaba `l`, con las luminosidades fijas de STOPS. Como el modo Tema
// invierte EXACTAMENTE la luminosidad (conserva tono y saturación), la versión
// clara y la oscura de una misma imagen producían escalas IDÉNTICAS y el
// antes/después no reflejaba nada. Ahora la escala se corre hacia la luminosidad
// real del color base, así que una imagen oscura da una escala más oscura.
export function generateScale(rgb) {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const bias = (l / 100 - 0.5) * L_BIAS;
  const out = {};
  for (const [stop, L] of Object.entries(STOPS)) {
    // se acota para no aplastar los extremos contra el blanco/negro puro
    const Lb = Math.min(0.98, Math.max(0.04, L + bias));
    const sat = Lb > 0.9 ? Math.round(s * 0.8) : s;
    const c = hslToRgb(h, sat, Math.round(Lb * 100));
    out[stop] = rgbToHex(c.r, c.g, c.b);
  }
  return out;
}

function hueDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Asigna roles (primary/secondary/accent/neutral) desde la paleta por
// saturación y tonos distintos, y agrega escalas semánticas estándar.
export function buildScheme(palette) {
  if (!palette || palette.length === 0) return null;
  const withHsl = palette.map((c) => ({ ...c, ...rgbToHsl(c.r, c.g, c.b) }));
  const chromatic = withHsl.filter((c) => c.s > 15).sort((a, b) => b.s - a.s);
  const base = chromatic.length ? chromatic : withHsl;

  const primary = base[0];
  const distinct = (used) => base.find((c) => !used.some((u) => hueDist(u.h, c.h) < 40));
  const secondary = distinct([primary]) || base[1] || primary;
  const accent = distinct([primary, secondary]) || base[2] || secondary;
  const neutral = withHsl.slice().sort((a, b) => a.s - b.s)[0] || primary;

  return {
    primary: generateScale(primary),
    secondary: generateScale(secondary),
    accent: generateScale(accent),
    neutral: generateScale(neutral),
    success: generateScale({ r: 34, g: 197, b: 94 }),
    warning: generateScale({ r: 245, g: 158, b: 11 }),
    error: generateScale({ r: 239, g: 68, b: 68 }),
    info: generateScale({ r: 59, g: 130, b: 246 }),
  };
}

const ROLE_ORDER = ["primary", "secondary", "accent", "neutral", "success", "warning", "error", "info"];

// Variables CSS: :root { --color-primary-500: #…; } + alias semánticos.
export function schemeToCss(scheme) {
  if (!scheme) return "";
  const lines = [":root {"];
  for (const role of ROLE_ORDER) {
    const scale = scheme[role];
    if (!scale) continue;
    for (const stop of Object.keys(STOPS)) {
      lines.push(`  --color-${role}-${stop}: ${scale[stop]};`);
    }
  }
  // alias semánticos cómodos
  lines.push("");
  lines.push(`  --color-primary: var(--color-primary-500);`);
  lines.push(`  --color-bg: var(--color-neutral-50);`);
  lines.push(`  --color-surface: #ffffff;`);
  lines.push(`  --color-text: var(--color-neutral-900);`);
  lines.push("}");
  return lines.join("\n");
}

// Config de Tailwind (theme.extend.colors).
export function schemeToTailwind(scheme) {
  if (!scheme) return "";
  const roleLines = ROLE_ORDER.filter((r) => scheme[r]).map((role) => {
    const scale = scheme[role];
    const stops = Object.keys(STOPS).map((s) => `        ${s}: '${scale[s]}',`).join("\n");
    return `      ${role}: {\n${stops}\n      },`;
  });
  return (
    "// tailwind.config.js\n" +
    "module.exports = {\n" +
    "  theme: {\n" +
    "    extend: {\n" +
    "      colors: {\n" +
    roleLines.join("\n") +
    "\n      },\n    },\n  },\n};"
  );
}

export { luminance };

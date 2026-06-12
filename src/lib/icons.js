// Icon Studio — generación de sets de iconos de app en el navegador.
//
// Produce un ZIP con la estructura estándar de cada plataforma:
//   ios/AppIcon.appiconset/  (Contents.json universal de Xcode 14+ + legacy px)
//   android/mipmap-*/        (legacy + adaptive foreground + Play Store 512)
//   macos/AppIcon.iconset/   (listo para `iconutil -c icns`)
//   windows/app.ico          (ICO real con entradas PNG 16–256)
//   web/                     (favicons, PWA, apple-touch, maskable, manifest)
//
// El .ico se escribe a mano: cabecera ICONDIR + entradas con PNG embebido
// (formato soportado desde Windows Vista).

import { makeZip } from "./zip.js";

export const PLATFORMS = [
  {
    id: "ios",
    name: "iOS / iPadOS",
    detail: "appiconset + iOS 18 dark/tinted + legacy",
    count: 16,
  },
  {
    id: "android",
    name: "Android",
    detail: "mipmaps, adaptive, themed (13+), Play Store",
    count: 16,
  },
  {
    id: "macos",
    name: "macOS",
    detail: "AppIcon.iconset 16–1024 px (→ .icns)",
    count: 10,
  },
  {
    id: "windows",
    name: "Windows",
    detail: "app.ico multi-resolución 16–256 px",
    count: 7,
  },
  {
    id: "web",
    name: "Web / PWA",
    detail: "favicons, manifest, maskable, snippet HTML",
    count: 9,
  },
];

const IOS_LEGACY = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
const ANDROID_LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const ANDROID_ADAPTIVE = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const MACOS_SET = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const WEB_PNGS = [
  ["favicon-16.png", 16],
  ["favicon-32.png", 32],
  ["favicon-48.png", 48],
  ["apple-touch-icon-180.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];

/**
 * Dibuja el icono a un tamaño dado.
 * opts: { padding: 0..0.3, bg: null | "#rrggbb", radius: 0..0.5 }
 */
export function renderIcon(source, size, opts = {}) {
  const { padding = 0.08, radius = 0, variant = "normal" } = opts;
  // dark/tinted/monochrome van SIEMPRE sobre transparente (el SO pone el fondo)
  const bg = variant === "normal" ? opts.bg ?? null : null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (radius > 0) {
    const r = size * radius;
    ctx.beginPath();
    roundedRectPath(ctx, 0, 0, size, size, r);
    ctx.clip();
  }
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }

  const pad = size * padding;
  const avail = size - pad * 2;
  const s = Math.min(avail / source.width, avail / source.height);
  const dw = source.width * s;
  const dh = source.height * s;
  ctx.drawImage(source, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return applyVariant(c, variant);
}

/**
 * Variantes 2026 del arte:
 *  - "tinted" (iOS 18): escala de grises sobre transparente; el sistema tiñe.
 *  - "monochrome" (Android 13 themed): silueta blanca desde el canal alfa.
 * El arte llega como canvas YA compuesto (con margen) y fondo transparente.
 */
function applyVariant(canvas, variant) {
  if (variant !== "tinted" && variant !== "monochrome") return canvas;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (variant === "tinted") {
      const g = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = g;
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255; // silueta blanca, conserva alfa
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasToPngBytes(canvas) {
  // Síncrono vía dataURL: evita depender del scheduling de toBlob y para
  // iconos ≤1024px el coste extra es despreciable.
  const b64 = canvas.toDataURL("image/png").split(",")[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return Promise.resolve(out);
}

async function pngAt(source, size, opts) {
  return canvasToPngBytes(renderIcon(source, size, opts));
}

/** ICO con entradas PNG embebidas. pngs: [{size, data:Uint8Array}] */
export function makeIco(pngs) {
  const count = pngs.length;
  const header = new DataView(new ArrayBuffer(6));
  header.setUint16(0, 0, true);
  header.setUint16(2, 1, true); // tipo icono
  header.setUint16(4, count, true);

  const dirSize = 16 * count;
  let offset = 6 + dirSize;
  const dirs = [];
  for (const { size, data } of pngs) {
    const d = new DataView(new ArrayBuffer(16));
    d.setUint8(0, size >= 256 ? 0 : size);
    d.setUint8(1, size >= 256 ? 0 : size);
    d.setUint8(2, 0); // sin paleta
    d.setUint8(3, 0);
    d.setUint16(4, 1, true); // planes
    d.setUint16(6, 32, true); // bpp
    d.setUint32(8, data.length, true);
    d.setUint32(12, offset, true);
    dirs.push(new Uint8Array(d.buffer));
    offset += data.length;
  }
  const parts = [new Uint8Array(header.buffer), ...dirs, ...pngs.map((p) => p.data)];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

const IOS_CONTENTS = JSON.stringify(
  {
    images: [
      { filename: "icon-1024.png", idiom: "universal", platform: "ios", size: "1024x1024" },
      {
        appearances: [{ appearance: "luminosity", value: "dark" }],
        filename: "icon-1024-dark.png",
        idiom: "universal",
        platform: "ios",
        size: "1024x1024",
      },
      {
        appearances: [{ appearance: "luminosity", value: "tinted" }],
        filename: "icon-1024-tinted.png",
        idiom: "universal",
        platform: "ios",
        size: "1024x1024",
      },
    ],
    info: { author: "photocut-studio", version: 1 },
  },
  null,
  2
);

/**
 * Recorta la imagen al bounding box de su contenido (alfa > 0): elimina los
 * márgenes transparentes para que el arte llene el lienzo del icono.
 * Devuelve un canvas recortado, o null si no hay margen que quitar.
 */
export function trimToContent(source) {
  const W = source.naturalWidth || source.width;
  const H = source.naturalHeight || source.height;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // imagen vacía
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (minX === 0 && minY === 0 && w === W && h === H) return null; // sin margen

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return out;
}

/** Snippet HTML listo para pegar (favicons + PWA). */
export function faviconSnippet() {
  return `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111317">`;
}

function webManifest(name) {
  return JSON.stringify(
    {
      name,
      short_name: name,
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      display: "standalone",
    },
    null,
    2
  );
}

const ZIP_README = `Iconos generados con PhotoCut Studio
=====================================

ios/AppIcon.appiconset/   Arrastra la carpeta a Assets.xcassets (Xcode 14+).
                          Incluye variantes iOS 18 dark y tinted.
ios/legacy/               PNGs sueltos por si usas tooling antiguo.
android/                  Copia los mipmap-* a app/src/main/res/.
                          play_store_512.png es el icono de Google Play.
                          ic_launcher_monochrome.png = themed icons (Android
                          13+): añade <monochrome> en tu adaptive-icon XML.
macos/AppIcon.iconset/    En macOS: iconutil -c icns macos/AppIcon.iconset
windows/app.ico           Úsalo directo como icono de la aplicación.
web/                      favicon.ico + PNGs + site.webmanifest para PWA.
                          snippet.html = etiquetas <link> listas para pegar.

Generado también disponible por CLI: make_icons.py (Python + Pillow).
`;

/**
 * Genera el ZIP completo.
 * source: canvas/imagen con el arte (idealmente PNG transparente cuadrado).
 * opts: { padding, bg, radius, platforms: Set<string>, appName }
 */
export async function buildIconZip(source, opts = {}) {
  const platforms = opts.platforms ?? new Set(PLATFORMS.map((p) => p.id));
  const appName = opts.appName || "Mi App";
  const render = { padding: opts.padding ?? 0.08, bg: opts.bg ?? null, radius: 0 };
  const enc = new TextEncoder();
  const files = [{ path: "app-icons/LEEME.txt", data: enc.encode(ZIP_README) }];

  if (platforms.has("ios")) {
    files.push({
      path: "app-icons/ios/AppIcon.appiconset/icon-1024.png",
      data: await pngAt(source, 1024, render),
    });
    // iOS 18: variantes dark (mismo arte, fondo transparente) y tinted
    // (escala de grises; el sistema aplica el tinte del usuario)
    files.push({
      path: "app-icons/ios/AppIcon.appiconset/icon-1024-dark.png",
      data: await pngAt(source, 1024, { ...render, variant: "dark" }),
    });
    files.push({
      path: "app-icons/ios/AppIcon.appiconset/icon-1024-tinted.png",
      data: await pngAt(source, 1024, { ...render, variant: "tinted" }),
    });
    files.push({
      path: "app-icons/ios/AppIcon.appiconset/Contents.json",
      data: enc.encode(IOS_CONTENTS),
    });
    for (const size of IOS_LEGACY) {
      files.push({
        path: `app-icons/ios/legacy/icon-${size}.png`,
        data: await pngAt(source, size, render),
      });
    }
  }

  if (platforms.has("android")) {
    for (const [dpi, size] of Object.entries(ANDROID_LEGACY)) {
      const data = await pngAt(source, size, render);
      files.push({ path: `app-icons/android/mipmap-${dpi}/ic_launcher.png`, data });
      files.push({
        path: `app-icons/android/mipmap-${dpi}/ic_launcher_round.png`,
        data: await pngAt(source, size, { ...render, radius: 0.5 }),
      });
    }
    for (const [dpi, size] of Object.entries(ANDROID_ADAPTIVE)) {
      // adaptive foreground: el arte debe ocupar la zona segura central (66/108)
      const fgOpts = { ...render, padding: 0.2 + render.padding * 0.5 };
      files.push({
        path: `app-icons/android/mipmap-${dpi}/ic_launcher_foreground.png`,
        data: await pngAt(source, size, fgOpts),
      });
      // Android 13+ themed icons: capa monochrome (silueta blanca)
      files.push({
        path: `app-icons/android/mipmap-${dpi}/ic_launcher_monochrome.png`,
        data: await pngAt(source, size, { ...fgOpts, variant: "monochrome" }),
      });
    }
    files.push({
      path: "app-icons/android/play_store_512.png",
      data: await pngAt(source, 512, render),
    });
  }

  if (platforms.has("macos")) {
    for (const [name, size] of MACOS_SET) {
      files.push({
        path: `app-icons/macos/AppIcon.iconset/${name}`,
        data: await pngAt(source, size, render),
      });
    }
  }

  if (platforms.has("windows")) {
    const pngs = [];
    for (const size of ICO_SIZES) {
      pngs.push({ size, data: await pngAt(source, size, render) });
    }
    files.push({ path: "app-icons/windows/app.ico", data: makeIco(pngs) });
  }

  if (platforms.has("web")) {
    for (const [name, size] of WEB_PNGS) {
      files.push({ path: `app-icons/web/${name}`, data: await pngAt(source, size, render) });
    }
    // maskable: zona segura del 20% y fondo obligatorio
    files.push({
      path: "app-icons/web/maskable-512.png",
      data: await pngAt(source, 512, {
        ...render,
        padding: Math.max(0.2, render.padding),
        bg: render.bg || "#111317",
      }),
    });
    const favPngs = [];
    for (const size of [16, 32, 48]) {
      favPngs.push({ size, data: await pngAt(source, size, render) });
    }
    files.push({ path: "app-icons/web/favicon.ico", data: makeIco(favPngs) });
    files.push({
      path: "app-icons/web/site.webmanifest",
      data: enc.encode(webManifest(appName)),
    });
    files.push({
      path: "app-icons/web/snippet.html",
      data: enc.encode(faviconSnippet() + "\n"),
    });
  }

  return makeZip(files);
}

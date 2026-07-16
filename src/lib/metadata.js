// Lectura de metadatos de una imagen — 100% en el cliente.
//
// - basicInfo(): datos del archivo (nombre, tipo, peso, dimensiones, fecha).
// - parseExif(): parser EXIF mínimo y DEFENSIVO para JPEG (marca, modelo,
//   fecha de captura, orientación, software y GPS). Ante cualquier byte
//   inesperado devuelve lo que haya podido leer, sin romper.
// - stripToBlob(): re-codifica la imagen en un canvas, lo que descarta todos
//   los metadatos (EXIF/GPS) — la base de "descargar sin metadatos".

export function basicInfo(file, img) {
  const kb = file.size / 1024;
  return {
    name: file.name,
    type: file.type || "—",
    size: kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(2)} MB`,
    bytes: file.size,
    width: img ? img.naturalWidth || img.width : undefined,
    height: img ? img.naturalHeight || img.height : undefined,
    modified: file.lastModified ? new Date(file.lastModified) : null,
  };
}

const ORIENTATION = {
  1: "Normal",
  2: "Espejo horizontal",
  3: "Rotada 180°",
  4: "Espejo vertical",
  5: "Espejo + 90° CW",
  6: "Rotada 90° CW",
  7: "Espejo + 90° CCW",
  8: "Rotada 90° CCW",
};

export function orientationLabel(n) {
  return ORIENTATION[n] || (n != null ? String(n) : undefined);
}

// ── Parser EXIF (JPEG) ───────────────────────────────────────────────────────

function ascii(view, tiff, type, num, valOff, le) {
  if (type !== 2) return undefined;
  const start = num <= 4 ? valOff : tiff + view.getUint32(valOff, le);
  let s = "";
  for (let i = 0; i < num; i++) {
    const ch = view.getUint8(start + i);
    if (ch === 0) break;
    s += String.fromCharCode(ch);
  }
  return s.trim() || undefined;
}

function rationals3(view, tiff, valOff, le) {
  const base = tiff + view.getUint32(valOff, le);
  const r = (o) => {
    const n = view.getUint32(o, le);
    const d = view.getUint32(o + 4, le);
    return d ? n / d : 0;
  };
  return [r(base), r(base + 8), r(base + 16)];
}

function readGps(view, tiff, ifd, le) {
  const u16 = (o) => view.getUint16(o, le);
  const u32 = (o) => view.getUint32(o, le);
  const count = u16(ifd);
  let latRef, lat, lngRef, lng;
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const num = u32(e + 4);
    const valOff = e + 8;
    if (tag === 1) latRef = ascii(view, tiff, 2, num, valOff, le);
    else if (tag === 3) lngRef = ascii(view, tiff, 2, num, valOff, le);
    else if (tag === 2) lat = rationals3(view, tiff, valOff, le);
    else if (tag === 4) lng = rationals3(view, tiff, valOff, le);
  }
  if (!lat || !lng) return null;
  const dec = (dms, ref) => {
    let v = dms[0] + dms[1] / 60 + dms[2] / 3600;
    if (ref === "S" || ref === "W") v = -v;
    return +v.toFixed(6);
  };
  return { lat: dec(lat, latRef), lng: dec(lng, lngRef) };
}

function readIfd(view, tiff, ifd, le, out) {
  const u16 = (o) => view.getUint16(o, le);
  const u32 = (o) => view.getUint32(o, le);
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const num = u32(e + 4);
    const valOff = e + 8;
    switch (tag) {
      case 0x010f: out.make = ascii(view, tiff, type, num, valOff, le); break;
      case 0x0110: out.model = ascii(view, tiff, type, num, valOff, le); break;
      case 0x0131: out.software = ascii(view, tiff, type, num, valOff, le); break;
      case 0x0112: out.orientation = u16(valOff); break;
      case 0x0132: if (!out.dateTime) out.dateTime = ascii(view, tiff, type, num, valOff, le); break;
      case 0x9003: out.dateTime = ascii(view, tiff, type, num, valOff, le); break; // DateTimeOriginal
      case 0x8769: readIfd(view, tiff, tiff + u32(valOff), le, out); break; // Exif IFD
      case 0x8825: out.gps = readGps(view, tiff, tiff + u32(valOff), le); break; // GPS IFD
      default: break;
    }
  }
}

function parseTiff(view, tiff) {
  const le = view.getUint16(tiff) === 0x4949; // "II" little-endian
  if (view.getUint16(tiff + 2, le) !== 0x002a) return null;
  const out = {};
  readIfd(view, tiff, tiff + view.getUint32(tiff + 4, le), le, out);
  return Object.keys(out).length ? out : null;
}

// Devuelve un objeto con los campos EXIF encontrados, o null si no hay/es
// ilegible. `buffer` es el ArrayBuffer del archivo.
export function parseExif(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return null; // no es JPEG
    const len = view.byteLength;
    let offset = 2;
    while (offset + 4 <= len) {
      if (view.getUint8(offset) !== 0xff) { offset++; continue; }
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1 && view.getUint32(offset + 4) === 0x45786966) {
        // "Exif" — el payload TIFF empieza tras "Exif\0\0"
        return parseTiff(view, offset + 10);
      }
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

// Formatos de salida soportados. `lossy` decide si el parámetro `quality` de
// canvas.toBlob hace algo: en PNG se IGNORA (es sin pérdida), así que exponer
// un control de calidad con PNG sería mentir. `alpha` decide si el formato
// conserva la transparencia.
export const OUTPUT_FORMATS = {
  png: { mime: "image/png", ext: "png", lossy: false, alpha: true },
  jpeg: { mime: "image/jpeg", ext: "jpg", lossy: true, alpha: false },
  webp: { mime: "image/webp", ext: "webp", lossy: true, alpha: true },
};

/**
 * ¿La imagen tiene algún píxel no opaco? Decide si convertir a un formato sin
 * alfa (JPG) destruye información y hay que avisar. Submuestrea: con encontrar
 * un solo píxel translúcido alcanza, y recorrer 12MP por cada cambio del
 * selector no vale la pena.
 */
export function hasTransparency(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return false;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return false; // canvas "sucio" (imagen de otro origen): no podemos saber
  }
  const step = Math.max(4, Math.floor((w * h) / 20000) * 4);
  for (let i = 3; i < data.length; i += step) if (data[i] < 255) return true;
  return false;
}

/**
 * Re-codifica la imagen en un canvas y devuelve un Blob. Al re-codificar se
 * descartan los metadatos (EXIF/GPS) — es intencional, es lo que hace
 * "descargar sin metadatos".
 *
 * opts: { format:'png'|'jpeg'|'webp', quality:0..1, background:'#rrggbb',
 *         width, height }
 *
 * `background` NO es cosmético: JPG no tiene canal alfa y, sin rellenar, el
 * canvas compone lo transparente sobre NEGRO. Un logo PNG transparente
 * convertido a JPG salía con fondo negro. Se rellena de blanco por defecto,
 * que es lo que espera cualquiera. En formatos con alfa (png/webp) no se
 * rellena nada: se conserva la transparencia.
 *
 * width/height (T-015): si se omiten, se usa el tamaño original. Redimensionar
 * y convertir en la misma pasada evita re-codificar dos veces (perder calidad
 * dos veces en los formatos con pérdida).
 */
export function reencodeToBlob(img, opts = {}) {
  const { format = "jpeg", quality = 0.92, background = "#ffffff", width, height } = opts;
  const fmt = OUTPUT_FORMATS[format] || OUTPUT_FORMATS.jpeg;
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width || srcW));
  canvas.height = Math.max(1, Math.round(height || srcH));
  const ctx = canvas.getContext("2d");
  if (!fmt.alpha) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // suavizado alto: al reducir mucho sin él aparece aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    // en PNG el 3er argumento se ignora; se pasa igual sin efecto
    canvas.toBlob(resolve, fmt.mime, fmt.lossy ? quality : undefined)
  );
}

/**
 * Calcula el tamaño de salida manteniendo la proporción del original.
 * `lock` decide qué lado manda; devuelve enteros ≥1 (un canvas de 0 no existe).
 */
export function fitSize(srcW, srcH, { width, height, lock = true }) {
  if (!srcW || !srcH) return { width: srcW || 1, height: srcH || 1 };
  const ratio = srcW / srcH;
  let w = width;
  let h = height;
  if (lock) {
    if (width && !height) h = Math.round(width / ratio);
    else if (height && !width) w = Math.round(height * ratio);
    else if (width && height) h = Math.round(width / ratio); // manda el ancho
  }
  return { width: Math.max(1, Math.round(w || srcW)), height: Math.max(1, Math.round(h || srcH)) };
}

/** Copia sin metadatos, en el formato original si se puede. */
export function stripToBlob(img, mime = "image/jpeg", quality = 0.92) {
  const format = Object.keys(OUTPUT_FORMATS).find((k) => OUTPUT_FORMATS[k].mime === mime) || "jpeg";
  return reencodeToBlob(img, { format, quality });
}

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

// Re-codifica la imagen en un canvas (descarta EXIF/GPS) y devuelve un Blob.
export function stripToBlob(img, mime = "image/jpeg", quality = 0.92) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

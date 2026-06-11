// Validación y preparación de archivos de imagen antes de cargarlos.
//
// Una foto de 48MP decodificada a RGBA son ~190MB de buffer; sin tope, el tab
// puede morir por memoria. Aquí se inspecciona el archivo UNA sola vez
// (createImageBitmap) y, si excede MAX_PIXELS, la UI ofrece reducirla a 4K.
// También se detecta HEIC (iPhone) para dar un mensaje claro en vez de un
// fallo críptico del decodificador.

export const MAX_PIXELS = 24_000_000; // 24MP
export const DOWNSCALE_MAX_DIM = 4096; // "reducir a 4K"

/**
 * Inspecciona el archivo. Devuelve:
 *  {kind:"heic"} | {kind:"undecodable"}
 *  {kind:"ok"|"oversized", bitmap, width, height}
 * El llamador es dueño del bitmap (debe .close() cuando termine).
 */
export async function inspectImageFile(file) {
  const name = (file.name || "").toLowerCase();
  if (/image\/hei[cf]/.test(file.type) || /\.hei[cf]$/.test(name)) {
    return { kind: "heic" };
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { kind: "undecodable" };
  }
  const { width, height } = bitmap;
  const kind = width * height > MAX_PIXELS ? "oversized" : "ok";
  return { kind, bitmap, width, height };
}

/**
 * Reduce el bitmap para que su lado mayor sea ≤ maxDim y lo devuelve como
 * dataURL. Conserva JPEG si la fuente era JPEG (sin alfa, pesa menos);
 * cualquier otra cosa sale como PNG para no perder transparencia.
 */
export function bitmapToDataUrl(bitmap, maxDim, sourceType) {
  const s = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const h = Math.max(1, Math.round(bitmap.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  const type = sourceType === "image/jpeg" ? "image/jpeg" : "image/png";
  return c.toDataURL(type, 0.92);
}

export function formatMegapixels(width, height) {
  return (width * height / 1e6).toFixed(1);
}

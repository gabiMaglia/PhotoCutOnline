// Presets de exportación para marketplaces y redes (N6 del roadmap).
// El motor recorta al bounding box del sujeto (acabado incluido) y lo encaja
// con el margen indicado, sin deformarlo. labelKey se traduce en la UI.
// `bg` es el fondo que la UI precarga en el selector (null = transparente);
// lo que se exporta es siempre lo que el selector tenga. `format` impone el
// formato de salida y `maxBytes` el peso máximo (se baja la calidad si hace falta).

export const EXPORT_PRESETS = [
  { id: "original", labelKey: "preset.original", preset: null },
  {
    id: "amazon",
    labelKey: "preset.amazon",
    preset: { w: 2000, h: 2000, padding: 0.05, bg: "#ffffff" },
  },
  {
    id: "etsy",
    labelKey: "preset.etsy",
    preset: { w: 2700, h: 2025, padding: 0.08, bg: "#ffffff" },
  },
  {
    id: "shopify",
    labelKey: "preset.shopify",
    preset: { w: 2048, h: 2048, padding: 0.06, bg: "#ffffff" },
  },
  {
    id: "ig-post",
    labelKey: "preset.igPost",
    preset: { w: 1080, h: 1080, padding: 0.08, bg: "#ffffff" },
  },
  {
    id: "ig-story",
    labelKey: "preset.igStory",
    preset: { w: 1080, h: 1920, padding: 0.12, bg: "#ffffff" },
  },
  {
    id: "avatar",
    labelKey: "preset.avatar",
    preset: { w: 512, h: 512, padding: 0.1, bg: null, circle: true },
  },
  {
    // WhatsApp pide WebP 512×512 de 100 KB como mucho, con margen alrededor
    id: "sticker-whatsapp",
    labelKey: "preset.stickerWhatsapp",
    preset: { w: 512, h: 512, padding: 0.08, bg: null, format: "webp", maxBytes: 100 * 1024 },
  },
  {
    // Telegram pide PNG con el lado mayor en 512: el cuadrado lo cumple
    id: "sticker-telegram",
    labelKey: "preset.stickerTelegram",
    preset: { w: 512, h: 512, padding: 0.04, bg: null, format: "png" },
  },
];

/**
 * Codifica con calidad decreciente hasta que el resultado pese ≤ maxBytes.
 * encode(quality) → Promise<{ url, bytes }>. Devuelve el último intento con
 * { quality, reduced, fits }; nunca baja de `min` (por debajo el sticker se
 * ve roto, preferimos avisar que no entra).
 */
export async function fitWithinBytes(encode, { maxBytes, quality = 0.92, min = 0.3, step = 0.1 }) {
  let q = quality;
  let r = await encode(q);
  // redondeo para no arrastrar 0.92 − 0.1 = 0.8200000001
  while (r.bytes > maxBytes && +(q - step).toFixed(2) >= min) {
    q = +(q - step).toFixed(2);
    r = await encode(q);
  }
  return { ...r, quality: q, reduced: q < quality, fits: r.bytes <= maxBytes };
}

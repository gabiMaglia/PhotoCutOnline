// Presets de exportación para marketplaces y redes (N6 del roadmap).
// El motor recorta al bounding box del sujeto (acabado incluido) y lo encaja
// con el margen indicado. labelKey se traduce en la UI.

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
];

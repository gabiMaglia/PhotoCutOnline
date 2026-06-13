/** Convierte "#rrggbb" a [r, g, b, 255] (el formato que espera el motor). */
export function hexToRgba(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255,
  ];
}

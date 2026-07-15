// Análisis de imagen — histograma y simulación de daltonismo (CVD). 100% local.

// Cuenta la distribución de valores por canal (0–255) y de luminancia.
export function computeHistogram(imageData) {
  const { data } = imageData;
  const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), luma = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    r[data[i]]++; g[data[i + 1]]++; b[data[i + 2]]++;
    const y = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    luma[y]++;
  }
  const max = (arr) => { let m = 0; for (let i = 0; i < 256; i++) if (arr[i] > m) m = arr[i]; return m; };
  return { r, g, b, luma, max: Math.max(max(r), max(g), max(b)) };
}

// Matrices de simulación de daltonismo (aproximación sobre sRGB, la habitual en
// herramientas web). achromatopsia = escala de grises por luminancia.
const CVD = {
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
};

export const CVD_TYPES = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"];

// Devuelve un Uint8ClampedArray con la imagen simulada para el tipo de CVD.
export function simulateCVD(imageData, type) {
  const { data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  if (type === "achromatopsia") {
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      out[i] = out[i + 1] = out[i + 2] = Math.round(y);
      out[i + 3] = data[i + 3];
    }
    return out;
  }
  const m = CVD[type] || CVD.deuteranopia;
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i], G = data[i + 1], B = data[i + 2];
    out[i] = Math.round(m[0] * R + m[1] * G + m[2] * B);
    out[i + 1] = Math.round(m[3] * R + m[4] * G + m[5] * B);
    out[i + 2] = Math.round(m[6] * R + m[7] * G + m[8] * B);
    out[i + 3] = data[i + 3];
  }
  return out;
}

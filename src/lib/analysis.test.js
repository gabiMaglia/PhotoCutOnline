import { computeHistogram, simulateCVD, CVD_TYPES } from "./analysis.js";

function img(pixels) {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 255], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  });
  return { data, width: pixels.length, height: 1 };
}

describe("computeHistogram", () => {
  it("cuenta los valores por canal", () => {
    const h = computeHistogram(img([[0, 0, 0], [255, 255, 255], [255, 0, 0]]));
    expect(h.r[255]).toBe(2); // dos píxeles con R=255
    expect(h.r[0]).toBe(1);
    expect(h.b[255]).toBe(1);
    expect(h.max).toBeGreaterThanOrEqual(2);
  });
  it("ignora los transparentes", () => {
    const h = computeHistogram(img([[10, 10, 10, 0], [20, 20, 20]]));
    expect(h.r[10]).toBe(0);
    expect(h.r[20]).toBe(1);
  });
});

describe("simulateCVD", () => {
  it("achromatopsia deja los tres canales iguales (gris)", () => {
    const out = simulateCVD(img([[255, 0, 0]]), "achromatopsia");
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });
  it("protanopia transforma el rojo puro", () => {
    const out = simulateCVD(img([[255, 0, 0]]), "protanopia");
    expect([out[0], out[1], out[2]]).not.toEqual([255, 0, 0]);
    expect(out[3]).toBe(255);
  });
  it("cubre todos los tipos sin romper y preserva longitud/alfa", () => {
    for (const type of CVD_TYPES) {
      const out = simulateCVD(img([[120, 200, 60, 200]]), type);
      expect(out.length).toBe(4);
      expect(out[3]).toBe(200);
    }
  });
});

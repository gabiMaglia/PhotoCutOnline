import { applyColorOps, gaussianBlur, pixelBlockPx, pixelateBlocks } from "./pixelFilters.js";
import { mulberry32, pixelFiltersHash, GOLDEN_HASH } from "../../test/fixtures/pixelFixture.js";

// BUG-09/BUG-10: matemática pura de los filtros propios (Filter Effects Level 1).
// La equivalencia con el ctx.filter nativo y entre motores la mide el arnés
// (test/filters-test.jsx, F4/F5); acá van los valores exactos de la spec.

const img = (w, h, fill) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill(i % w, Math.floor(i / w)), i * 4);
  return { data, width: w, height: h };
};
const px = (rgba) => img(1, 1, () => rgba);
const one = (rgba, ops) => Array.from(applyColorOps(px(rgba), ops).data);
const near = (got, want, tol = 1) => got.every((v, i) => Math.abs(v - want[i]) <= tol);

describe("applyColorOps", () => {
  it("brightness 1,5 sobre gris 128 da 192", () => {
    expect(one([128, 128, 128, 255], [{ op: "brightness", amount: 1.5 }])).toEqual([192, 192, 192, 255]);
  });

  it("contrast 0,5: negro → 64 y blanco → 191 (±1)", () => {
    const c = [{ op: "contrast", amount: 0.5 }];
    expect(near(one([0, 0, 0, 255], c), [64, 64, 64, 255])).toBe(true);
    expect(near(one([255, 255, 255, 255], c), [191, 191, 191, 255])).toBe(true);
  });

  it("grayscale(1) de rojo puro da (54,54,54)", () => {
    expect(near(one([255, 0, 0, 255], [{ op: "grayscale", amount: 1 }]), [54, 54, 54, 255])).toBe(true);
  });

  it("sepia(1) de blanco da (255,255,239): matriz de la spec con recorte", () => {
    expect(near(one([255, 255, 255, 255], [{ op: "sepia", amount: 1 }]), [255, 255, 239, 255])).toBe(true);
  });

  it("saturate(0) usa sus propios coeficientes (0,213/0,715/0,072)", () => {
    // rojo: 0,213·255 = 54,3; verde: 0,715·255 = 182,3; azul: 0,072·255 = 18,4
    expect(near(one([255, 0, 0, 255], [{ op: "saturate", amount: 0 }]), [54, 54, 54, 255])).toBe(true);
    expect(near(one([0, 255, 0, 255], [{ op: "saturate", amount: 0 }]), [182, 182, 182, 255])).toBe(true);
    expect(near(one([0, 0, 255, 255], [{ op: "saturate", amount: 0 }]), [18, 18, 18, 255])).toBe(true);
  });

  it("el orden importa cuando el recorte actúa entre etapas", () => {
    const b = { op: "brightness", amount: 1.5 };
    const c = { op: "contrast", amount: 0.5 };
    // 220·1,5 satura a 255 → contraste 191; al revés 0,5·220+63,75 = 173 → ·1,5 = 260 → 255
    expect(one([220, 220, 220, 255], [b, c])).not.toEqual(one([220, 220, 220, 255], [c, b]));
  });

  it("deja el alfa intacto", () => {
    const out = one([200, 100, 50, 77], [
      { op: "sepia", amount: 0.75 },
      { op: "brightness", amount: 1.3 },
      { op: "contrast", amount: 1.4 },
      { op: "saturate", amount: 2 },
    ]);
    expect(out[3]).toBe(77);
  });

  it("modifica en el lugar y devuelve la misma imagen", () => {
    const im = px([10, 20, 30, 255]);
    expect(applyColorOps(im, [{ op: "brightness", amount: 2 }])).toBe(im);
    expect(Array.from(im.data)).toEqual([20, 40, 60, 255]);
  });

  it("rechaza una operación desconocida", () => {
    expect(() => applyColorOps(px([0, 0, 0, 255]), [{ op: "hue-rotate", amount: 1 }])).toThrow();
  });
});

describe("gaussianBlur", () => {
  it.each([2, 16])("una imagen uniforme opaca queda igual, bordes incluidos (σ %d)", (s) => {
    const u = img(40, 30, () => [90, 140, 200, 255]);
    gaussianBlur(u, s);
    for (let i = 0; i < u.data.length; i += 4) expect([...u.data.subarray(i, i + 4)]).toEqual([90, 140, 200, 255]);
  });

  it("una imagen uniforme semitransparente queda igual (bordes por extensión, no transparentes)", () => {
    const u = img(30, 30, () => [90, 140, 200, 128]);
    gaussianBlur(u, 6);
    for (let i = 0; i < u.data.length; i += 4) {
      expect(near([...u.data.subarray(i, i + 4)], [90, 140, 200, 128])).toBe(true);
    }
  });

  // con bordes extendidos la media se conserva mientras la imagen sea varias
  // veces más grande que σ (si no, los bordes pesan de más): por eso crece el lado
  it.each([[2, 64], [9, 128], [30, 400]])("conserva la media del ruido (±0,5, σ %d)", (s, side) => {
    const rnd = mulberry32(3);
    const n = img(side, (side * 3) / 4, () => [rnd() * 256, rnd() * 256, rnd() * 256, 255]);
    const mean = (d) => {
      let t = 0;
      for (let i = 0; i < d.length; i += 4) t += d[i] + d[i + 1] + d[i + 2];
      return t / ((d.length / 4) * 3);
    };
    const before = mean(n.data);
    gaussianBlur(n, s);
    expect(Math.abs(mean(n.data) - before)).toBeLessThanOrEqual(0.5);
  });

  it("un píxel transparente no tiñe a sus vecinos (alfa premultiplicado)", () => {
    // verde opaco con una columna roja de alfa 0 en el medio
    const t = img(21, 5, (x) => (x === 10 ? [255, 0, 0, 0] : [0, 200, 0, 255]));
    gaussianBlur(t, 2);
    for (let i = 0; i < t.data.length; i += 4) {
      expect(t.data[i]).toBe(0); // nada de rojo en ningún lado
      if (t.data[i + 3] > 0) expect(Math.abs(t.data[i + 1] - 200)).toBeLessThanOrEqual(1);
    }
  });

  it("σ < 0,5 es un no-op exacto", () => {
    const rnd = mulberry32(9);
    const n = img(8, 8, () => [rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256]);
    const copy = Array.from(n.data);
    expect(gaussianBlur(n, 0.3)).toBe(n);
    expect(Array.from(n.data)).toEqual(copy);
  });

  it("desenfoca de verdad: un tablero pierde casi todo su contraste", () => {
    const b = img(64, 64, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
    gaussianBlur(b, 12);
    let mn = 255, mx = 0;
    for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) {
      const v = b.data[(y * 64 + x) * 4];
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
    expect(mx - mn).toBeLessThan(10);
  });
});

describe("pixelBlockPx (BUG-10)", () => {
  it("cara de 260 px: 18, 13 y 10 bloques sobre el ancho de la cara", () => {
    expect(pixelBlockPx(260, 10)).toBeCloseTo(260 / 18, 6);
    expect(pixelBlockPx(260, 65)).toBeCloseTo(20, 6);
    expect(pixelBlockPx(260, 100)).toBeCloseTo(26, 6);
  });

  it("nunca baja de 3 px (caras chicas: más censura, nunca menos)", () => {
    expect(pixelBlockPx(20, 10)).toBe(3);
    expect(pixelBlockPx(1, 100)).toBe(3);
  });

  it("más strength nunca da bloques más chicos", () => {
    let prev = 0;
    for (let s = 0; s <= 120; s += 5) {
      const b = pixelBlockPx(500, s);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });
});

describe("pixelateBlocks (BUG-10)", () => {
  it("cada celda es el promedio de su área y la grilla arranca en el ancla", () => {
    // franjas de 1 px: R = x·10. Ancla en x = 2, bloques de 4 px.
    const s = img(12, 4, (x) => [x * 10, 0, 0, 255]);
    pixelateBlocks(s, 4, 2, 0);
    const row = [];
    for (let x = 0; x < 12; x++) row.push(s.data[x * 4]);
    // celdas: [0,2) (antes del ancla), [2,6), [6,10), [10,12)
    expect(row).toEqual([5, 5, 35, 35, 35, 35, 75, 75, 75, 75, 105, 105]);
  });

  it("promedia pesando por alfa: un píxel transparente no oscurece el bloque", () => {
    const s = img(2, 1, (x) => (x === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]));
    pixelateBlocks(s, 2, 0, 0);
    expect(Array.from(s.data.subarray(0, 4))).toEqual([200, 100, 50, 128]);
  });
});

describe("F5 — hash dorado (mismo valor en Node, Chrome y WebKit)", () => {
  it("applyColorOps + gaussianBlur sobre la imagen sintética fija", () => {
    expect(pixelFiltersHash({ applyColorOps, gaussianBlur })).toBe(GOLDEN_HASH);
  });
});

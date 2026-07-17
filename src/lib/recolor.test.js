import { avgLuminance, shouldFlip, themeFlip } from "./recolor.js";

// ImageData sintético a partir de una lista de [r,g,b,(a)].
function img(pixels) {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 255], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  });
  return { data, width: pixels.length, height: 1 };
}

describe("avgLuminance / shouldFlip", () => {
  it("blanco ~1, negro ~0", () => {
    expect(avgLuminance(img([[255, 255, 255]]))).toBeGreaterThan(0.9);
    expect(avgLuminance(img([[0, 0, 0]]))).toBeLessThan(0.1);
  });
  it("target dark invierte solo si la imagen es clara", () => {
    expect(shouldFlip(img([[255, 255, 255]]), "dark")).toBe(true);
    expect(shouldFlip(img([[0, 0, 0]]), "dark")).toBe(false);
  });
  it("target light invierte solo si la imagen es oscura", () => {
    expect(shouldFlip(img([[0, 0, 0]]), "light")).toBe(true);
    expect(shouldFlip(img([[255, 255, 255]]), "light")).toBe(false);
  });
  it("flip siempre invierte", () => {
    expect(shouldFlip(img([[0, 0, 0]]), "flip")).toBe(true);
    expect(shouldFlip(img([[255, 255, 255]]), "flip")).toBe(true);
  });
});

describe("themeFlip", () => {
  it("blanco→negro cuando el objetivo es oscuro", () => {
    const out = themeFlip(img([[255, 255, 255]]), "dark");
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 0]);
  });
  it("negro→blanco cuando el objetivo es claro", () => {
    const out = themeFlip(img([[0, 0, 0]]), "light");
    expect([out[0], out[1], out[2]]).toEqual([255, 255, 255]);
  });
  it("conserva el tono al invertir la luminosidad (azul oscuro→azul claro)", () => {
    // #16213e (azul muy oscuro) con target dark: la imagen ya es oscura → no invierte
    const dark = themeFlip(img([[22, 33, 62]]), "dark");
    expect([dark[0], dark[1], dark[2]]).toEqual([22, 33, 62]);
    // con flip forzado sí invierte y sube la luminosidad manteniendo tono azulado
    const flipped = themeFlip(img([[22, 33, 62]]), "flip");
    expect(flipped[2]).toBeGreaterThan(flipped[0]); // sigue dominando el azul
    expect(flipped[0] + flipped[1] + flipped[2]).toBeGreaterThan(22 + 33 + 62); // más claro
  });
  it("preserva el alfa", () => {
    const out = themeFlip(img([[255, 255, 255, 128]]), "dark");
    expect(out[3]).toBe(128);
  });
});

describe("themeFlip: intensidad y mantener-acentos (A + B)", () => {
  const lum = (out) => 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];

  it("intensity 0 no cambia nada aunque toque invertir", () => {
    const out = themeFlip(img([[240, 240, 240]]), "dark", { intensity: 0 });
    expect([out[0], out[1], out[2]]).toEqual([240, 240, 240]);
  });

  it("intensity 0.5 queda a mitad de camino (más claro que la inversión total)", () => {
    const half = themeFlip(img([[245, 245, 245]]), "dark", { intensity: 0.5 });
    const full = themeFlip(img([[245, 245, 245]]), "dark", { intensity: 1 });
    expect(lum(half)).toBeGreaterThan(lum(full)); // no llegó hasta el negro
    expect(lum(half)).toBeLessThan(245); // pero sí oscureció algo
  });

  it("keepAccents: un neutro claro se invierte (oscurece)", () => {
    const out = themeFlip(img([[238, 238, 240]]), "dark", { keepAccents: true });
    expect(lum(out)).toBeLessThan(120); // gris claro → oscuro
  });

  it("keepAccents: un acento saturado casi no cambia su brillo", () => {
    const base = [220, 40, 40]; // rojo saturado
    const kept = themeFlip(img([base]), "flip", { keepAccents: true });
    const flipped = themeFlip(img([base]), "flip", { keepAccents: false });
    const lBase = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2];
    // con keepAccents el brillo se mantiene cerca del original…
    expect(Math.abs(lum(kept) - lBase)).toBeLessThan(40);
    // …mientras que sin keepAccents cambia bastante
    expect(Math.abs(lum(flipped) - lBase)).toBeGreaterThan(Math.abs(lum(kept) - lBase));
  });
});

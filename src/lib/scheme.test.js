import { imageAverage, generateScale, buildScheme, schemeToCss, schemeToTailwind } from "./scheme.js";

function img(pixels) {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 255], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  });
  return { data, width: pixels.length, height: 1 };
}

describe("imageAverage", () => {
  it("promedia los píxeles opacos", () => {
    expect(imageAverage(img([[0, 0, 0], [200, 100, 50]])).hex).toBe("#643219");
  });
  it("ignora los transparentes", () => {
    expect(imageAverage(img([[255, 255, 255], [0, 0, 0, 0]])).hex).toBe("#ffffff");
  });
});

describe("generateScale", () => {
  const scale = generateScale({ r: 47, g: 95, b: 208 }); // azul
  it("tiene los 10 escalones con hex válido", () => {
    const stops = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
    expect(Object.keys(scale)).toEqual(stops);
    stops.forEach((s) => expect(scale[s]).toMatch(/^#[0-9a-f]{6}$/));
  });
  it("50 es más claro que 900", () => {
    const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(scale["50"])).toBeGreaterThan(lum(scale["900"]));
  });
});

describe("buildScheme", () => {
  const palette = [
    { r: 47, g: 95, b: 208 }, // azul (saturado)
    { r: 214, g: 246, b: 75 }, // lima (saturado, otro tono)
    { r: 120, g: 120, b: 122 }, // gris (neutro)
  ];
  const scheme = buildScheme(palette);
  it("genera los roles con escalas completas", () => {
    ["primary", "secondary", "accent", "neutral", "success", "warning", "error", "info"].forEach((role) => {
      expect(scheme[role]).toBeDefined();
      expect(scheme[role]["500"]).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
  it("elige un neutro poco saturado", () => {
    // el 500 del neutral debería ser grisáceo (canales cercanos entre sí)
    const hex = scheme.neutral["500"];
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(60);
  });
  it("paleta vacía → null", () => {
    expect(buildScheme([])).toBeNull();
  });
});

describe("schemeToCss / schemeToTailwind", () => {
  const scheme = buildScheme([{ r: 47, g: 95, b: 208 }, { r: 214, g: 246, b: 75 }]);
  it("CSS incluye variables por rol y escalón + alias", () => {
    const css = schemeToCss(scheme);
    expect(css).toContain("--color-primary-500:");
    expect(css).toContain("--color-error-500:");
    expect(css).toContain("--color-primary: var(--color-primary-500);");
  });
  it("Tailwind incluye el objeto colors con los roles", () => {
    const tw = schemeToTailwind(scheme);
    expect(tw).toContain("colors: {");
    expect(tw).toContain("primary: {");
    expect(tw).toMatch(/500: '#[0-9a-f]{6}',/);
  });
});

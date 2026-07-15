import { rgbToHex, hexToRgb, rgbToHsl, contrastText, contrastRatio, wcagLevels, extractPalette, paletteToText } from "./palette.js";

describe("palette helpers", () => {
  it("convierte rgb↔hex ida y vuelta", () => {
    expect(rgbToHex(214, 246, 75)).toBe("#d6f64b");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    expect(hexToRgb("#d6f64b")).toEqual({ r: 214, g: 246, b: 75 });
    expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("no-hex")).toBeNull();
  });

  it("recorta y redondea los canales fuera de rango", () => {
    expect(rgbToHex(-5, 300, 127.6)).toBe("#00ff80");
  });

  it("calcula HSL de referencia", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
  });

  it("elige texto legible según el fondo", () => {
    expect(contrastText(255, 255, 255)).toBe("#10130a"); // sobre claro → oscuro
    expect(contrastText(0, 0, 0)).toBe("#f5f7fa"); // sobre oscuro → claro
  });
});

// Construye un ImageData sintético con `colors` repartidos en bloques.
function makeImageData(colors, side = 20) {
  const data = new Uint8ClampedArray(side * side * 4);
  const per = Math.floor((side * side) / colors.length);
  for (let i = 0; i < side * side; i++) {
    const [r, g, b, a = 255] = colors[Math.min(colors.length - 1, Math.floor(i / per))];
    const o = i * 4;
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
  }
  return { data, width: side, height: side };
}

describe("extractPalette", () => {
  it("devuelve arreglo vacío si todo es transparente", () => {
    const img = makeImageData([[10, 20, 30, 0]]);
    expect(extractPalette(img, 5)).toEqual([]);
  });

  it("separa colores bien distintos", () => {
    const img = makeImageData([[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
    const pal = extractPalette(img, 3);
    expect(pal).toHaveLength(3);
    // cada entrada trae hex y componentes
    for (const c of pal) {
      expect(c.hex).toMatch(/^#[\da-f]{6}$/);
      expect(c).toHaveProperty("r");
    }
  });

  it("no excede el número de colores pedido", () => {
    const img = makeImageData([[255, 0, 0], [0, 255, 0], [0, 0, 255], [200, 200, 0]]);
    expect(extractPalette(img, 2).length).toBeLessThanOrEqual(2);
  });

  it("ignora los píxeles transparentes al muestrear", () => {
    const img = makeImageData([[255, 0, 0], [0, 0, 0, 0]]);
    const pal = extractPalette(img, 4);
    // el negro transparente no debe aportar color
    expect(pal.every((c) => !(c.r === 0 && c.g === 0 && c.b === 0))).toBe(true);
  });
});

describe("contrastRatio / wcagLevels", () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  it("blanco sobre negro da el máximo 21:1", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });
  it("un color contra sí mismo da 1:1", () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });
  it("es simétrico", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(contrastRatio(white, black), 5);
  });
  it("clasifica niveles WCAG por umbral", () => {
    expect(wcagLevels(21)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: true, aaaLarge: true });
    expect(wcagLevels(4.5)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
    expect(wcagLevels(3)).toEqual({ aaNormal: false, aaLarge: true, aaaNormal: false, aaaLarge: false });
    expect(wcagLevels(1)).toEqual({ aaNormal: false, aaLarge: false, aaaNormal: false, aaaLarge: false });
  });
});

describe("paletteToText", () => {
  const pal = [{ hex: "#000000" }, { hex: "#ffffff" }];
  it("hex separado por comas", () => {
    expect(paletteToText(pal, "hex")).toBe("#000000, #ffffff");
  });
  it("variables CSS", () => {
    expect(paletteToText(pal, "css")).toContain("--color-1: #000000;");
  });
  it("json", () => {
    expect(JSON.parse(paletteToText(pal, "json"))).toEqual(["#000000", "#ffffff"]);
  });
});

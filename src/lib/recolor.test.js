import { avgLuminance, shouldFlip, themeFlip, extractColorsFromText, recolorToPalette } from "./recolor.js";

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

describe("extractColorsFromText", () => {
  it("saca hex de 6 y 3 dígitos sin duplicar", () => {
    const c = extractColorsFromText("a { color: #ffffff } b { color:#FFF } c{background:#d6f64b}");
    const hexes = c.map((x) => x.hex);
    expect(hexes).toContain("#ffffff");
    expect(hexes).toContain("#d6f64b");
    expect(hexes.filter((h) => h === "#ffffff").length).toBe(1);
  });
  it("parsea rgb() y hsl()", () => {
    const c = extractColorsFromText("x{color:rgb(255, 0, 0)} y{color:hsl(120, 100%, 50%)}");
    const hexes = c.map((x) => x.hex);
    expect(hexes).toContain("#ff0000");
    expect(hexes).toContain("#00ff00");
  });
  it("funciona con variables CSS y config de Tailwind (extrae los hex)", () => {
    const css = ":root{--bg:#0b0d10;--fg:#edf0e8;--accent:#d6f64b}";
    const tw = "colors:{ brand:{ 500:'#2f5fd0', 900:'#16213e' } }";
    expect(extractColorsFromText(css).length).toBe(3);
    expect(extractColorsFromText(tw).map((c) => c.hex)).toEqual(["#2f5fd0", "#16213e"]);
  });
  it("texto sin colores → vacío", () => {
    expect(extractColorsFromText("nada de colores aquí")).toEqual([]);
    expect(extractColorsFromText("")).toEqual([]);
  });
});

describe("recolorToPalette (gradient map)", () => {
  const pal = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }]; // negro→blanco
  it("mapea oscuro al color más oscuro y claro al más claro", () => {
    const out = recolorToPalette(img([[10, 10, 10], [245, 245, 245]]), pal);
    expect(out[0]).toBeLessThan(40); // píxel oscuro → cerca de negro
    expect(out[4]).toBeGreaterThan(215); // píxel claro → cerca de blanco
  });
  it("con un solo color, todo queda de ese color", () => {
    const out = recolorToPalette(img([[10, 10, 10], [200, 200, 200]]), [{ r: 214, g: 246, b: 75 }]);
    expect([out[0], out[1], out[2]]).toEqual([214, 246, 75]);
    expect([out[4], out[5], out[6]]).toEqual([214, 246, 75]);
  });
  it("paleta vacía → copia sin cambios", () => {
    const out = recolorToPalette(img([[10, 20, 30]]), []);
    expect([out[0], out[1], out[2]]).toEqual([10, 20, 30]);
  });
});

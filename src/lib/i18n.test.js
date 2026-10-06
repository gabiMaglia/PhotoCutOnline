import { t, tn, setLang } from "./i18n.js";

describe("tn — plurales (GROW-27 g)", () => {
  afterAll(() => setLang("es"));

  it.each([
    ["es", 1, "1 cara detectada"],
    ["es", 2, "2 caras detectadas"],
    ["es", 0, "0 caras detectadas"],
    ["en", 1, "1 face detected"],
    ["en", 3, "3 faces detected"],
    ["pt", 1, "1 rosto detectado"],
    ["pt", 4, "4 rostos detectados"],
  ])("faces.found en %s con n=%i", (lang, n, expected) => {
    setLang(lang);
    expect(tn("faces.found", n)).toBe(expected);
  });

  it.each([
    ["es", 1, "1 lista para descargar"],
    ["es", 5, "5 listas para descargar"],
    ["en", 1, "1 ready to download"],
    ["en", 2, "2 ready to download"],
    ["pt", 1, "1 pronta para baixar"],
    ["pt", 2, "2 prontas para baixar"],
  ])("batch.okCount en %s con n=%i", (lang, n, expected) => {
    setLang(lang);
    expect(tn("batch.okCount", n)).toBe(expected);
  });

  it("sin variantes .one/.other cae a la clave plana", () => {
    setLang("es");
    expect(tn("faces.title", 2)).toBe(t("faces.title"));
  });
});

describe("registro ES: voseo (GROW-27 d)", () => {
  // Lee el bloque ES del fuente: si alguien vuelve a escribir un imperativo de
  // tuteo ("Suelta", "Arrastra", "Usa"…), falla acá.
  const fs = require("fs");
  const src = fs.readFileSync(require("path").join(__dirname, "i18n.js"), "utf8");
  const es = src.slice(src.indexOf("  es: {"), src.indexOf("  en: {"));
  const TUTEO =
    /(?<![\p{L}])(Suelta|Suéltala|Arrastra|Pega|Usa|Abre|Dibuja|Prueba|Toca|Exporta|Afina|Crea|Quita|Mira|míralo|suéltalo|arrastra|pega|usa|abre|dibuja|prueba|toca|exporta|afina|crea|mira|pinta)(?![\p{L}])/u;

  it("no hay imperativos de tuteo en el diccionario ES", () => {
    const hits = es
      .split("\n")
      .filter((l) => TUTEO.test(l))
      // "WhatsApp usa…" / "se abre…" son 3.ª persona, no imperativo
      .filter((l) => !/WhatsApp usa|se abre/.test(l));
    expect(hits).toEqual([]);
  });
});

describe("variantes táctiles (GROW-27 D3)", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    setLang("es");
  });
  const coarse = (matches) => {
    window.matchMedia = jest.fn((q) => ({ matches: matches && q.includes("coarse") }));
  };
  const KEYS = ["empty.drag", "canvas.empty.body", "ob.1.body", "ob.2.body", "toast.bgSet"];

  it.each(["es", "en", "pt"])("en %s con pointer:coarse no se mencionan ⌘V ni atajos de letra", (lang) => {
    setLang(lang);
    coarse(true);
    for (const k of KEYS) expect(t(k)).not.toMatch(/⌘|\((A|P)\)/);
  });

  it("con puntero fino se conserva el texto con atajos", () => {
    setLang("es");
    coarse(false);
    expect(t("empty.drag")).toContain("⌘V");
    expect(t("ob.2.body")).toContain("(A)");
  });

  it("sin matchMedia (SSR/tests) usa el texto normal", () => {
    setLang("es");
    window.matchMedia = undefined;
    expect(t("empty.drag")).toContain("⌘V");
  });
});

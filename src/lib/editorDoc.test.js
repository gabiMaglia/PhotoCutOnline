import { localizeEditorDoc, EDITOR_DOC } from "./editorDoc.js";
import { TRUST } from "../../scripts/lib/trust.mjs";

const ES_TITLE = "Editor de fotos gratis en el navegador — PhotoCut Studio";
const ES_DOC = "<h1>Editor de fotos gratis en tu navegador</h1><p>Arrastrá una foto</p>";
const ES_FOOT = '<a href="/">PhotoCut Studio</a> · <a href="/acerca.html">Acerca</a>';

function fixture() {
  document.head.innerHTML = '<meta name="description" content="Editor de fotos gratis en español">';
  document.title = ES_TITLE;
  document.body.innerHTML = `<section class="ed-doc">${ES_DOC}</section><footer class="ed-foot">${ES_FOOT}</footer>`;
}

// palabras que NO existen en EN ni en PT; si aparecen, quedó texto en español
// ("navegador" o "Abrir foto" se excluyen a propósito: son PT válido)
const ES_MARKERS =
  /(?<![\p{L}])(gratis|tu navegador|Preguntas frecuentes|Qué|podés|Cómo|nunca se suben|Acerca|Contacto|Privacidad|Términos|Guías|Quitar el fondo|Arrastrá|Cargá|Pulsá|Elegí|Mirá|ningún|equipo|cuenta)(?![\p{L}])/iu;

describe("localizeEditorDoc (GROW-27 a)", () => {
  beforeEach(() => {
    fixture();
    localStorage.setItem("pc-lang", "en"); // elección explícita (el valor lo decide el argumento)
  });
  afterEach(() => localStorage.clear());

  it.each(["en", "pt"])("en %s no queda ninguna cadena en español visible", (lang) => {
    localizeEditorDoc(lang);
    const visible =
      document.title +
      " " +
      document.querySelector('meta[name="description"]').content +
      " " +
      document.querySelector(".ed-doc").textContent +
      " " +
      document.querySelector(".ed-foot").textContent;
    expect(visible).not.toMatch(ES_MARKERS);
    expect(document.title).toBe(EDITOR_DOC[lang].title);
    expect(document.querySelector(".ed-doc h1")).not.toBeNull();
  });

  it("en EN los enlaces apuntan a las versiones EN (guías, acerca, contacto)", () => {
    localizeEditorDoc("en");
    const hrefs = [...document.querySelectorAll(".ed-doc a, .ed-foot a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/en/guides/", "/en/about.html", "/en/contact.html"]));
    expect(hrefs).not.toContain("/guias/");
  });

  it.each(["en", "pt"])("(D1) el pie en %s trae los 5 enlaces de confianza de check-footers, en su idioma", (lang) => {
    localizeEditorDoc(lang);
    const hrefs = [...document.querySelectorAll(".ed-foot a")].map((a) => a.getAttribute("href"));
    for (const [href, label] of TRUST[lang]) {
      expect(hrefs).toContain(href);
      expect(document.querySelector(`.ed-foot a[href="${href}"]`).textContent).toBe(label);
    }
    expect(hrefs.some((h) => h.startsWith("/legal/") || h === "/acerca.html")).toBe(false);
  });

  it("volver a ES restaura el HTML estático original y el título", () => {
    localizeEditorDoc("en");
    localizeEditorDoc("es");
    expect(document.title).toBe(ES_TITLE);
    expect(document.querySelector(".ed-doc").innerHTML).toBe(ES_DOC);
    expect(document.querySelector(".ed-foot").innerHTML).toBe(ES_FOOT);
    expect(document.querySelector('meta[name="description"]').content).toBe("Editor de fotos gratis en español");
  });

  it("sin pc-lang y navigator.language=en-US el bloque ES queda intacto (autodetección no cuenta)", () => {
    localStorage.clear();
    const nav = jest.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
    try {
      localizeEditorDoc("en");
      expect(document.title).toBe(ES_TITLE);
      expect(document.querySelector(".ed-doc").innerHTML).toBe(ES_DOC);
      expect(document.querySelector(".ed-foot").innerHTML).toBe(ES_FOOT);
      expect(document.querySelector('meta[name="description"]').content).toBe("Editor de fotos gratis en español");
    } finally {
      nav.mockRestore();
    }
  });

  it("no rompe si la página no tiene el bloque (otras páginas)", () => {
    document.body.innerHTML = "";
    expect(() => localizeEditorDoc("en")).not.toThrow();
  });
});

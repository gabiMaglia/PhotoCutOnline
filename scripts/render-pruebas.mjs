// Genera el bloque "Lo probamos" (div.tried) de cada guía a partir de scripts/pruebas.json
// y lo inyecta entre <!-- pruebas:start --> y <!-- pruebas:end -->, en los tres idiomas.
//
//   node scripts/render-pruebas.mjs            # las 20 guías × (ES, EN, PT)
//   node scripts/render-pruebas.mjs <slug> …   # solo esos slugs (los ES del JSON)
//
// El JSON trae los datos crudos y las frases en ES; `i18n.en` / `i18n.pt` traducen
// title, tool, steps, findings y caveat sin tocar un solo número. Qué archivo EN/PT
// corresponde a cada slug ES sale de I18N_GROUPS (vite.config.js), no de una tabla aparte.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRUEBAS_JSON = path.join(ROOT, "scripts/pruebas.json");
export const START = "<!-- pruebas:start -->";
export const END = "<!-- pruebas:end -->";
export const LANGS = ["es", "en", "pt"];

export const LABELS = {
  es: {
    tried: "Lo probamos",
    image: "Imagen",
    noImage: "No usé ninguna imagen: las pruebas son sobre colores sueltos.",
    tool: "Herramienta",
    did: "Qué hice",
    measured: "Lo que medí",
    limit: "Qué salió mal o qué límite vi",
    by: "Probado por",
    on: "el",
    with: "con PhotoCut (web) en Chrome",
    build: "versión de PhotoCut",
    px: "px",
    dec: ",",
    synthetic: "imagen sintética que dibujé con Pillow",
    publicDomain: "retrato de dominio público",
    sample: "imagen de ejemplo de esta web",
  },
  en: {
    tried: "We tested it",
    image: "Image",
    noImage: "I didn't use any image: the tests are on loose colors.",
    tool: "Tool",
    did: "What I did",
    measured: "What I measured",
    limit: "What went wrong or what limit I saw",
    by: "Tested by",
    on: "on",
    with: "with PhotoCut (web) in Chrome",
    build: "PhotoCut version",
    px: "px",
    dec: ".",
    synthetic: "synthetic image I drew with Pillow",
    publicDomain: "public-domain portrait",
    sample: "sample image from this site",
  },
  pt: {
    tried: "Nós testamos",
    image: "Imagem",
    noImage: "Não usei nenhuma imagem: os testes são sobre cores soltas.",
    tool: "Ferramenta",
    did: "O que eu fiz",
    measured: "O que eu medi",
    limit: "O que deu errado ou que limite eu vi",
    by: "Testado por",
    on: "em",
    with: "com PhotoCut (web) no Chrome",
    build: "versão do PhotoCut",
    px: "px",
    dec: ",",
    synthetic: "imagem sintética que desenhei com o Pillow",
    publicDomain: "retrato de domínio público",
    sample: "imagem de exemplo deste site",
  },
};

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function imageNote(img, L) {
  if (img.src.includes("/pruebas/")) return L.synthetic;
  if (img.name === "quitar-fondo-antes.jpg") return L.publicDomain;
  return L.sample;
}

// Los números no se traducen: ES/PT con coma decimal, EN con punto.
export function textsFor(e, lang) {
  if (lang === "es") return { title: e.title, tool: e.tool, steps: e.steps, findings: e.findings, caveat: e.caveat };
  const tr = e.i18n?.[lang];
  if (!tr) throw new Error(`falta i18n.${lang}`);
  return { title: tr.title, tool: tr.tool, steps: tr.steps, findings: tr.findings, caveat: tr.caveat };
}

export function renderBlock(e, lang = "es") {
  const L = LABELS[lang];
  const T = textsFor(e, lang);
  const num = (n) => String(n).replace(".", L.dec);
  const img = e.image
    ? `<p><strong>${L.image}:</strong> <a href="${esc(e.image.src)}"><code>${esc(e.image.name)}</code></a>, ${e.image.w} × ${e.image.h} ${L.px}, ${num(e.image.kb)} KB (${imageNote(e.image, L)}).</p>`
    : `<p><strong>${L.image}:</strong> ${L.noImage}</p>`;
  const extra = (e.extraImages || [])
    .map((i) => `<p><a href="${esc(i.src)}"><code>${esc(i.name)}</code></a>, ${i.w} × ${i.h} ${L.px}, ${num(i.kb)} KB.</p>`)
    .join("");
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("\n          ");
  const lines = [
    START,
    `<div class="tried">`,
    `        <h3>${L.tried}: ${esc(T.title)}</h3>`,
    `        ${img}${extra}`,
    `        <p><strong>${L.tool}:</strong> ${esc(T.tool)}.</p>`,
    `        <p><strong>${L.did}:</strong></p>`,
    `        <ol>`,
    `          ${li(T.steps)}`,
    `        </ol>`,
    `        <p><strong>${L.measured}:</strong></p>`,
    `        <ul>`,
    `          ${li(T.findings)}`,
    `        </ul>`,
    `        <p class="limit"><strong>${L.limit}:</strong> ${esc(T.caveat)}</p>`,
    `        <p class="byline">${L.by} Gabriel Maglia ${L.on} <time datetime="${e.date}">${e.date}</time> ${L.with} ${esc(e.browser.replace(/^Chrome /, ""))} · ${esc(e.os)} · ${L.build}: commit ${esc(e.build)}.</p>`,
    `      </div>`,
    END,
  ];
  // la primera línea hereda la sangría del HTML original; el resto va a 6 espacios
  return lines.map((l, i) => (i === 0 ? l : l.startsWith("  ") ? l : "      " + l)).join("\n");
}

const TRIED_RE = /[ \t]*<div class="tried">[\s\S]*?<\/div>\n?(?:[ \t]*\n)?/;
const MARK_RE = new RegExp(`${START}[\\s\\S]*?${END}`);

// Con marcadores: reemplaza. Sin ellos (guías EN/PT viejas): saca el div.tried viejo y deja el
// bloque nuevo justo antes del último CTA, o sea después de la FAQ, igual que en ES.
export function injectBlock(html, block) {
  if (MARK_RE.test(html)) return html.replace(MARK_RE, () => block);
  let out = html.replace(TRIED_RE, "");
  const at = out.lastIndexOf('<a class="cta"');
  if (at < 0) throw new Error("la guía no tiene marcadores ni CTA donde insertar el bloque");
  return out.slice(0, at) + block + "\n\n      " + out.slice(at);
}

export function loadPruebas() {
  return JSON.parse(readFileSync(PRUEBAS_JSON, "utf8"));
}

// I18N_GROUPS vive en vite.config.js (sitemap + hreflang). Lo leo de ahí para no duplicarlo.
export function readI18nGroups() {
  const src = readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
  const m = src.match(/const I18N_GROUPS = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error("no encontré I18N_GROUPS en vite.config.js");
  return new Function(`return ${m[1]}`)();
}

const ES_DIR = "/guias/";

// slug ES → { es, en, pt } con la ruta de archivo de cada idioma (null si no hay par)
export function guideFiles(slug, groups = readI18nGroups()) {
  const g = groups.find((x) => x.es === `${ES_DIR}${slug}.html`);
  const file = (u) => (u ? path.join(ROOT, "public", u.replace(/^\//, "")) : null);
  return { es: file(`${ES_DIR}${slug}.html`), en: g ? file(g.en) : null, pt: g ? file(g.pt) : null };
}

export function guidePath(slug, lang = "es") {
  return guideFiles(slug)[lang];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const db = loadPruebas();
  const only = process.argv.slice(2);
  const groups = readI18nGroups();
  for (const [slug, e] of Object.entries(db)) {
    if (only.length && !only.includes(slug)) continue;
    if (!e.caveat) throw new Error(`${slug}: falta el caveat (qué salió mal / límite)`);
    const files = guideFiles(slug, groups);
    for (const lang of LANGS) {
      const f = files[lang];
      if (!f || !existsSync(f)) throw new Error(`${slug}: no hay guía ${lang}`);
      const html = readFileSync(f, "utf8");
      writeFileSync(f, injectBlock(html, renderBlock(e, lang)));
    }
    console.log("ok", slug);
  }
}

// Genera el bloque "Lo probamos" (div.tried) de cada guía a partir de scripts/pruebas.json
// y lo inyecta entre <!-- pruebas:start --> y <!-- pruebas:end -->.
//
//   node scripts/render-pruebas.mjs            # todas las guías del JSON
//   node scripts/render-pruebas.mjs <slug> …   # solo esas
//
// GROW-31b reutiliza renderBlock() para EN/PT: el JSON trae los datos crudos y las frases
// ya armadas en ES; para otro idioma se traducen `steps`, `findings` y `caveat`
// (y el LABELS de abajo) sin tocar ningún número.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRUEBAS_JSON = path.join(ROOT, "scripts/pruebas.json");
export const START = "<!-- pruebas:start -->";
export const END = "<!-- pruebas:end -->";

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
    synthetic: "imagen sintética que dibujé con Pillow",
    publicDomain: "retrato de dominio público",
    sample: "imagen de ejemplo de esta web",
  },
};

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n) => String(n).replace(".", ",");

function imageNote(img, L) {
  if (img.src.includes("/pruebas/")) return L.synthetic;
  if (img.name === "quitar-fondo-antes.jpg") return L.publicDomain;
  return L.sample;
}

export function renderBlock(e, lang = "es") {
  const L = LABELS[lang];
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
    `        <h3>${L.tried}: ${esc(e.title)}</h3>`,
    `        ${img}${extra}`,
    `        <p><strong>${L.tool}:</strong> ${esc(e.tool)}.</p>`,
    `        <p><strong>${L.did}:</strong></p>`,
    `        <ol>`,
    `          ${li(e.steps)}`,
    `        </ol>`,
    `        <p><strong>${L.measured}:</strong></p>`,
    `        <ul>`,
    `          ${li(e.findings)}`,
    `        </ul>`,
    `        <p class="limit"><strong>${L.limit}:</strong> ${esc(e.caveat)}</p>`,
    `        <p class="byline">${L.by} Gabriel Maglia ${L.on} <time datetime="${e.date}">${e.date}</time> ${L.with} ${esc(e.browser.replace(/^Chrome /, ""))} · ${esc(e.os)} · ${L.build}: commit ${esc(e.build)}.</p>`,
    `      </div>`,
    END,
  ];
  // la primera línea hereda la sangría del HTML original; el resto va a 6 espacios
  return lines.map((l, i) => (i === 0 ? l : l.startsWith("  ") ? l : "      " + l)).join("\n");
}

const TRIED_RE = /<div class="tried">[\s\S]*?<\/div>/;
const MARK_RE = new RegExp(`${START}[\\s\\S]*?${END}`);

export function injectBlock(html, block) {
  if (MARK_RE.test(html)) return html.replace(MARK_RE, () => block);
  if (!TRIED_RE.test(html)) throw new Error("la guía no tiene div.tried ni marcadores");
  return html.replace(TRIED_RE, () => block);
}

export function loadPruebas() {
  return JSON.parse(readFileSync(PRUEBAS_JSON, "utf8"));
}

export function guidePath(slug, lang = "es") {
  const dir = lang === "es" ? "public/guias" : lang === "en" ? "public/en/guides" : "public/pt/guias";
  return path.join(ROOT, dir, `${slug}.html`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const db = loadPruebas();
  const only = process.argv.slice(2);
  for (const [slug, e] of Object.entries(db)) {
    if (only.length && !only.includes(slug)) continue;
    if (!e.caveat) throw new Error(`${slug}: falta el caveat (qué salió mal / límite)`);
    const f = guidePath(slug);
    const html = readFileSync(f, "utf8");
    writeFileSync(f, injectBlock(html, renderBlock(e)));
    console.log("ok", slug);
  }
}

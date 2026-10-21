import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// GROW-39: fija el contrato SEO de las 5 páginas con impresiones. Lee public/ (la fuente)
// y src/lib/icons.js como texto: las cifras salen de lo que exporta Icon Studio.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const len = (s) => [...decode(s)].length;
const strip = (s) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

const meta = (html, attr, key) => {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? decode(m[1]) : null;
};
const title = (html) => strip(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
const h1 = (html) => strip(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
const ld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const ldOf = (html, type) => ld(html).find((d) => d["@type"] === type);
const crumbSpan = (html) => strip(html.match(/<nav class="crumbs"[\s\S]*?<span>([\s\S]*?)<\/span>/)[1]);
const answerParagraph = (html) => {
  const after = html.slice(html.indexOf("</h1>"));
  for (const m of after.matchAll(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/g)) {
    if (!/class="meta"/.test(m[1] || "")) return strip(m[2]);
  }
  return null;
};
const bodyOf = (html) => html.slice(html.indexOf("<h1"), html.indexOf("<footer"));
const CTA = 'href="/editor/?tab=icons"';

// --- set de medidas web derivado de icons.js ---
const icons = read("src/lib/icons.js");
const webPngs = (icons.match(/const WEB_PNGS = \[([\s\S]*?)\n\];/) || [])[1] || "";
const icoLoop = (icons.match(/for \(const size of \[([\d,\s]+)\]\) \{\s*favPngs/) || [])[1] || "";
const nums = (s) => [...s.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
const webSizes = new Set([...(webPngs.match(/,\s*(\d+)\]/g) || []).map((x) => Number(x.match(/\d+/)[0])), ...nums(icoLoop)]);
const allIconNums = new Set(nums(icons));
const EXPECTED = [16, 32, 48, 180, 192, 512];
const hasNum = (text, n) => new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(text);

test("set web derivado de icons.js = {16, 32, 48, 180, 192, 512}", () => {
  assert.ok(webSizes.size > 0, "no se pudo extraer WEB_PNGS/favicon.ico de src/lib/icons.js");
  assert.deepEqual([...webSizes].sort((a, b) => a - b), EXPECTED);
});

const FAV = [
  { lang: "es", f: "public/guias/favicons-medidas-y-html.html", term: ["tamaño", "favicon"] },
  { lang: "en", f: "public/en/guides/favicon-sizes-html.html", term: ["favicon size"] },
  { lang: "pt", f: "public/pt/guias/favicons-medidas-e-html.html", term: ["tamanho do favicon"] },
];

for (const { lang, f, term } of FAV) {
  const html = read(f);
  const T = title(html);
  const H = h1(html);
  const D = meta(html, "name", "description");

  test(`favicons ${lang}: title ≤ 60 y con los términos`, () => {
    assert.ok(len(T) <= 60, `title ${len(T)}: ${T}`);
    for (const t of term) assert.ok(T.toLowerCase().includes(t), `title sin «${t}»: ${T}`);
  });
  test(`favicons ${lang}: H1 con los términos`, () => {
    for (const t of term) assert.ok(H.toLowerCase().includes(t), `H1 sin «${t}»: ${H}`);
  });
  test(`favicons ${lang}: description ≤ 155 con 16, 32, 48, 180, 192 y 512`, () => {
    assert.ok(D && len(D) <= 155, `description ${D && len(D)}`);
    for (const n of EXPECTED) assert.ok(hasNum(D, n), `description sin ${n} px: ${D}`);
  });
  test(`favicons ${lang}: og/twitter/Article/breadcrumb coinciden con title, description y H1`, () => {
    assert.equal(meta(html, "property", "og:title"), T);
    const tw = (k) => meta(html, "name", k);
    if (tw("twitter:title") !== null) assert.equal(tw("twitter:title"), T);
    assert.equal(meta(html, "property", "og:description"), D);
    if (tw("twitter:description") !== null) assert.equal(tw("twitter:description"), D);
    const a = ldOf(html, "Article");
    assert.equal(a.description, D);
    assert.equal(a.headline, H);
    const items = ldOf(html, "BreadcrumbList").itemListElement;
    assert.equal(items[items.length - 1].name, H, "BreadcrumbList sin el H1");
    assert.equal(crumbSpan(html), H, "nav.crumbs sin el H1");
  });
  test(`favicons ${lang}: párrafo de respuesta de 1-2 frases con todo el set`, () => {
    const p = answerParagraph(html);
    const sentences = p.split(/[.!?]\s+/).filter(Boolean);
    assert.ok(sentences.length <= 2, `${sentences.length} frases: ${p}`);
    for (const n of EXPECTED) assert.ok(hasNum(p, n), `respuesta sin ${n}: ${p}`);
  });
  test(`favicons ${lang}: tabla antes de la figura y del primer h2, cifras del set y 6 archivos`, () => {
    const t = html.indexOf("<table");
    assert.ok(t > 0);
    assert.ok(t < html.indexOf("<figure"), "la tabla va antes de la figura");
    assert.ok(t < html.indexOf("<h2"), "la tabla va antes del primer h2");
    const table = html.slice(t, html.indexOf("</table>", t));
    for (const row of table.split("</tr>")) {
      const first = row.match(/<td>([\s\S]*?)<\/td>/);
      if (!first) continue;
      for (const n of nums(strip(first[1]))) assert.ok(webSizes.has(n), `cifra ${n} fuera de icons.js en la tabla`);
    }
    assert.equal((table.match(/<code>[^<]+\.(ico|png)<\/code>/g) || []).length, 6);
  });
  test(`favicons ${lang}: CTA a ?tab=icons entre la respuesta y la tabla, y al final`, () => {
    const count = html.split(CTA).length - 1;
    assert.ok(count >= 2, `CTA: ${count}`);
    const first = html.indexOf(CTA);
    assert.ok(first > html.indexOf("</h1>") && first < html.indexOf("<table"), "CTA superior mal ubicado");
    const ends = ['<section aria-labelledby="related-heading"', "<footer"].map((x) => html.indexOf(x)).filter((i) => i > 0);
    const bodyEnd = Math.min(...ends);
    const h2s = [...html.slice(0, bodyEnd).matchAll(/<h2/g)];
    assert.ok(html.lastIndexOf(CTA, bodyEnd) > h2s[h2s.length - 1].index, "CTA final antes del último h2");
  });
}

// --- fondo azul EN ---
test("blue-background: title, H1, description y CTA", () => {
  const html = read("public/en/tools/blue-background.html");
  const T = title(html);
  const D = meta(html, "name", "description");
  assert.ok(len(T) <= 60 && T.toLowerCase().includes("blue background photo"), T);
  assert.ok(h1(html).toLowerCase().includes("blue background photo"));
  assert.ok(len(D) <= 155 && D.toLowerCase().includes("blue background photo"), D);
  assert.equal(meta(html, "property", "og:description"), D);
  assert.equal(meta(html, "name", "twitter:description"), D);
  const p = answerParagraph(html);
  assert.ok(p.split(/[.!?]\s+/).filter(Boolean).length <= 2, p);
  const cta = html.indexOf('href="/editor/"');
  assert.ok(cta > html.indexOf("</h1>") && cta < html.indexOf("<h2"), "CTA antes del primer h2");
});

// --- medidas de iconos ES ---
test("medidas de iconos: title, H1, description y tabla resumen antes del CTA", () => {
  const html = read("public/guias/medidas-de-iconos-de-app-ios-android-2026.html");
  const T = title(html).toLowerCase();
  const D = meta(html, "name", "description");
  assert.ok(len(T) <= 60 && ["medidas", "iconos", "app"].every((w) => T.includes(w)), T);
  assert.ok(h1(html).toLowerCase().includes("medidas de iconos de app"));
  assert.ok(len(D) <= 155 && D.toLowerCase().includes("medidas de iconos de app"), D);
  for (const n of [1024, 192, 432, 512, 256]) assert.ok(hasNum(D, n), `description sin ${n}`);
  for (const n of nums(D).filter((x) => x !== 2026)) assert.ok(allIconNums.has(n), `${n} no está en icons.js`);
  const t = html.indexOf("<table");
  assert.ok(t < html.indexOf("<figure") && t < html.indexOf(CTA), "tabla resumen antes de la figura y del CTA");
  const table = html.slice(t, html.indexOf("</table>", t));
  assert.equal((table.match(/<tr>/g) || []).length, 6, "encabezado + 5 plataformas");
  for (const n of nums(strip(table))) assert.ok(allIconNums.has(n), `cifra ${n} de la tabla no está en icons.js`);
});

// --- sin texto pegado a etiquetas ---
const FIVE = [...FAV.map((x) => x.f), "public/en/tools/blue-background.html", "public/guias/medidas-de-iconos-de-app-ios-android-2026.html"];
for (const f of FIVE) {
  test(`${f}: sin texto pegado a una etiqueta en línea`, () => {
    const body = bodyOf(read(f)).replace(/<pre>[\s\S]*?<\/pre>/g, "");
    const bad = [...body.matchAll(/[\p{L}\d]<(strong|em|code|a)\b/gu)].map((m) => body.slice(m.index - 15, m.index + 20));
    assert.deepEqual(bad, []);
  });
}

// --- coherencia del número de archivos (6) ---
const CARDS = [
  "public/guias/index.html",
  "public/guias/medidas-de-iconos-de-app-ios-android-2026.html",
  "public/guias/foto-de-perfil-redonda.html",
  "public/guias/logo-con-fondo-transparente.html",
  "public/en/guides/index.html",
  "public/pt/guias/index.html",
];
for (const f of CARDS) {
  test(`${f}: la tarjeta de favicons dice 6 archivos`, () => {
    const m = read(f).match(/(\d+) (archivos que de verdad|files you really|arquivos de que)/);
    assert.ok(m, "no se encontró la frase de la tarjeta");
    assert.equal(Number(m[1]), 6);
  });
}
test("HowTo ES de favicons dice 6 archivos", () => {
  const how = ld(read("public/guias/favicons-medidas-y-html.html")).find((d) => d["@type"] === "HowTo");
  assert.match(how.step[0].text, /6 archivos/);
});
test("ningún html de public/ conserva la cuenta vieja de 5 archivos", () => {
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
    });
  const old = /5 archivos que de verdad|5 files you really|5 arquivos de que/;
  assert.deepEqual(walk(path.join(root, "public")).filter((p) => old.test(fs.readFileSync(p, "utf8"))), []);
});

// --- breadcrumb PT sin el título viejo ---
test("PT: ningún rastro del H1 viejo de favicons", () => {
  assert.ok(!read("public/pt/guias/favicons-medidas-e-html.html").includes("Favicons em 2026"));
});

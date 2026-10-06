import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDist } from "./ensure-dist.mjs";

// GROW-29: guardas de rendimiento sobre el build (dist/). Si no hay dist,
// lo construimos una vez para no depender del orden en que se corre `npm test`.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dist = ensureDist(root);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const pages = walk(dist).map((p) => ({
  rel: path.relative(dist, p).split(path.sep).join("/"),
  html: fs.readFileSync(p, "utf8"),
}));

// Páginas de confianza/legales: sin publicidad (no aportan y restan señal de calidad).
const NO_ADS = new Set([
  "404.html",
  "acerca.html", "contacto.html", "autor.html",
  "en/about.html", "en/contact.html", "en/author.html",
  "pt/sobre.html", "pt/contato.html", "pt/autor.html",
  "legal/privacidad.html", "legal/terminos.html",
  "en/legal/privacy.html", "en/legal/terms.html",
  "pt/legal/privacidade.html", "pt/legal/termos.html",
  "novedades.html", "en/changelog.html", "pt/novidades.html",
]);

test("el build contiene todas las páginas sin publicidad esperadas", () => {
  const rels = new Set(pages.map((p) => p.rel));
  for (const r of NO_ADS) assert.ok(rels.has(r), `falta ${r} en dist/`);
});

test("legales, contacto, acerca, autor y 404 no cargan adsbygoogle", () => {
  const bad = pages.filter((p) => NO_ADS.has(p.rel) && p.html.includes("adsbygoogle")).map((p) => p.rel);
  assert.deepEqual(bad, []);
});

test("ninguna página carga Google Fonts (fuentes autohospedadas)", () => {
  const bad = pages
    .filter((p) => /fonts\.googleapis|fonts\.gstatic/.test(p.html))
    .map((p) => p.rel);
  assert.deepEqual(bad, []);
});

test("AdSense nunca es un <script async src> estático (se inyecta tras load)", () => {
  const bad = pages
    .filter((p) => /<script[^>]*src=["'][^"']*adsbygoogle\.js/.test(p.html))
    .map((p) => p.rel);
  assert.deepEqual(bad, []);
});

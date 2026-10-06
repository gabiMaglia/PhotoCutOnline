import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDist } from "./lib/ensure-dist.mjs";

// GROW-32: las 60 guías llevan fechas REALES (datePublished = primer commit,
// dateModified = manifiesto lastmod) y la fecha visible coincide con dateModified.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = ensureDist(root);

const DIRS = ["guias", "en/guides", "pt/guias"];
const guides = DIRS.flatMap((d) =>
  fs
    .readdirSync(path.join(dist, d))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => ({ rel: `${d}/${f}`, html: fs.readFileSync(path.join(dist, d, f), "utf8") }))
);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const article = (html) => {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const d = JSON.parse(m[1]);
    if (d["@type"] === "Article") return d;
  }
  return null;
};

test("hay 60 guías (20 por idioma)", () => {
  assert.equal(guides.length, 60);
});

test("cada guía tiene datePublished ≤ dateModified, ISO válidas y publicadas desde 2026-06-01", () => {
  for (const { rel, html } of guides) {
    const a = article(html);
    assert.ok(a, `${rel}: sin Article JSON-LD`);
    assert.match(a.datePublished, ISO, `${rel}: datePublished`);
    assert.match(a.dateModified, ISO, `${rel}: dateModified`);
    assert.ok(!Number.isNaN(Date.parse(a.datePublished)) && !Number.isNaN(Date.parse(a.dateModified)), rel);
    assert.ok(a.datePublished <= a.dateModified, `${rel}: published > modified`);
    assert.ok(a.datePublished >= "2026-06-01", `${rel}: published anterior a 2026-06-01`);
  }
});

test("la fecha visible es un <time> con la misma fecha que dateModified y no queda texto viejo", () => {
  for (const { rel, html } of guides) {
    const a = article(html);
    const times = [...html.matchAll(/(Actualizado el|Updated on|Atualizado em) <time datetime="(\d{4}-\d{2}-\d{2})">([^<]+)<\/time>/g)];
    assert.equal(times.length, 1, `${rel}: debe haber exactamente una fecha visible "Actualizado el"`);
    assert.equal(times[0][2], a.dateModified.slice(0, 10), `${rel}: fecha visible ≠ dateModified`);
    assert.ok(!/(Actualizado|Updated|Atualizado): /.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), `${rel}: queda "Actualizado: mes año"`);
    assert.ok(!html.includes("data-updated"), `${rel}: marcador sin reemplazar`);
  }
});

test("la fecha larga visible está en el idioma de la página", () => {
  for (const { rel, html } of guides) {
    const lang = rel.startsWith("en/") ? "en" : rel.startsWith("pt/") ? "pt" : "es";
    const label = { es: "Actualizado el", en: "Updated on", pt: "Atualizado em" }[lang];
    assert.ok(html.includes(`${label} <time`), `${rel}: falta "${label}"`);
  }
});

test("las fechas no dependen de git: mismas que el manifiesto lastmod/published", () => {
  const lastmod = JSON.parse(fs.readFileSync(path.join(root, "scripts/lastmod.json"), "utf8"));
  const published = JSON.parse(fs.readFileSync(path.join(root, "scripts/published.json"), "utf8"));
  for (const { rel, html } of guides) {
    const src = `public/${rel}`;
    const a = article(html);
    assert.equal(a.dateModified, new Date(lastmod[src]).toISOString(), rel);
    assert.equal(a.datePublished, new Date(published[src]).toISOString(), rel);
  }
});

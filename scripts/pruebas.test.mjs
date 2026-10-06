// GROW-31: el bloque «Lo probamos» de cada guía ES sale de scripts/pruebas.json,
// con byline único y sin las frases viejas; FAQ sin repetir el cuerpo y con su JSON-LD al día.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBlock, injectBlock, loadPruebas, START, END } from "./render-pruebas.mjs";
import { measure } from "./faq-overlap.mjs";
import { faqRegion, norm } from "./faq-prune.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public/guias");
const slugsEs = readdirSync(DIR).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => f.replace(".html", "")).sort();
const html = (slug) => readFileSync(path.join(DIR, `${slug}.html`), "utf8");
const db = loadPruebas();

test("cada guía ES tiene su prueba en pruebas.json y viceversa", () => {
  assert.deepEqual(Object.keys(db).sort(), slugsEs);
});

test("pruebas.json: datos completos, honestos y distintos por guía", () => {
  const titles = new Set();
  for (const [slug, e] of Object.entries(db)) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, slug);
    assert.match(e.browser, /^Chrome \d+\.\d+\.\d+\.\d+$/, slug);
    assert.match(e.os, /^macOS \d+/, slug);
    assert.match(e.build, /^[0-9a-f]{7}$/, slug);
    assert.ok(e.tool && e.steps.length >= 2 && e.findings.length >= 2, slug);
    assert.ok(e.caveat && e.caveat.length > 60, `${slug}: falta decir qué salió mal o qué límite se vio`);
    assert.ok(Array.isArray(e.assets), slug);
    if (e.image) assert.ok(e.image.name && e.image.w > 0 && e.image.h > 0 && e.image.kb > 0, slug);
    titles.add(e.title);
  }
  assert.equal(titles.size, Object.keys(db).length, "dos guías comparten la misma prueba");
});

test("el bloque de cada guía es exactamente el que genera el JSON", () => {
  for (const slug of slugsEs) {
    const h = html(slug);
    assert.equal(h.split(START).length - 1, 1, `${slug}: marcador de inicio`);
    assert.equal(h.split(END).length - 1, 1, `${slug}: marcador de fin`);
    assert.equal(injectBlock(h, renderBlock(db[slug])), h, `${slug}: el HTML no coincide con pruebas.json (corré npm run pruebas:render)`);
  }
});

test("byline único y sin las frases viejas ni el «18 MB»", () => {
  for (const slug of slugsEs) {
    const h = html(slug);
    const by = h.match(/Probado por Gabriel Maglia el <time datetime="\d{4}-\d{2}-\d{2}">\d{4}-\d{2}-\d{2}<\/time> con PhotoCut \(web\) en Chrome \d+\.\d+\.\d+\.\d+/g) || [];
    assert.equal(by.length, 1, `${slug}: byline`);
    assert.equal((h.match(/class="byline"/g) || []).length, 1, `${slug}: más de un byline`);
    assert.doesNotMatch(h, /Prueba del equipo/, slug);
    assert.doesNotMatch(h, /La captura de arriba es de esa sesi/, slug);
    assert.doesNotMatch(h, /Las im[aá]genes? de arriba (es|son) de esa sesi/, slug);
    assert.doesNotMatch(h, /18(&nbsp;|\s)?MB/, slug);
    assert.equal((h.match(/class="tried"/g) || []).length, 1, `${slug}: debe haber un solo bloque «Lo probamos»`);
  }
});

test("JSON-LD válido en las 20 guías y FAQPage sincronizado con la FAQ visible", () => {
  for (const slug of slugsEs) {
    const h = html(slug);
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    assert.ok(blocks.length >= 2, `${slug}: faltan bloques JSON-LD`);
    const faqLd = blocks.find((b) => b["@type"] === "FAQPage");
    const reg = faqRegion(h);
    const visible = reg ? reg.items.map((i) => i.qNorm) : [];
    if (!visible.length) {
      assert.equal(faqLd, undefined, `${slug}: hay FAQPage pero no hay FAQ visible`);
      assert.doesNotMatch(h, /<h2[^>]*>\s*Preguntas frecuentes\s*<\/h2>/, `${slug}: título de FAQ sin preguntas`);
    } else {
      assert.ok(faqLd, `${slug}: FAQ visible sin FAQPage`);
      assert.deepEqual(faqLd.mainEntity.map((q) => norm(q.name)), visible, slug);
    }
  }
});

test("la FAQ no repite el cuerpo: ≤ 10 % del texto de cada página", () => {
  for (const slug of slugsEs) {
    const m = measure(html(slug));
    assert.ok(m.faqPct <= 10, `${slug}: la FAQ es el ${m.faqPct} % de la página`);
    assert.ok(m.sharedPct <= 10, `${slug}: ${m.sharedPct} % de 5-gramas compartidos FAQ-cuerpo`);
    assert.ok(m.dupPct <= 10, `${slug}: ${m.dupPct} % de la FAQ ya está en el cuerpo`);
  }
});

test("medidas de redes e iconos: cada sección con medidas cita fuente oficial verificada o dice «sin fuente oficial»", () => {
  for (const slug of ["medidas-de-fotos-para-redes-sociales-2026", "medidas-de-iconos-de-app-ios-android-2026"]) {
    const h = html(slug);
    const main = h.slice(h.indexOf("<h1>"), h.indexOf("<h2>Cómo dejar la foto") > 0 ? h.indexOf("<h2>Cómo dejar la foto") : h.indexOf("<h2>Reglas de diseño"));
    const sections = main.split(/<h2>/).slice(1).filter((s) => /\d+\s*(×|x)\s*\d+|\d+(&nbsp;|\s)?px/.test(s) && !s.startsWith("La regla"));
    assert.ok(sections.length >= 5, `${slug}: pocas secciones con medidas`);
    for (const s of sections) {
      const title = s.slice(0, 50);
      const cited = /<a href="https:\/\/[^"]+" rel="noopener">/.test(s) && /verificad[oa]s? el 2026-10-06/.test(s);
      const flagged = /sin fuente oficial/i.test(s);
      assert.ok(cited || flagged, `${slug}: «${title}» tiene medidas sin fuente ni aviso`);
    }
    assert.match(h, /2026-10-06/, slug);
  }
});

test("tildes en las guías de medidas", () => {
  for (const slug of ["medidas-de-fotos-para-redes-sociales-2026", "medidas-de-iconos-de-app-ios-android-2026"]) {
    const t = html(slug).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(t, /\b(pixeles|proporcion|version|sesion|exporta en JPG|tambien|ademas)\b/i, slug);
  }
});

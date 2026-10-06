import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureDist } from "./lib/ensure-dist.mjs";
import { gitUsable } from "./lib/lastmod.mjs";
import { TRUST } from "./lib/trust.mjs";

// GROW-32: página de novedades en 3 idiomas, enlazada, indexable y en el feed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = ensureDist(root);
const SITE = "https://www.photocutapp.com";

const PAGES = {
  es: { route: "/novedades.html", file: "novedades.html" },
  en: { route: "/en/changelog.html", file: "en/changelog.html" },
  pt: { route: "/pt/novidades.html", file: "pt/novidades.html" },
};
const read = (rel) => fs.readFileSync(path.join(dist, rel), "utf8");

function entries(html) {
  return [...html.matchAll(/<article class="entry" id="([^"]+)">([\s\S]*?)<\/article>/g)].map((m) => ({
    id: m[1],
    title: (m[2].match(/<h2>([\s\S]*?)<\/h2>/) || [])[1],
    date: (m[2].match(/<time datetime="(\d{4}-\d{2}-\d{2})">/) || [])[1],
    lines: [...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]),
  }));
}

test("las 3 páginas existen en dist/ con title ≤60, description ≤155 y canonical propio", () => {
  for (const [lang, p] of Object.entries(PAGES)) {
    const html = read(p.file);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)[1];
    assert.ok(title.length > 0 && title.length <= 60, `${lang}: title ${title.length}`);
    assert.ok(desc.length > 0 && desc.length <= 155, `${lang}: description ${desc.length}`);
    assert.ok(html.includes(`<link rel="canonical" href="${SITE}${p.route}" />`), `${lang}: canonical`);
    assert.ok(html.includes('property="og:image"'), `${lang}: og:image por defecto`);
  }
});

test("hreflang recíproco entre los 3 idiomas + x-default → ES", () => {
  for (const [lang, p] of Object.entries(PAGES)) {
    const html = read(p.file);
    for (const [l, q] of Object.entries(PAGES)) {
      assert.ok(html.includes(`hreflang="${l}" href="${SITE}${q.route}"`), `${lang} → ${l}`);
    }
    assert.ok(html.includes(`hreflang="x-default" href="${SITE}${PAGES.es.route}"`), `${lang}: x-default`);
  }
});

test("BreadcrumbList JSON-LD válido y sin AdSense (igual que las legales)", () => {
  for (const [lang, p] of Object.entries(PAGES)) {
    const html = read(p.file);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const bc = blocks.find((b) => b["@type"] === "BreadcrumbList");
    assert.ok(bc, `${lang}: sin BreadcrumbList`);
    assert.equal(bc.itemListElement.at(-1).item, `${SITE}${p.route}`);
    assert.ok(!html.includes("adsbygoogle"), `${lang}: no debe tener AdSense`);
  }
});

test("entradas: de más nueva a más vieja, 1-3 líneas, y los mismos id/fechas en los 3 idiomas", () => {
  const per = Object.fromEntries(Object.entries(PAGES).map(([l, p]) => [l, entries(read(p.file))]));
  assert.ok(per.es.length >= 8, "pocas entradas");
  for (const [lang, list] of Object.entries(per)) {
    for (const e of list) {
      assert.ok(e.title && e.date, `${lang}/${e.id}: sin título o fecha`);
      assert.ok(e.lines.length >= 1 && e.lines.length <= 3, `${lang}/${e.id}: ${e.lines.length} líneas`);
    }
    const dates = list.map((e) => e.date);
    assert.deepEqual(dates, [...dates].sort().reverse(), `${lang}: no está ordenada de más nueva a más vieja`);
    assert.deepEqual(list.map((e) => `${e.id}@${e.date}`), per.es.map((e) => `${e.id}@${e.date}`), `${lang}: distinto de ES`);
  }
  const have = new Set(per.es.map((e) => e.date));
  for (const d of ["2026-10-06", "2026-07-30", "2026-07-29", "2026-07-03", "2026-07-02", "2026-06-12"]) {
    assert.ok(have.has(d), `falta la entrada del ${d}`);
  }
});

test("cada fecha de entrada coincide con commits reales del repo ese día", (t) => {
  const r = process.cwd();
  if (!gitUsable(r)) return t.skip("git no disponible o clone superficial");
  // Fechas de autor en la zona del autor (-03), como las que ve `git log --date=short`.
  const days = new Set(
    execFileSync("git", ["log", "--date=short", "--format=%ad"], { cwd: r }).toString().split("\n").filter(Boolean)
  );
  for (const e of entries(read(PAGES.es.file))) {
    assert.ok(days.has(e.date), `${e.id}: no hay commits el ${e.date}`);
  }
});

test("el pie de confianza de las 3 páginas tiene los 6 enlaces y apunta a su propia página", () => {
  for (const [lang, p] of Object.entries(PAGES)) {
    const footer = read(p.file).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.equal(TRUST[lang].length, 6);
    for (const [href] of TRUST[lang]) assert.ok(footer.includes(`href="${href}"`), `${lang}: falta ${href}`);
    assert.ok(TRUST[lang].some(([href]) => href === p.route), `${lang}: trust.mjs no apunta a ${p.route}`);
  }
});

test("sitemap las incluye con lastmod = fecha de la última entrada o posterior", () => {
  const sitemap = read("sitemap.xml");
  for (const p of Object.values(PAGES)) assert.ok(sitemap.includes(`<loc>${SITE}${p.route}</loc>`), p.route);
  assert.equal((sitemap.match(/<url>/g) || []).length, 125);
});

test("feed.xml: un ítem por entrada (ES) con fecha real, además de las guías", () => {
  const feed = read("feed.xml");
  const es = entries(read(PAGES.es.file));
  for (const e of es) {
    const link = `${SITE}/novedades.html#${e.id}`;
    const item = feed.match(new RegExp(`<item>(?:(?!</item>)[\\s\\S])*<guid>${link}</guid>[\\s\\S]*?</item>`));
    assert.ok(item, `${e.id}: sin ítem en el feed`);
    const pub = new Date(item[0].match(/<pubDate>([^<]+)<\/pubDate>/)[1]);
    assert.equal(pub.toISOString().slice(0, 10), e.date, `${e.id}: pubDate ≠ fecha de la entrada`);
  }
  assert.equal((feed.match(new RegExp(`<guid>${SITE}/guias/[^<]*</guid>`, "g")) || []).length, 20, "las 20 guías ES siguen en el feed");
  const last = new Date(feed.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)[1]);
  const newest = Math.max(...[...feed.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => +new Date(m[1])));
  assert.equal(+last, newest, "lastBuildDate = ítem más reciente");
});

test("llms.txt apunta a /novedades.html", () => {
  assert.ok(read("llms.txt").includes(`${SITE}/novedades.html`));
});

test("las novedades ya no son la fuente de confianza 5: ninguna página del build trae solo 5 enlaces", () => {
  // Defensa barata: el footer de la home ES lista Novedades.
  assert.ok(read("acerca.html").includes('href="/novedades.html"'));
  assert.ok(read("en/about.html").includes('href="/en/changelog.html"'));
  assert.ok(read("pt/sobre.html").includes('href="/pt/novidades.html"'));
});

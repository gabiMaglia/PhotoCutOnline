import test from "node:test";
import assert from "node:assert/strict";
import { longDate, injectGuideDates } from "./dates.mjs";

const PAGE = `<head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "H",
  "inLanguage": "es"
}
</script>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [] }
</script>
</head><body>
<p class="meta"><span data-updated>Actualizado: julio de 2026</span> · Lectura: 6 minutos · Por <a href="/autor.html">G</a></p>
</body>`;

test("longDate formatea en el idioma de la página (UTC)", () => {
  assert.equal(longDate("2026-10-06T02:00:00.000Z", "es"), "6 de octubre de 2026");
  assert.equal(longDate("2026-10-06T02:00:00.000Z", "en"), "October 6, 2026");
  assert.equal(longDate("2026-07-29T12:00:00.000Z", "pt"), "29 de julho de 2026");
});

test("agrega datePublished/dateModified solo al Article y deja el resto igual", () => {
  const out = injectGuideDates(PAGE, {
    published: "2026-07-15T03:42:41.000Z",
    modified: "2026-10-06T18:58:31.000Z",
    lang: "es",
  });
  const blocks = [...out.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks[0].datePublished, "2026-07-15T03:42:41.000Z");
  assert.equal(blocks[0].dateModified, "2026-10-06T18:58:31.000Z");
  assert.equal(blocks[0].headline, "H");
  assert.equal(blocks[1].datePublished, undefined);
});

test("es idempotente: dos pasadas dan lo mismo y no duplican campos", () => {
  const args = { published: "2026-07-15T03:42:41.000Z", modified: "2026-10-06T18:58:31.000Z", lang: "es" };
  const once = injectGuideDates(PAGE, args);
  assert.equal(injectGuideDates(once, args), once);
  assert.equal((once.match(/datePublished/g) || []).length, 1);
});

test("la fecha visible usa <time datetime> con la fecha larga y reemplaza el marcador", () => {
  const out = injectGuideDates(PAGE, { published: "2026-07-15T03:42:41.000Z", modified: "2026-10-06T18:58:31.000Z", lang: "es" });
  assert.match(out, /Actualizado el <time datetime="2026-10-06">6 de octubre de 2026<\/time> · Lectura/);
  assert.ok(!out.includes("data-updated"));
  assert.ok(!out.includes("julio de 2026"));
});

test("EN y PT usan su propia fórmula", () => {
  const en = PAGE.replace("Actualizado: julio de 2026", "Updated: July 2026");
  const pt = PAGE.replace("Actualizado: julio de 2026", "Atualizado: julho de 2026");
  const a = { published: "2026-07-15T03:42:41.000Z", modified: "2026-10-06T18:58:31.000Z" };
  assert.match(injectGuideDates(en, { ...a, lang: "en" }), /Updated on <time datetime="2026-10-06">October 6, 2026<\/time>/);
  assert.match(injectGuideDates(pt, { ...a, lang: "pt" }), /Atualizado em <time datetime="2026-10-06">6 de outubro de 2026<\/time>/);
});

test("sin Article o sin marcador no inventa nada", () => {
  const out = injectGuideDates("<head></head><body><p>x</p></body>", {
    published: "2026-07-15T03:42:41.000Z",
    modified: "2026-10-06T18:58:31.000Z",
    lang: "es",
  });
  assert.equal(out, "<head></head><body><p>x</p></body>");
});

test("published nunca supera a modified (se acota)", () => {
  const out = injectGuideDates(PAGE, { published: "2026-11-01T00:00:00.000Z", modified: "2026-10-06T18:58:31.000Z", lang: "es" });
  const b = JSON.parse(out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(b.datePublished, b.dateModified);
});

// GROW-31: el bloque «Lo probamos» de cada guía sale de scripts/pruebas.json, con byline único
// y sin las frases viejas; FAQ sin repetir el cuerpo y con su JSON-LD al día. Vale para ES, EN y PT.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBlock, injectBlock, loadPruebas, readI18nGroups, guideFiles, LANGS, START, END } from "./render-pruebas.mjs";
import { measure } from "./faq-overlap.mjs";
import { faqRegion, norm, FAQ_H2 } from "./faq-prune.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public/guias");
const slugsEs = readdirSync(DIR).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => f.replace(".html", "")).sort();
const db = loadPruebas();
const groups = readI18nGroups();
const file = (slug, lang) => guideFiles(slug, groups)[lang];
const html = (slug, lang = "es") => readFileSync(file(slug, lang), "utf8");
const each = (fn) => { for (const lang of LANGS) for (const slug of slugsEs) fn(slug, lang, html(slug, lang)); };

// byline exacto por idioma: «Probado por … el …», «Tested by … on …», «Testado por … em …»
const BYLINE = {
  es: /Probado por Gabriel Maglia el <time datetime="\d{4}-\d{2}-\d{2}">\d{4}-\d{2}-\d{2}<\/time> con PhotoCut \(web\) en Chrome \d+\.\d+\.\d+\.\d+/g,
  en: /Tested by Gabriel Maglia on <time datetime="\d{4}-\d{2}-\d{2}">\d{4}-\d{2}-\d{2}<\/time> with PhotoCut \(web\) in Chrome \d+\.\d+\.\d+\.\d+/g,
  pt: /Testado por Gabriel Maglia em <time datetime="\d{4}-\d{2}-\d{2}">\d{4}-\d{2}-\d{2}<\/time> com PhotoCut \(web\) no Chrome \d+\.\d+\.\d+\.\d+/g,
};
// frases del bloque viejo (genérico, «del equipo») que no pueden volver
const OLD_VOICE = {
  es: [/Prueba del equipo/, /La captura de arriba es de esa sesi/, /Las im[aá]genes? de arriba (es|son) de esa sesi/],
  en: [/Test run by the PhotoCut Studio team/, /team of PhotoCut/i, /The (screenshot|images?) above (is|are) from that session/],
  pt: [/Teste feito pela equipe/, /equipe do PhotoCut/i, /A captura acima é dessa sessão/, /As imagens acima são dessa sessão/],
};
const FAQ_TITLE = { es: /<h2[^>]*>\s*Preguntas frecuentes\s*<\/h2>/, en: FAQ_H2.en, pt: FAQ_H2.pt };
const nums = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(",", ".")).sort().join(" ");

test("cada guía ES tiene su prueba en pruebas.json y viceversa", () => {
  assert.deepEqual(Object.keys(db).sort(), slugsEs);
});

test("cada guía ES de I18N_GROUPS tiene su par EN y PT, y todos los archivos existen", () => {
  for (const slug of slugsEs) {
    const f = guideFiles(slug, groups);
    for (const lang of LANGS) {
      assert.ok(f[lang], `${slug}: I18N_GROUPS no tiene ${lang}`);
      assert.doesNotThrow(() => readFileSync(f[lang]), `${slug}: no existe ${f[lang]}`);
    }
  }
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

test("traducciones EN/PT: mismas frases y los números no se tocan", () => {
  for (const [slug, e] of Object.entries(db)) {
    for (const lang of ["en", "pt"]) {
      const tr = e.i18n?.[lang];
      assert.ok(tr, `${slug}: falta i18n.${lang}`);
      assert.equal(tr.steps.length, e.steps.length, `${slug}/${lang}: cantidad de pasos`);
      assert.equal(tr.findings.length, e.findings.length, `${slug}/${lang}: cantidad de hallazgos`);
      assert.ok(tr.title && tr.tool && tr.caveat.length > 60, `${slug}/${lang}: título, herramienta o caveat vacío`);
      for (const k of ["title", "tool", "caveat"]) assert.equal(nums(tr[k]), nums(e[k]), `${slug}/${lang}/${k}: los números no coinciden con ES`);
      for (const k of ["steps", "findings"]) e[k].forEach((s, i) => assert.equal(nums(tr[k][i]), nums(s), `${slug}/${lang}/${k}[${i}]: los números no coinciden con ES`));
      // no es un copy-paste del español
      assert.notEqual(tr.caveat, e.caveat, `${slug}/${lang}: caveat sin traducir`);
    }
  }
});

test("el bloque de cada guía (ES, EN y PT) es exactamente el que genera el JSON", () => {
  each((slug, lang, h) => {
    assert.equal(h.split(START).length - 1, 1, `${lang}/${slug}: marcador de inicio`);
    assert.equal(h.split(END).length - 1, 1, `${lang}/${slug}: marcador de fin`);
    assert.equal(injectBlock(h, renderBlock(db[slug], lang)), h, `${lang}/${slug}: el HTML no coincide con pruebas.json (corré npm run pruebas:render)`);
  });
});

test("byline único por idioma, sin «equipo»/«team»/«equipe», sin las frases viejas ni el «18 MB»", () => {
  each((slug, lang, h) => {
    const by = h.match(BYLINE[lang]) || [];
    assert.equal(by.length, 1, `${lang}/${slug}: byline`);
    assert.equal((h.match(/class="byline"/g) || []).length, 1, `${lang}/${slug}: más de un byline`);
    for (const re of OLD_VOICE[lang]) assert.doesNotMatch(h, re, `${lang}/${slug}: ${re}`);
    assert.doesNotMatch(h, /18(&nbsp;|\s)?MB/, `${lang}/${slug}`);
    assert.equal((h.match(/class="tried"/g) || []).length, 1, `${lang}/${slug}: debe haber un solo bloque «Lo probamos»`);
    // el byline firma a una persona: nada de «Test run by the … team»
    const line = h.match(/<p class="byline">[\s\S]*?<\/p>/)[0];
    assert.doesNotMatch(line, /\b(team|equipo|equipe)\b/i, `${lang}/${slug}: byline con «equipo»`);
  });
});

test("JSON-LD válido en las 60 guías y FAQPage sincronizado con la FAQ visible", () => {
  each((slug, lang, h) => {
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    assert.ok(blocks.length >= 1, `${lang}/${slug}: faltan bloques JSON-LD`);
    const faqLd = blocks.find((b) => b["@type"] === "FAQPage");
    const reg = faqRegion(h, lang);
    const visible = reg ? reg.items.map((i) => i.qNorm) : [];
    if (!visible.length) {
      assert.equal(faqLd, undefined, `${lang}/${slug}: hay FAQPage pero no hay FAQ visible`);
      assert.doesNotMatch(h, FAQ_TITLE[lang], `${lang}/${slug}: título de FAQ sin preguntas`);
    } else {
      assert.ok(faqLd, `${lang}/${slug}: FAQ visible sin FAQPage`);
      assert.deepEqual(faqLd.mainEntity.map((q) => norm(q.name)), visible, `${lang}/${slug}`);
    }
  });
});

test("las tres FAQ con valor propio que QA pidió conservar siguen en los tres idiomas", () => {
  const keep = {
    "recortar-una-persona-de-una-foto": { es: "¿Sirve para sacar a una persona que sobra en la foto?", en: "Does it work to remove a person who's in the way?", pt: "Serve para tirar uma pessoa que está sobrando na foto?" },
    "como-quitar-el-fondo-de-una-imagen": { es: "¿Es realmente gratis? ¿Pone marca de agua o limita los usos?", en: "Is it really free? Does it add a watermark or limit usage?", pt: "É mesmo grátis? Coloca marca d'água ou limita o uso?" },
    "foto-carnet-fondo-blanco": { es: "¿Qué fondo blanco es el correcto: blanco puro o gris muy claro?", en: "Pure white or light gray?", pt: "Branco puro ou cinza clarinho?" },
  };
  for (const [slug, qs] of Object.entries(keep)) {
    for (const lang of LANGS) {
      const reg = faqRegion(html(slug, lang), lang);
      assert.deepEqual(reg.items.map((i) => i.qNorm), [norm(qs[lang])], `${lang}/${slug}`);
    }
  }
  for (const [lang, re] of [["es", /Android[\s\S]*iPhone/], ["en", /Android[\s\S]*iPhone/], ["pt", /Android[\s\S]*iPhone/]]) {
    const h = html("como-quitar-el-fondo-de-una-imagen", lang);
    const reg = faqRegion(h, lang);
    assert.match(h.slice(reg.items[0].from, reg.items[0].to), re, `${lang}: la respuesta debe mencionar Android e iPhone`);
  }
});

test("la FAQ no repite el cuerpo: ≤ 10 % del texto de cada página (ES, EN y PT)", () => {
  each((slug, lang, h) => {
    const m = measure(h, lang);
    assert.ok(m.faqPct <= 10, `${lang}/${slug}: la FAQ es el ${m.faqPct} % de la página`);
    assert.ok(m.sharedPct <= 10, `${lang}/${slug}: ${m.sharedPct} % de 5-gramas compartidos FAQ-cuerpo`);
    assert.ok(m.dupPct <= 10, `${lang}/${slug}: ${m.dupPct} % de la FAQ ya está en el cuerpo`);
  });
});

// cada sección con medidas cita una fuente oficial con fecha de verificación o lo dice
const MEASURES = {
  es: { verified: /verificad[oa]s? el 2026-10-06/, flag: /sin fuente oficial/i, stopSocial: "<h2>Cómo dejar la foto", stopIcons: "<h2>Reglas de diseño", rule: "La regla" },
  en: { verified: /verified on 2026-10-06/, flag: /no official source/i, stopSocial: "<h2>How to get the photo", stopIcons: "<h2>Design rules", rule: "The rule" },
  pt: { verified: /verificad[oa]s? em 2026-10-06/, flag: /sem fonte oficial/i, stopSocial: "<h2>Como deixar a foto", stopIcons: "<h2>Regras de design", rule: "A regra" },
};
test("medidas de redes e iconos (ES, EN, PT): cada sección con medidas cita fuente oficial verificada o dice «sin fuente oficial»", () => {
  for (const lang of LANGS) {
    const M = MEASURES[lang];
    for (const slug of ["medidas-de-fotos-para-redes-sociales-2026", "medidas-de-iconos-de-app-ios-android-2026"]) {
      const h = html(slug, lang);
      const stop = slug.startsWith("medidas-de-fotos") ? M.stopSocial : M.stopIcons;
      const main = h.slice(h.indexOf("<h1>"), h.indexOf(stop));
      const sections = main.split(/<h2>/).slice(1).filter((s) => /\d+\s*(×|x)\s*\d+|\d+(&nbsp;|\s)?px/.test(s) && !s.startsWith(M.rule));
      assert.ok(sections.length >= 5, `${lang}/${slug}: pocas secciones con medidas`);
      for (const s of sections) {
        const cited = /<a href="https:\/\/[^"]+" rel="noopener">/.test(s) && M.verified.test(s);
        assert.ok(cited || M.flag.test(s), `${lang}/${slug}: «${s.slice(0, 50)}» tiene medidas sin fuente ni aviso`);
      }
      assert.match(h, /2026-10-06/, `${lang}/${slug}`);
    }
  }
});

test("los valores corregidos de las medidas son los mismos en ES, EN y PT", () => {
  for (const lang of LANGS) {
    const t = html("medidas-de-fotos-para-redes-sociales-2026", lang).replace(/&nbsp;/g, " ");
    assert.match(t, /320×320/, lang); // Facebook (Página)
    assert.match(t, /851×315/, lang);
    assert.match(t, /400×150/, lang);
    assert.match(t, /3840×2160/, lang); // YouTube
    assert.doesNotMatch(t, /1640×624|720×720/, `${lang}: quedó una medida vieja de Facebook`);
    assert.doesNotMatch(html("foto-de-perfil-para-linkedin", lang), /LinkedIn[^<]{0,40}(always|siempre|sempre)/, lang);
  }
});

test("EN/PT dicen lo mismo que ES en lo que cambió fuera del bloque", () => {
  for (const lang of LANGS) {
    assert.match(html("como-quitar-el-fondo-de-una-imagen", lang).replace(/&nbsp;/g, " "), /~7 MB/, `${lang}: ~7 MB`);
    assert.match(html("quitar-la-ubicacion-de-una-foto", lang).replace(/&nbsp;/g, " "), /21[.,]0[\s\S]{1,12}24[.,]1/, `${lang}: la recompresión del EXIF (21,0→24,1 KB)`);
    const dark = html("generar-modo-oscuro-desde-una-captura", lang);
    assert.doesNotMatch(dark, /Recolor|Recolorear|Recolorir/, `${lang}: «Recolorear» no existe`);
    assert.match(dark, /#0744cb/, `${lang}: dato medido del azul`);
    assert.doesNotMatch(html("stickers-de-whatsapp-y-telegram", lang), /Sticker\/Icon/, `${lang}: el flujo real es Exportar → Archivo`);
    assert.doesNotMatch(html("medidas-de-iconos-de-app-ios-android-2026", lang), /~58/, lang);
  }
});

// GROW-34: la guía de stickers enseña el flujo real (presets de Exportar) y su
// «Lo probamos» mide esos presets, no el rodeo viejo por Archivo.
test("stickers (ES, EN, PT): el flujo es Recorte IA → Exportar → preset Sticker, y el JSON mide el preset", () => {
  const LABEL = {
    es: ["Sticker WhatsApp 512 (WebP)", "Sticker Telegram 512 (PNG)"],
    en: ["WhatsApp sticker 512 (WebP)", "Telegram sticker 512 (PNG)"],
    pt: ["Figurinha WhatsApp 512 (WebP)", "Figurinha Telegram 512 (PNG)"],
  };
  for (const lang of LANGS) {
    const h = html("stickers-de-whatsapp-y-telegram", lang);
    const howto = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .find((b) => b["@type"] === "HowTo");
    const steps = howto.step.map((s) => s.text).join(" ");
    for (const label of LABEL[lang]) {
      assert.ok(h.includes(label), `${lang}: la guía no nombra el preset «${label}»`);
      assert.ok(steps.includes(label), `${lang}: el HowTo no nombra el preset «${label}»`);
    }
    // el rodeo viejo (Archivo para llegar a 512) ya no es el camino
    assert.doesNotMatch(steps, /Archivo|File|Arquivo/, `${lang}: el HowTo sigue mandando a Archivo`);
  }
  const r = db["stickers-de-whatsapp-y-telegram"].result;
  assert.deepEqual([r.whatsapp?.w, r.whatsapp?.h, r.whatsapp?.format], [512, 512, "webp"]);
  assert.deepEqual([r.telegram?.w, r.telegram?.h, r.telegram?.format], [512, 512, "png"]);
  assert.ok(r.whatsapp.kb <= 100, `WhatsApp ${r.whatsapp.kb} KB`);
  assert.deepEqual(r.whatsapp.cornersAlpha, [0, 0, 0, 0]);
  assert.deepEqual(r.telegram.cornersAlpha, [0, 0, 0, 0]);
});

test("tildes en las guías de medidas (ES)", () => {
  for (const slug of ["medidas-de-fotos-para-redes-sociales-2026", "medidas-de-iconos-de-app-ios-android-2026"]) {
    const t = html(slug).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(t, /\b(pixeles|proporcion|version|sesion|exporta en JPG|tambien|ademas)\b/i, slug);
  }
});

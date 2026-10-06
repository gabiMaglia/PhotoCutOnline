// Footer único de confianza en TODAS las páginas fuente (landing, editor y
// estáticas ES/EN/PT): Privacidad · Términos · Contacto · Acerca · Autor · Novedades,
// cada idioma apuntando a SU versión. Determinista e idempotente: quita
// cualquier enlace de confianza previo (de cualquier idioma) y agrega el set
// canónico al final del footer. Los demás enlaces del footer se conservan.
// Uso: node scripts/unify-footers.mjs   (verificación: scripts/check-footers.mjs)
import fs from "node:fs";
import { sourcePages, langOf } from "./lib/pages.mjs";
import { TRUST, ALL_TRUST_HREFS } from "./lib/trust.mjs";

const ANCHOR = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
// Los selectores de idioma ("Español" → /acerca.html) apuntan a páginas de
// confianza pero NO son enlaces de confianza: se conservan.
const LANG_LABELS = new Set(["español", "english", "português"]);

// Reescribe los enlaces de un bloque: conserva los ajenos, suma los de confianza.
function rebuild(inner, lang, sep) {
  const indent = (inner.match(/\n([ \t]+)<a\s/) || [, "        "])[1];
  const closeIndent = (inner.match(/\n([ \t]*)$/) || [, ""])[1];
  const kept = [];
  for (const m of inner.matchAll(ANCHOR)) {
    const isLangSwitch = LANG_LABELS.has(m[2].trim().toLowerCase());
    if (!ALL_TRUST_HREFS.has(m[1]) || isLangSwitch) kept.push(m[0]);
  }
  const trust = TRUST[lang].map(([href, label]) => `<a href="${href}">${label}</a>`);
  const links = [...kept, ...trust];
  return `\n${indent}${links.join(`${sep}\n${indent}`)}\n${closeIndent}`;
}

let changed = 0;
let unchanged = 0;
for (const file of sourcePages()) {
  const lang = langOf(file);
  const html = fs.readFileSync(file, "utf8");
  let out = html;
  if (/<footer[^>]*class="lp-footer"/.test(html)) {
    // landing: los enlaces viven en <div class="lp-legal"> (flex, sin " ·")
    out = html.replace(/(<div class="lp-legal">)([\s\S]*?)(<\/div>)/, (_, a, inner, c) => a + rebuild(inner, lang, "") + c);
  } else {
    out = html.replace(/(<footer[^>]*>)([\s\S]*?)(<\/footer>)/, (_, a, inner, c) => a + rebuild(inner, lang, " ·") + c);
  }
  if (out === html) {
    unchanged++;
    continue;
  }
  fs.writeFileSync(file, out);
  changed++;
}
console.log(`footers: ${changed} actualizados, ${unchanged} ya estaban al día`);

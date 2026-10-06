// Verifica en dist/ (tras `npm run build`) que TODA página HTML tenga en su
// footer los 5 enlaces de confianza de SU idioma: Privacidad · Términos ·
// Contacto · Acerca · Autor. Sale con código 1 si alguna falla.
// Uso: node scripts/check-footers.mjs [carpeta=dist]
import fs from "node:fs";
import path from "node:path";
import { TRUST } from "./lib/trust.mjs";

const dist = path.resolve(process.argv[2] || "dist");
if (!fs.existsSync(dist)) {
  console.error(`No existe ${dist}: corré "npm run build" primero.`);
  process.exit(2);
}

const SKIP = new Set(["google9ef2ab02fb19e6af.html"]); // verificación de Search Console, no es contenido

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "assets") walk(p, out);
    } else if (e.name.endsWith(".html") && !SKIP.has(e.name)) out.push(p);
  }
  return out;
}

const pages = walk(dist).sort();
const failures = [];
for (const file of pages) {
  const rel = path.relative(dist, file).split(path.sep).join("/");
  const lang = rel.startsWith("en/") ? "en" : rel.startsWith("pt/") ? "pt" : "es";
  const html = fs.readFileSync(file, "utf8");
  const footer = (html.match(/<footer[\s\S]*?<\/footer>/) || [""])[0];
  const missing = TRUST[lang].filter(([href]) => !footer.includes(`href="${href}"`)).map(([href]) => href);
  if (!footer) failures.push(`${rel} [${lang}]: sin <footer>`);
  else if (missing.length) failures.push(`${rel} [${lang}]: faltan ${missing.join(", ")}`);
}

const ok = pages.length - failures.length;
for (const f of failures) console.error(`FAIL ${f}`);
console.log(`${ok}/${pages.length} páginas con los 5 enlaces de confianza en su idioma`);
process.exit(failures.length ? 1 : 0);

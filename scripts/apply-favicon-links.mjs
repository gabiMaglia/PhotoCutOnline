// Agrega a todas las páginas fuente el <link rel="icon"> a /favicon.ico
// (y al /favicon.svg donde no hay ningún icono). Idempotente.
// Uso: node scripts/apply-favicon-links.mjs
import fs from "node:fs";
import { sourcePages } from "./lib/pages.mjs";

const ICO = '<link rel="icon" href="/favicon.ico" sizes="any" />';
const SVG = '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />';
let changed = 0;

for (const file of sourcePages()) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(ICO)) continue;
  if (/<link rel="icon"/.test(html)) {
    // landing/editor: ya tienen el SVG (data-URI); el .ico va antes de él
    html = html.replace(/(\s*)(<link rel="icon")/, `$1${ICO}$1$2`);
  } else {
    html = html.replace(/(\n[ \t]*)<\/head>/, `$1  ${ICO}$1  ${SVG}$1</head>`);
  }
  fs.writeFileSync(file, html);
  changed++;
}
console.log(`favicon links: ${changed} páginas actualizadas`);

// Regenera scripts/lastmod.json (fecha del último commit de cada página fuente).
// Vercel no tiene historial git, así que el build lee este manifiesto commiteado.
//
//   npm run lastmod            → regenera (falla si no hay git completo)
//   node scripts/gen-lastmod.mjs --auto  → lo usa `npm run build`: solo regenera
//                                con git completo y fuera de Vercel; si no, no toca nada.
import fs from "node:fs";
import path from "node:path";
import { buildManifest, gitUsable, MANIFEST_PATH } from "./lib/lastmod.mjs";

const root = process.cwd();
const auto = process.argv.includes("--auto");

if (auto && (process.env.VERCEL || !gitUsable(root))) {
  console.log("[lastmod] sin git completo (o Vercel): uso scripts/lastmod.json tal cual.");
  process.exit(0);
}
if (!gitUsable(root)) {
  console.error("[lastmod] se necesita git con historial completo para generar el manifiesto.");
  process.exit(1);
}

const sorted = Object.fromEntries(Object.entries(buildManifest(root)).sort(([a], [b]) => a.localeCompare(b)));
const body = JSON.stringify(sorted, null, 2) + "\n";
const file = path.join(root, MANIFEST_PATH);
const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (prev !== body) fs.writeFileSync(file, body);
console.log(`[lastmod] ${Object.keys(sorted).length} entradas${prev === body ? " (sin cambios)" : " (actualizado)"}.`);

// Regenera los manifiestos de fechas:
//   scripts/lastmod.json    → fecha del último commit de contenido de cada página fuente
//   scripts/published.json  → fecha del PRIMER commit de cada guía (datePublished)
// Vercel no tiene historial git, así que el build lee estos manifiestos commiteados.
//
//   npm run lastmod            → regenera (falla si no hay git completo)
//   node scripts/gen-lastmod.mjs --auto  → lo usa `npm run build`: solo regenera
//                                con git completo y fuera de Vercel; si no, no toca nada.
import fs from "node:fs";
import path from "node:path";
import { buildManifest, buildPublished, gitUsable, MANIFEST_PATH, PUBLISHED_PATH } from "./lib/lastmod.mjs";

const root = process.cwd();
const auto = process.argv.includes("--auto");

if (auto && (process.env.VERCEL || !gitUsable(root))) {
  console.log("[lastmod] sin git completo (o Vercel): uso scripts/lastmod.json y published.json tal cual.");
  process.exit(0);
}
if (!gitUsable(root)) {
  console.error("[lastmod] se necesita git con historial completo para generar los manifiestos.");
  process.exit(1);
}

function write(rel, data, label) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  const body = JSON.stringify(sorted, null, 2) + "\n";
  const file = path.join(root, rel);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (prev !== body) fs.writeFileSync(file, body);
  console.log(`[lastmod] ${label}: ${Object.keys(sorted).length} entradas${prev === body ? " (sin cambios)" : " (actualizado)"}.`);
}

write(MANIFEST_PATH, buildManifest(root), "lastmod");
write(PUBLISHED_PATH, buildPublished(root), "published");

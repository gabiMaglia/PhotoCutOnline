// Deploys sintéticos para la suite del service worker (BUG-08).
//
// De UN build real (B) se derivan A y C renombrando un subconjunto de archivos
// hasheados, como haría un deploy que cambió el editor, el worker y un chunk
// perezoso. La clausura importa: si un archivo referencia a uno renombrado, su
// contenido cambió, así que también cambia de nombre (lo que haría el hash
// real). Sin eso tendríamos un chunk «compartido» con contenido distinto bajo
// el mismo nombre, cosa que un deploy de verdad no produce.

import fs from "node:fs";
import path from "node:path";

const SEEDS = [/^editor-.*\.js$/, /^cutoutWorker-.*\.js$/, /^FiltersPage-.*\.js$/];
const TEXT = /\.(?:js|mjs|css)$/;

/** BUILD_ID que el build inyecta en sw.js; null si el sw.js no lo trae (árbol previo a BUG-08). */
export function readBuildId(dir) {
  const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
  return sw.match(/"id":"([0-9a-f]+)"/)?.[1] ?? null;
}

/** Archivos de /assets/ que cambian de nombre entre deploys (semillas + clausura). */
export function renameSet(dir) {
  const assets = fs.readdirSync(path.join(dir, "assets"));
  const text = new Map(
    assets.filter((f) => TEXT.test(f)).map((f) => [f, fs.readFileSync(path.join(dir, "assets", f), "utf8")])
  );
  const set = new Set(assets.filter((f) => SEEDS.some((re) => re.test(f))));
  for (let grew = true; grew; ) {
    grew = false;
    for (const [f, src] of text) {
      if (!set.has(f) && [...set].some((n) => src.includes(n))) {
        set.add(f);
        grew = true;
      }
    }
  }
  return [...set].sort();
}

const tagged = (name, tag) => name.replace(/(\.[a-z]+)$/, `${tag}$1`);

/** Copia `srcDir` en `outDir` con `renamed` renombrados (sufijo `tag`) y todas sus referencias reescritas. */
export function deriveDeploy(srcDir, outDir, tag, renamed, buildId) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(srcDir, outDir, { recursive: true });
  const map = renamed.map((f) => [f, tagged(f, tag)]);
  for (const [from, to] of map) fs.renameSync(path.join(outDir, "assets", from), path.join(outDir, "assets", to));

  const files = [
    ...fs.readdirSync(path.join(outDir, "assets")).filter((f) => TEXT.test(f)).map((f) => path.join("assets", f)),
    "index.html",
    path.join("editor", "index.html"),
    "sw.js",
  ];
  for (const rel of files) {
    const file = path.join(outDir, rel);
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const [from, to] of map) after = after.split(from).join(to);
    if (buildId) after = after.split(buildId).join(buildId + tag);
    if (after !== before) fs.writeFileSync(file, after);
  }
  return { dir: outDir, id: buildId ? buildId + tag : null, renamed: map.map(([, to]) => to) };
}

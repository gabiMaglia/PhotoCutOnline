import fs from "node:fs";
import path from "node:path";

// Archivos HTML fuente del sitio: landing + editor (Vite) y las estáticas de public/.
// La página de verificación de Google no es contenido y no se toca.
const EXCLUDE = new Set(["public/google9ef2ab02fb19e6af.html"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

export function sourcePages(root = process.cwd()) {
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");
  const pub = walk(path.join(root, "public")).map(rel).filter((p) => !EXCLUDE.has(p));
  return ["index.html", "editor/index.html", ...pub.sort()].map((p) => path.join(root, p));
}

// Idioma de una página según su carpeta de salida (ES en la raíz).
export function langOf(file, root = process.cwd()) {
  const r = path.relative(root, file).split(path.sep).join("/").replace(/^public\//, "");
  if (r.startsWith("en/")) return "en";
  if (r.startsWith("pt/")) return "pt";
  return "es";
}

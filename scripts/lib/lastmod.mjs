import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { sourcePages } from "./pages.mjs";

// Ruta (relativa a la raíz del repo) del manifiesto commiteado.
export const MANIFEST_PATH = "scripts/lastmod.json";

const git = (cwd, args) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();

// ¿Hay git con historial completo? Un clone superficial colapsa todas las
// fechas a la del último commit, así que no sirve para generar el manifiesto.
export function gitUsable(cwd = process.cwd()) {
  try {
    return git(cwd, ["rev-parse", "--is-shallow-repository"]) === "false";
  } catch {
    return false;
  }
}

// Fecha ISO del último commit que tocó el archivo, o null si git no puede decirlo.
// Los commits con "[lastmod-skip]" se ignoran: son cambios mecánicos masivos
// (footers, favicons...) que no son contenido y pondrían la misma fecha en todas las URLs.
export function gitModified(file, cwd = process.cwd()) {
  try {
    const out = git(cwd, ["log", "-1", "--format=%cI", "--invert-grep", "--grep=\\[lastmod-skip\\]", "--", file]);
    return out ? new Date(out).toISOString() : null;
  } catch {
    return null;
  }
}

const manifests = new Map();
function loadManifest(cwd) {
  if (!manifests.has(cwd)) {
    let m = {};
    try {
      m = JSON.parse(fs.readFileSync(path.join(cwd, MANIFEST_PATH), "utf8"));
    } catch {
      // sin manifiesto: seguimos con git/mtime
    }
    manifests.set(cwd, m);
  }
  return manifests.get(cwd);
}

let warned = false;

// Última modificación REAL de un archivo fuente. Orden: manifiesto → git → mtime.
// El manifiesto existe porque el build de Vercel no tiene historial git.
export function lastModified(file, cwd = process.cwd()) {
  const rel = path.relative(cwd, path.resolve(cwd, file)).split(path.sep).join("/");
  const fromManifest = loadManifest(cwd)[rel];
  if (fromManifest) return new Date(fromManifest).toISOString();
  const fromGit = gitModified(file, cwd);
  if (fromGit) return fromGit;
  if (!warned) {
    warned = true;
    console.warn(`[lastmod] ${rel} no está en ${MANIFEST_PATH} y git no responde: uso mtime (corré npm run lastmod).`);
  }
  return fs.statSync(file).mtime.toISOString();
}

// Manifiesto completo { "ruta relativa": ISO } desde git (solo con git disponible).
export function buildManifest(root = process.cwd()) {
  const out = {};
  for (const abs of sourcePages(root)) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const d = gitModified(rel, root);
    if (!d) throw new Error(`git no tiene historial para ${rel}`);
    out[rel] = d;
  }
  return out;
}

// Diferencias entre un manifiesto y lo que dice git hoy.
export function manifestProblems(manifest, root = process.cwd()) {
  const expected = buildManifest(root);
  const problems = [];
  for (const [rel, d] of Object.entries(expected)) {
    if (!manifest[rel]) problems.push(`falta ${rel}`);
    else if (manifest[rel] !== d) problems.push(`${rel}: manifiesto ${manifest[rel]} ≠ git ${d}`);
  }
  for (const rel of Object.keys(manifest)) {
    if (!(rel in expected)) problems.push(`sobra ${rel}`);
  }
  return problems;
}

// ---- datePublished (fecha de PRIMER commit), solo para las guías ----------

// Manifiesto hermano: Vercel no tiene git, así que también se commitea.
export const PUBLISHED_PATH = "scripts/published.json";

// Guías de contenido (ES/EN/PT), sin los índices: las únicas con Article JSON-LD.
export const isGuideSource = (rel) =>
  /^public\/(guias|en\/guides|pt\/guias)\/(?!index\.html$)[^/]+\.html$/.test(rel);

// Fecha ISO del commit que CREÓ el archivo (siguiendo renombres), o null.
export function gitPublished(file, cwd = process.cwd()) {
  try {
    const out = git(cwd, ["log", "--diff-filter=A", "--follow", "--format=%cI", "--", file]);
    const first = out.split("\n").filter(Boolean).at(-1);
    return first ? new Date(first).toISOString() : null;
  } catch {
    return null;
  }
}

const publishedManifests = new Map();
function loadPublished(cwd) {
  if (!publishedManifests.has(cwd)) {
    let m = {};
    try {
      m = JSON.parse(fs.readFileSync(path.join(cwd, PUBLISHED_PATH), "utf8"));
    } catch {
      // sin manifiesto: seguimos con git
    }
    publishedManifests.set(cwd, m);
  }
  return publishedManifests.get(cwd);
}

// Fecha de publicación original. Orden: manifiesto → git → última modificación.
export function publishedDate(file, cwd = process.cwd()) {
  const rel = path.relative(cwd, path.resolve(cwd, file)).split(path.sep).join("/");
  const fromManifest = loadPublished(cwd)[rel];
  if (fromManifest) return new Date(fromManifest).toISOString();
  return gitPublished(file, cwd) || lastModified(file, cwd);
}

export function buildPublished(root = process.cwd()) {
  const out = {};
  for (const abs of sourcePages(root)) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (!isGuideSource(rel)) continue;
    const d = gitPublished(rel, root);
    if (!d) throw new Error(`git no tiene historial de alta para ${rel}`);
    out[rel] = d;
  }
  return out;
}

export function publishedProblems(manifest, root = process.cwd()) {
  const expected = buildPublished(root);
  const problems = [];
  for (const [rel, d] of Object.entries(expected)) {
    if (!manifest[rel]) problems.push(`falta ${rel}`);
    else if (manifest[rel] !== d) problems.push(`${rel}: manifiesto ${manifest[rel]} ≠ git ${d}`);
  }
  for (const rel of Object.keys(manifest)) {
    if (!(rel in expected)) problems.push(`sobra ${rel}`);
  }
  return problems;
}

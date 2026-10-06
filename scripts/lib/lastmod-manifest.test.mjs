import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { lastModified, buildManifest, manifestProblems, gitUsable, MANIFEST_PATH } from "./lastmod.mjs";

const IDENT = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const run = (cwd, args, extra = {}) =>
  execFileSync("git", args, { cwd, stdio: "pipe", env: { ...process.env, ...IDENT, ...extra } });

// Repo mínimo con la forma del sitio (index.html + editor + public/) y un commit fechado.
function site() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-man-"));
  run(dir, ["init", "-q"]);
  fs.mkdirSync(path.join(dir, "public"));
  fs.mkdirSync(path.join(dir, "editor"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "index.html"), "1");
  fs.writeFileSync(path.join(dir, "editor/index.html"), "1");
  fs.writeFileSync(path.join(dir, "public/a.html"), "1");
  const d = "2026-03-01T10:00:00+00:00";
  run(dir, ["add", "."]);
  run(dir, ["commit", "-q", "-m", "init"], { GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d });
  return dir;
}
const writeManifest = (dir, m) =>
  fs.writeFileSync(path.join(dir, MANIFEST_PATH), JSON.stringify(m, null, 2) + "\n");

test("el manifiesto manda sobre git", () => {
  const dir = site();
  writeManifest(dir, { "public/a.html": "2020-01-01T00:00:00.000Z" });
  assert.equal(lastModified(path.join(dir, "public/a.html"), dir), "2020-01-01T00:00:00.000Z");
});

test("archivo ausente del manifiesto: usa git", () => {
  const dir = site();
  writeManifest(dir, {});
  assert.equal(lastModified(path.join(dir, "public/a.html"), dir), "2026-03-01T10:00:00.000Z");
});

test("sin git ni manifiesto cae al mtime", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-nogit-"));
  const f = path.join(dir, "x.html");
  fs.writeFileSync(f, "x");
  const d = new Date("2026-01-02T03:04:05Z");
  fs.utimesSync(f, d, d);
  assert.equal(lastModified(f, dir), "2026-01-02T03:04:05.000Z");
});

test("sin git y con manifiesto usa el manifiesto (simula Vercel)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-vercel-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "x.html"), "x");
  writeManifest(dir, { "x.html": "2026-07-30T12:00:00.000Z" });
  assert.equal(lastModified(path.join(dir, "x.html"), dir), "2026-07-30T12:00:00.000Z");
});

test("buildManifest cubre index, editor y public", () => {
  const dir = site();
  assert.deepEqual(buildManifest(dir), {
    "editor/index.html": "2026-03-01T10:00:00.000Z",
    "index.html": "2026-03-01T10:00:00.000Z",
    "public/a.html": "2026-03-01T10:00:00.000Z",
  });
});

test("detecta manifiesto desactualizado (fecha vieja) y archivos faltantes", () => {
  const dir = site();
  const m = buildManifest(dir);
  assert.deepEqual(manifestProblems(m, dir), []);
  const stale = { ...m, "public/a.html": "2020-01-01T00:00:00.000Z" };
  delete stale["index.html"];
  assert.equal(manifestProblems(stale, dir).length, 2);
});

test("el lastmod.json commiteado está al día (si falla: npm run lastmod)", (t) => {
  const root = process.cwd();
  if (!gitUsable(root)) return t.skip("git no disponible o clone superficial");
  const file = path.join(root, MANIFEST_PATH);
  assert.ok(fs.existsSync(file), "falta scripts/lastmod.json: corré npm run lastmod");
  const problems = manifestProblems(JSON.parse(fs.readFileSync(file, "utf8")), root);
  assert.deepEqual(
    problems,
    [],
    `scripts/lastmod.json desactualizado: corré npm run lastmod y commitealo con [lastmod-skip].\n${problems.join("\n")}`
  );
});

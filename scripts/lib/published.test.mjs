import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  publishedDate,
  buildPublished,
  publishedProblems,
  isGuideSource,
  gitUsable,
  PUBLISHED_PATH,
} from "./lastmod.mjs";

const IDENT = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const run = (cwd, args, extra = {}) =>
  execFileSync("git", args, { cwd, stdio: "pipe", env: { ...process.env, ...IDENT, ...extra } });
const commit = (cwd, msg, date) => {
  run(cwd, ["add", "."]);
  run(cwd, ["commit", "-q", "-m", msg], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
};

function site() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  run(dir, ["init", "-q"]);
  fs.mkdirSync(path.join(dir, "public/guias"), { recursive: true });
  fs.mkdirSync(path.join(dir, "editor"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "index.html"), "1");
  fs.writeFileSync(path.join(dir, "editor/index.html"), "1");
  fs.writeFileSync(path.join(dir, "public/guias/index.html"), "1");
  fs.writeFileSync(path.join(dir, "public/guias/uno.html"), "1");
  commit(dir, "init", "2026-03-01T10:00:00+00:00");
  fs.writeFileSync(path.join(dir, "public/guias/uno.html"), "2");
  commit(dir, "edita", "2026-05-02T10:00:00+00:00");
  return dir;
}

test("isGuideSource reconoce las guías de los 3 idiomas y excluye los índices", () => {
  assert.ok(isGuideSource("public/guias/a.html"));
  assert.ok(isGuideSource("public/en/guides/a.html"));
  assert.ok(isGuideSource("public/pt/guias/a.html"));
  assert.ok(!isGuideSource("public/guias/index.html"));
  assert.ok(!isGuideSource("public/acerca.html"));
});

test("publishedDate es el PRIMER commit del archivo, no el último", () => {
  const dir = site();
  assert.equal(publishedDate(path.join(dir, "public/guias/uno.html"), dir), "2026-03-01T10:00:00.000Z");
});

test("publishedDate sigue el renombrado del archivo", () => {
  const dir = site();
  run(dir, ["mv", "public/guias/uno.html", "public/guias/dos.html"]);
  commit(dir, "renombra", "2026-06-01T10:00:00+00:00");
  assert.equal(publishedDate(path.join(dir, "public/guias/dos.html"), dir), "2026-03-01T10:00:00.000Z");
});

test("el manifiesto published.json manda sobre git (simula Vercel sin .git)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pub-vercel-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "x.html"), "x");
  fs.writeFileSync(path.join(dir, PUBLISHED_PATH), JSON.stringify({ "x.html": "2026-07-30T12:00:00.000Z" }));
  assert.equal(publishedDate(path.join(dir, "x.html"), dir), "2026-07-30T12:00:00.000Z");
});

test("buildPublished cubre solo las guías (sin índices)", () => {
  const dir = site();
  assert.deepEqual(buildPublished(dir), { "public/guias/uno.html": "2026-03-01T10:00:00.000Z" });
});

test("publishedProblems detecta fecha vieja, faltante y sobrante", () => {
  const dir = site();
  assert.deepEqual(publishedProblems(buildPublished(dir), dir), []);
  assert.equal(publishedProblems({ "public/guias/uno.html": "2020-01-01T00:00:00.000Z" }, dir).length, 1);
  assert.equal(publishedProblems({}, dir).length, 1);
  assert.equal(publishedProblems({ ...buildPublished(dir), "public/guias/x.html": "2026-01-01T00:00:00.000Z" }, dir).length, 1);
});

test("el published.json commiteado está al día (si falla: npm run lastmod)", (t) => {
  const root = process.cwd();
  if (!gitUsable(root)) return t.skip("git no disponible o clone superficial");
  const file = path.join(root, PUBLISHED_PATH);
  assert.ok(fs.existsSync(file), "falta scripts/published.json: corré npm run lastmod");
  const problems = publishedProblems(JSON.parse(fs.readFileSync(file, "utf8")), root);
  assert.deepEqual(problems, [], `published.json desactualizado: npm run lastmod.\n${problems.join("\n")}`);
});

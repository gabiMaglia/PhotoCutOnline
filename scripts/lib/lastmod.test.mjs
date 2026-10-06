import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { lastModified } from "./lastmod.mjs";

const IDENT = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const run = (cwd, args, extra = {}) =>
  execFileSync("git", args, { cwd, stdio: "pipe", env: { ...process.env, ...IDENT, ...extra } });

function commitAll(cwd, msg, date) {
  run(cwd, ["add", "."]);
  run(cwd, ["commit", "-q", "-m", msg], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
}

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lastmod-"));
  run(dir, ["init", "-q"]);
  return dir;
}

test("devuelve la fecha del último commit que tocó el archivo", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "a.html"), "1");
  fs.writeFileSync(path.join(dir, "b.html"), "1");
  commitAll(dir, "init", "2026-03-01T10:00:00+00:00");
  fs.writeFileSync(path.join(dir, "b.html"), "2");
  commitAll(dir, "cambia b", "2026-05-02T10:00:00+00:00");
  assert.equal(lastModified(path.join(dir, "a.html"), dir), "2026-03-01T10:00:00.000Z");
  assert.equal(lastModified(path.join(dir, "b.html"), dir), "2026-05-02T10:00:00.000Z");
});

test("ignora commits marcados [lastmod-skip] (cambios masivos mecánicos)", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "a.html"), "1");
  commitAll(dir, "contenido real", "2026-03-01T10:00:00+00:00");
  fs.writeFileSync(path.join(dir, "a.html"), "2");
  commitAll(dir, "footer masivo [lastmod-skip]", "2026-09-09T10:00:00+00:00");
  assert.equal(lastModified(path.join(dir, "a.html"), dir), "2026-03-01T10:00:00.000Z");
});

test("sin repositorio (o archivo sin historial) cae al mtime", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "norepo-"));
  const f = path.join(dir, "x.html");
  fs.writeFileSync(f, "x");
  const d = new Date("2026-01-02T03:04:05Z");
  fs.utimesSync(f, d, d);
  assert.equal(lastModified(f, dir), "2026-01-02T03:04:05.000Z");
});

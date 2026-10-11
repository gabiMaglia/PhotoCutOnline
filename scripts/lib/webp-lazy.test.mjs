import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDist } from "./ensure-dist.mjs";

// GROW-35: el encoder WebP es para navegadores sin soporte nativo y se pide
// recién al exportar. Si alguien lo importa estático, entra a la carga de todos.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dist = ensureDist(root);
const assets = fs.readdirSync(path.join(dist, "assets"));

test("el encoder WebP se publica como .wasm aparte", () => {
  assert.ok(assets.some((f) => /^webp_enc(_simd)?-.+\.wasm$/.test(f)), assets.join(" "));
});

test("ninguna página carga el encoder WebP de entrada", () => {
  for (const page of ["index.html", "editor/index.html"]) {
    const html = fs.readFileSync(path.join(dist, page), "utf8");
    const refs = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) assert.doesNotMatch(r, /webp_enc|webpWorker/, `${page} → ${r}`);
    for (const r of refs.filter((x) => x.endsWith(".js"))) {
      const js = fs.readFileSync(path.join(dist, "assets", r), "utf8");
      assert.doesNotMatch(js, /from\s*["']\.\/webp_enc/, `${r} importa el encoder estático`);
    }
  }
});

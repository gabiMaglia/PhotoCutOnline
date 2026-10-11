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
const read = (f) => fs.readFileSync(path.join(dist, "assets", f), "utf8");

// Nombres que solo existen en las opciones por defecto del wrapper de jSquash
// (meta.js). «@jsquash» no sirve: aparece en la lista de licencias del editor.
const ENCODER_MARK = /target_PSNR|emulate_jpeg_size/;

// Grafo ESTÁTICO de una página: script/modulepreload del HTML y, por cada chunk,
// sus `import … from "./x.js"` e `import "./x.js"`. Los import() no cuentan:
// eso es justamente lo diferido. (H-02: la guarda vieja miraba solo el HTML.)
function entryGraph(page) {
  const html = fs.readFileSync(path.join(dist, page), "utf8");
  const queue = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
  const seen = new Set();
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of read(f).matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) queue.push(m[1]);
  }
  return [...seen];
}

test("el encoder WebP se publica como .wasm aparte", () => {
  assert.ok(assets.some((f) => /^webp_enc(_simd)?-.+\.wasm$/.test(f)), assets.join(" "));
});

test("el wrapper de jSquash existe y es un chunk aparte (si no, la guarda de abajo no prueba nada)", () => {
  assert.ok(
    assets.some((f) => f.endsWith(".js") && ENCODER_MARK.test(read(f))),
    "ningún chunk contiene el wrapper de jSquash"
  );
});

test("ninguna página carga el encoder WebP de entrada (grafo estático completo)", () => {
  for (const page of ["index.html", "editor/index.html"]) {
    const html = fs.readFileSync(path.join(dist, page), "utf8");
    const refs = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) assert.doesNotMatch(r, /webp_enc|webpWorker|^encode-/, `${page} → ${r}`);
    for (const f of entryGraph(page)) {
      assert.doesNotMatch(f, /webp_enc|webpWorker|^encode-/, `${page} carga ${f} de entrada`);
      // assert.ok y no doesNotMatch: este no vuelca el chunk entero en el error
      assert.ok(!ENCODER_MARK.test(read(f)), `${page} → ${f} trae el wrapper de jSquash en la carga inicial`);
    }
  }
});

// BUG-08: el build versiona el service worker con el manifiesto del deploy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { buildSwManifest, injectSwBuild, injectBuildMeta } from "./swManifest.mjs";

const ASSETS = ["editor-AAA.js", "editor-BBB.css", "ort-wasm-CCC.mjs", "ort-wasm-DDD.wasm", "logo-EEE.png"];
const MODELS = ["u2netp.onnx"];
const HTML = { "/": "<html>landing</html>", "/editor/": "<html>editor</html>" };

test("shell = los dos HTML + JS/CSS/MJS; keep = todo /assets + /models", () => {
  const b = buildSwManifest({ assets: ASSETS, models: MODELS, html: HTML });
  assert.deepEqual(b.shell, ["/", "/editor/", "/assets/editor-AAA.js", "/assets/editor-BBB.css", "/assets/ort-wasm-CCC.mjs"]);
  assert.deepEqual(b.keep, [
    "/assets/editor-AAA.js",
    "/assets/editor-BBB.css",
    "/assets/logo-EEE.png",
    "/assets/ort-wasm-CCC.mjs",
    "/assets/ort-wasm-DDD.wasm",
    "/models/u2netp.onnx",
  ]);
  assert.match(b.id, /^[0-9a-f]{12}$/);
});

test("el id es estable si nada cambia y cambia con un asset o con el HTML", () => {
  const a = buildSwManifest({ assets: ASSETS, models: MODELS, html: HTML }).id;
  assert.equal(buildSwManifest({ assets: [...ASSETS].reverse(), models: MODELS, html: HTML }).id, a);
  assert.notEqual(buildSwManifest({ assets: ["editor-ZZZ.js", ...ASSETS.slice(1)], models: MODELS, html: HTML }).id, a);
  assert.notEqual(buildSwManifest({ assets: ASSETS, models: MODELS, html: { ...HTML, "/": "<html>otra</html>" } }).id, a);
  // un modelo nuevo exige nombre nuevo (GROW-36): el nombre sí cambia el id
  assert.notEqual(buildSwManifest({ assets: ASSETS, models: ["u2netp-v2.onnx"], html: HTML }).id, a);
});

test("injectSwBuild reemplaza el bloque centinela y tira si no está", () => {
  const src = 'const BUILD = /*__PHOTOCUT_BUILD__*/ { id: "dev", shell: [], keep: [] } /*__PHOTOCUT_BUILD_END__*/;\nrest();';
  const build = { id: "abc123def456", shell: ["/"], keep: [] };
  const out = injectSwBuild(src, build);
  assert.ok(out.includes('"id":"abc123def456"'));
  assert.ok(out.endsWith("rest();"));
  assert.ok(!out.includes('"dev"'));
  assert.throws(() => injectSwBuild("const BUILD = {};", build), /centinela/);
});

test("injectBuildMeta agrega el id al <head> una sola vez", () => {
  const html = "<html><head><title>x</title></head><body></body></html>";
  const out = injectBuildMeta(html, "abc123def456");
  assert.ok(out.includes('<meta name="photocut-build" content="abc123def456" />'));
  assert.equal(injectBuildMeta(out, "abc123def456"), out);
});

// GROW-36: el runtime WebGPU es solo del camino GPU; precachearlo se lo bajaría
// a todos (incluidos Safari sin WebGPU y equipos sin GPU). Se queda en keep.
test("el runtime WebGPU (bundle + asyncify) no entra al shell pero se conserva", () => {
  const gpu = ["ort.webgpu.bundle.min-XYZ.js", "ort-wasm-simd-threaded.asyncify-ABC.mjs", "ort-wasm-simd-threaded.asyncify-DEF.wasm"];
  const b = buildSwManifest({ assets: [...ASSETS, ...gpu], models: MODELS, html: HTML });
  for (const f of gpu) {
    assert.ok(!b.shell.includes(`/assets/${f}`), `${f} fuera del shell`);
    assert.ok(b.keep.includes(`/assets/${f}`), `${f} en keep`);
  }
  assert.ok(b.shell.includes("/assets/ort-wasm-CCC.mjs"), "el runtime WASM de siempre sigue en el shell");
});

// GROW-36: el modelo de 115 MB (en partes) nunca entra al precache del install
// (todo o nada: un visitante que no usa la IA, o que no tiene GPU, no debe
// bajarlo) y la poda conserva lo que se sirve: las partes de BiRefNet y u2netp.
test("con los modelos reales de public/models: ningún modelo en shell, partes de BiRefNet y u2netp en keep", () => {
  const models = readdirSync(new URL("../../public/models/", import.meta.url)).filter((f) => !f.startsWith("."));
  const b = buildSwManifest({ assets: ASSETS, models, html: HTML });
  assert.deepEqual(b.shell.filter((u) => u.startsWith("/models/")), []);
  for (const f of ["birefnet-lite-1024-fp16.onnx.part0", "birefnet-lite-1024-fp16.onnx.part1", "u2netp.onnx"])
    assert.ok(b.keep.includes(`/models/${f}`), `${f} en keep`);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { entries } = JSON.parse(fs.readFileSync(path.join(root, "src/generated/licenses.json"), "utf8"));
const find = (re) => entries.find((e) => re.test(e.name));

test("modelos de IA en «Acerca de y licencias», con aviso y textos publicados (GROW-36)", () => {
  const biref = find(/^BiRefNet/);
  assert.match(biref?.license ?? "", /^MIT/);
  assert.match(biref.license, /\/licenses\/ai-models-NOTICE\.txt/);
  assert.match(biref.name, /ZhengPeng7/);
  const u2 = find(/^U\^2-Net/);
  assert.match(u2?.license ?? "", /Apache-2\.0/);
  const notice = fs.readFileSync(path.join(root, "public/licenses/ai-models-NOTICE.txt"), "utf8");
  assert.match(notice, /birefnet-lite-1024-fp16\.onnx\.part0/);
  assert.match(notice, /4059896039dfccb0f15b9080ff06d11d90e499449bb045e797055eb8901cf5f4/);
  assert.match(notice, /ZhengPeng7\/BiRefNet/);
  assert.match(notice, /jiabins0303\/birefnet-lite-1024-webgpu/);
  assert.match(notice, /DIS5K/); // la salvedad que declara la propia model card
  assert.match(notice, /u2netp\.onnx/);
  assert.match(notice, /Permission is hereby granted, free of charge/); // texto MIT completo
  const apache = fs.readFileSync(path.join(root, "public/licenses/Apache-2.0.txt"), "utf8");
  assert.match(apache, /Apache License\s+Version 2\.0, January 2004/);
  assert.match(apache, /END OF TERMS AND CONDITIONS/);
  // los archivos de modelo que se nombran existen de verdad
  for (const f of ["birefnet-lite-1024-fp16.onnx.part0", "birefnet-lite-1024-fp16.onnx.part1", "u2netp.onnx"])
    assert.ok(fs.existsSync(path.join(root, "public/models", f)), f);
});

test("licencias del encoder WebP (GROW-35)", () => {
  assert.equal(find(/^@jsquash\/webp$/)?.license, "Apache-2.0");
  assert.equal(find(/^wasm-feature-detect$/)?.license, "Apache-2.0");
  const libwebp = find(/^libwebp/);
  assert.match(libwebp?.license ?? "", /BSD-3-Clause/);
  assert.match(libwebp.license, /\/licenses\/libwebp-COPYING\.txt/);
  const txt = fs.readFileSync(path.join(root, "public/licenses/libwebp-COPYING.txt"), "utf8");
  assert.match(txt, /Copyright \(c\) 2010, Google Inc\./);
  assert.match(txt, /Redistribution and use in source and binary forms/);
});

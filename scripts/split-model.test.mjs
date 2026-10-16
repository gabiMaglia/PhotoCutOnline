// GROW-36: el modelo BiRefNet viaja en partes (GitHub rechaza > 100 MB). Las
// partes que están en public/models tienen que rearmar EXACTAMENTE el modelo
// que dice src/lib/modelParts.json, o el worker rechaza la descarga por sha256.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { splitBuffer, sha256, partUrl, MODELS_DIR, PARTS_JSON, MAX_PART_BYTES } from "./split-model.mjs";

test("splitBuffer: contiguo, sin perder bytes, tamaños casi iguales", () => {
  const buf = Buffer.from(Array.from({ length: 1001 }, (_, i) => i % 251));
  const parts = splitBuffer(buf, 3);
  assert.equal(parts.length, 3);
  assert.deepEqual(Buffer.concat(parts), buf);
  assert.deepEqual(parts.map((p) => p.length), [334, 334, 333]);
});

test("partUrl lleva nombre versionado y número de parte", () => {
  assert.equal(partUrl("birefnet-lite-1024-fp16", 1), "/models/birefnet-lite-1024-fp16.onnx.part1");
});

test("las partes reales rearman el modelo de modelParts.json (bytes y sha256) y entran en git", () => {
  const { birefnet } = JSON.parse(readFileSync(PARTS_JSON, "utf8"));
  assert.ok(birefnet, "modelParts.json sin birefnet");
  assert.equal(birefnet.parts.length, 2);
  const bufs = birefnet.parts.map(({ url, bytes }) => {
    const b = readFileSync(path.join(MODELS_DIR, path.basename(url)));
    assert.equal(b.length, bytes, url);
    assert.ok(b.length < MAX_PART_BYTES, `${url} supera ${MAX_PART_BYTES}`);
    return b;
  });
  const total = Buffer.concat(bufs);
  assert.equal(total.length, birefnet.bytes);
  assert.equal(sha256(total), birefnet.sha256);
  assert.equal(birefnet.sha256, "4059896039dfccb0f15b9080ff06d11d90e499449bb045e797055eb8901cf5f4", "sha de la model card");
  // nada de partes huérfanas de otra versión
  const onDisk = readdirSync(MODELS_DIR).filter((f) => /\.part\d+$/.test(f)).sort();
  assert.deepEqual(onDisk, birefnet.parts.map(({ url }) => path.basename(url)).sort());
});

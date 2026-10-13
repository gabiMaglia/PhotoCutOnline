import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { entries } = JSON.parse(fs.readFileSync(path.join(root, "src/generated/licenses.json"), "utf8"));
const find = (re) => entries.find((e) => re.test(e.name));

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

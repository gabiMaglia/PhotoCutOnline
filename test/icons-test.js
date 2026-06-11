// Smoke test de Icon Studio: renderIcon + buildIconZip con canvas reales.
import { buildIconZip, renderIcon } from "../src/lib/icons.js";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

async function main() {
  const src = document.createElement("canvas");
  src.width = 512;
  src.height = 512;
  const ctx = src.getContext("2d");
  ctx.fillStyle = "#d6f64b";
  ctx.beginPath();
  ctx.arc(256, 256, 200, 0, Math.PI * 2);
  ctx.fill();

  const r = renderIcon(src, 128, { padding: 0.1, bg: "#101010" });
  assert(r.width === 128 && r.height === 128, "renderIcon: tamaño");

  const blob = await buildIconZip(src, { padding: 0.08, appName: "Demo" });
  assert(blob.size > 50000, `zip: ${blob.size} bytes`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert(bytes[0] === 0x50 && bytes[1] === 0x4b, "zip: firma PK");
  let count = 0;
  for (let i = 0; i < bytes.length - 4; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x01 &&
      bytes[i + 3] === 0x02
    ) {
      count++;
    }
  }
  assert(count >= 50, `zip: ${count} entradas ≥ 50`);
  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

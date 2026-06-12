// Smoke test de Icon Studio: renderIcon + buildIconZip con canvas reales.
import { buildIconZip, renderIcon, faviconSnippet } from "../src/lib/icons.js";

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
  assert(count >= 58, `zip: ${count} entradas ≥ 58 (con variantes 2026)`);

  // variantes: tinted = grises (R==G==B), monochrome = silueta blanca
  const tinted = renderIcon(src, 64, { variant: "tinted" });
  const td = tinted.getContext("2d").getImageData(32, 32, 1, 1).data;
  assert(td[0] === td[1] && td[1] === td[2], "tinted: píxel en escala de grises");
  const mono = renderIcon(src, 64, { variant: "monochrome" });
  const md = mono.getContext("2d").getImageData(32, 32, 1, 1).data;
  assert(md[0] === 255 && md[1] === 255 && md[2] === 255 && md[3] > 0, "monochrome: silueta blanca");
  assert(/apple-touch-icon/.test(faviconSnippet()), "snippet: contiene apple-touch-icon");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

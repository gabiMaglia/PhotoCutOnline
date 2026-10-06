// Genera public/favicon.ico (16/32/48, PNG embebido) desde el apple-touch-icon.
// Requiere `sips` (macOS) para reescalar; el .ico resultante se versiona, así
// que el build no depende de esta herramienta. Uso: node scripts/gen-favicon.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const src = path.resolve("public/icons/apple-touch-icon.png");
const out = path.resolve("public/favicon.ico");
const sizes = [16, 32, 48];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fav-"));

const pngs = sizes.map((s) => {
  const f = path.join(tmp, `${s}.png`);
  execFileSync("sips", ["-z", String(s), String(s), src, "--out", f], { stdio: "ignore" });
  return fs.readFileSync(f);
});

// ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes c/u) + imágenes PNG.
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s; // width
  e[1] = s; // height
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
fs.writeFileSync(out, Buffer.concat([header, ...entries, ...pngs]));
console.log(`favicon.ico: ${fs.statSync(out).size} bytes (${sizes.join("/")})`);

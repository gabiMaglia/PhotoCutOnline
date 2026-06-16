// Genera el ícono fuente de la app de escritorio: la media luna ácida (el mismo
// motivo del drop-zone / favicon) sobre fondo TRANSPARENTE, a 1024×1024.
// Luego correr:  npx tauri icon src-tauri/app-icon.png
// que produce todo el set (icns/ico/png) en src-tauri/icons.
//
//   node scripts/gen-app-icon.mjs

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();

const dataUrl = await page.evaluate(() => {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d"); // fondo transparente (sin fillRect)
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  // mitad rellena (la "foto" recortada) — mismo motivo que favicon/og
  ctx.fillStyle = "#d6f64b";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  // contorno completo
  ctx.strokeStyle = "#d6f64b";
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  return c.toDataURL("image/png");
});

writeFileSync(join(root, "src-tauri/app-icon.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
console.log("src-tauri/app-icon.png (1024×1024, transparente)");

await browser.close();

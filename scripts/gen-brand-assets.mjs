// Genera los assets de marca de la propia app (dogfooding del Icon Studio):
//   public/icons/icon-192.png, icon-512.png, maskable-512.png,
//   apple-touch-icon.png (180) y public/og.png (1200×630 para redes).
//
// Usa el Chrome instalado vía playwright-core (mismo stack que los tests).
//   node scripts/gen-brand-assets.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public/icons"), { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();

// ---- iconos: media luna ácida sobre grafito (mismo motivo que el favicon) ----
const iconPngs = await page.evaluate(() => {
  function drawIcon(size, { safeZone = 0.82, rounded = true } = {}) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (rounded) {
      const r = size * 0.22;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, r);
      ctx.clip();
    }
    ctx.fillStyle = "#0b0d10";
    ctx.fillRect(0, 0, size, size);
    // glow sutil
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
    glow.addColorStop(0, "rgba(214,246,75,0.16)");
    glow.addColorStop(1, "rgba(214,246,75,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) * safeZone * 0.66;
    // mitad rellena (la "foto" recortada)
    ctx.fillStyle = "#d6f64b";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    // contorno completo
    ctx.strokeStyle = "#d6f64b";
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    return c.toDataURL("image/png");
  }
  return {
    "icon-192.png": drawIcon(192),
    "icon-512.png": drawIcon(512),
    "maskable-512.png": drawIcon(512, { safeZone: 0.6, rounded: false }),
    "apple-touch-icon.png": drawIcon(180, { rounded: false }),
  };
});

for (const [name, dataUrl] of Object.entries(iconPngs)) {
  writeFileSync(
    join(root, "public/icons", name),
    Buffer.from(dataUrl.split(",")[1], "base64")
  );
  console.log(`public/icons/${name}`);
}

// ---- og.png: tarjeta social 1200×630 con la identidad darkroom ----
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: "Avenir Next", "Helvetica Neue", system-ui, sans-serif;
    background:
      radial-gradient(800px 500px at 80% -10%, rgba(214,246,75,0.10), transparent 60%),
      #0b0d10;
    color: #edf0e8; display: flex; align-items: center; padding: 0 90px;
    position: relative;
  }
  .checker {
    position: absolute; right: -60px; top: 50%; transform: translateY(-50%) rotate(8deg);
    width: 420px; height: 420px; border-radius: 36px; opacity: 0.9;
    background-image:
      linear-gradient(45deg, #1d2127 25%, transparent 25%),
      linear-gradient(-45deg, #1d2127 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #1d2127 75%),
      linear-gradient(-45deg, transparent 75%, #1d2127 75%);
    background-size: 36px 36px;
    background-position: 0 0, 0 18px, 18px -18px, -18px 0;
    background-color: #15181d;
    box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px #23272f;
  }
  .moon {
    position: absolute; right: 80px; top: 50%; transform: translateY(-50%);
    width: 220px; height: 220px; border-radius: 50%;
    border: 10px solid #d6f64b;
    background: linear-gradient(90deg, transparent 50%, #d6f64b 50%);
    box-shadow: 0 0 80px rgba(214,246,75,0.35);
  }
  .text { max-width: 620px; position: relative; }
  .brand { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 28px; }
  .brand em { font-style: normal; font-weight: 300; color: #9aa194; }
  h1 { font-size: 72px; font-weight: 800; letter-spacing: -2.5px; line-height: 1.04; margin-bottom: 26px; }
  h1 span { color: #d6f64b; }
  p { font-size: 27px; color: #9aa194; line-height: 1.4; }
</style></head><body>
  <div class="checker"></div><div class="moon"></div>
  <div class="text">
    <div class="brand">◑ PhotoCut <em>Studio</em></div>
    <h1>Quita el fondo.<br><span>100% en tu navegador.</span></h1>
    <p>Recorte interactivo, canal alfa, exportación e iconos de app en todas las medidas. Tus fotos nunca salen de tu equipo.</p>
  </div>
</body></html>`);
await page.screenshot({ path: join(root, "public/og.png") });
console.log("public/og.png");

await browser.close();

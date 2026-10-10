// Presets de sticker (BUG-06) con un recorte real: retrato de las guías →
// Recorte IA → preset Sticker WhatsApp / Telegram. Comprueba lo que piden las
// apps: 512×512 exacto, esquinas transparentes, sujeto sin deformar y, en
// WhatsApp, WebP de 100 KB como mucho (bajando calidad si hiciera falta).

import { backend } from "../src/lib/backend.js";
import { EXPORT_PRESETS, fitWithinBytes } from "../src/lib/presets.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[sticker-test]", s);
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const presetOf = (id) => EXPORT_PRESETS.find((p) => p.id === id).preset;

async function analyze(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none" });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const { data: d, width: W, height: H } = g.getImageData(0, 0, bmp.width, bmp.height);
  // bbox del sujeto opaco (alfa ≥ 128): el borde suavizado no cuenta
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] >= 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const a = (x, y) => d[(y * W + x) * 4 + 3];
  return {
    blob,
    w: W,
    h: H,
    bytes: blob.size,
    corners: [a(0, 0), a(W - 1, 0), a(0, H - 1), a(W - 1, H - 1)],
    bw: x1 - x0 + 1,
    bh: y1 - y0 + 1,
    ratio: (x1 - x0 + 1) / (y1 - y0 + 1),
  };
}

async function main() {
  const src = await (await fetch("/media/guias/quitar-fondo-antes.jpg")).blob();
  const dataUrl = await new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(src);
  });
  await backend.loadImage(dataUrl);
  assert((await backend.warmupAi()) === true, "modelo IA cargado");
  await backend.aiCut();

  // referencia: el recorte a tamaño original, para comparar la proporción
  const ref = await analyze(await backend.exportTransparent({ format: "png" }));
  log(`referencia: ${ref.w}×${ref.h}, sujeto ${ref.bw}×${ref.bh} (ratio ${ref.ratio.toFixed(4)})`);

  // WhatsApp: WebP 512, ≤100 KB (mismo ajuste de calidad que usa el editor)
  const WA = presetOf("sticker-whatsapp");
  const fit = await fitWithinBytes(
    async (quality) => {
      const url = await backend.exportTransparent({ format: WA.format, quality, preset: WA });
      return { url, bytes: (await (await fetch(url)).blob()).size };
    },
    { maxBytes: WA.maxBytes }
  );
  const wa = await analyze(fit.url);
  log(`whatsapp: ${wa.w}×${wa.h}, ${(wa.bytes / 1024).toFixed(1)} KB, calidad ${fit.quality.toFixed(2)}, sujeto ${wa.bw}×${wa.bh}`);
  assert(wa.blob.type === "image/webp", "whatsapp: formato WebP");
  assert(wa.w === 512 && wa.h === 512, "whatsapp: 512×512 exacto");
  assert(wa.corners.every((v) => v === 0), `whatsapp: esquinas alpha 0 (${wa.corners.join(",")})`);
  assert(
    Math.abs(wa.ratio / ref.ratio - 1) <= 0.01,
    `whatsapp: proporción del sujeto ±1 % (${wa.ratio.toFixed(4)} vs ${ref.ratio.toFixed(4)})`
  );
  assert(wa.bytes <= 100 * 1024, `whatsapp: ≤100 KB (${(wa.bytes / 1024).toFixed(1)} KB)`);
  // margen ~8 %: el lado mayor del sujeto ocupa 512·(1−2·0,08) ≈ 430 px
  const waLong = Math.max(wa.bw, wa.bh);
  assert(Math.abs(waLong - 512 * 0.84) <= 4, `whatsapp: margen 8 % (lado mayor ${waLong} px)`);

  // Telegram: PNG 512, transparente
  const TG = presetOf("sticker-telegram");
  const tg = await analyze(await backend.exportTransparent({ format: TG.format, preset: TG }));
  log(`telegram: ${tg.w}×${tg.h}, ${(tg.bytes / 1024).toFixed(1)} KB, sujeto ${tg.bw}×${tg.bh}`);
  assert(tg.blob.type === "image/png", "telegram: formato PNG");
  assert(tg.w === 512 && tg.h === 512, "telegram: 512×512 exacto");
  assert(tg.corners.every((v) => v === 0), `telegram: esquinas alpha 0 (${tg.corners.join(",")})`);
  assert(
    Math.abs(tg.ratio / ref.ratio - 1) <= 0.01,
    `telegram: proporción del sujeto ±1 % (${tg.ratio.toFixed(4)} vs ${ref.ratio.toFixed(4)})`
  );

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

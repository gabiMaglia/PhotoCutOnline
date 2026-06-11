// Benchmark del motor con una "foto de móvil" sintética de 12MP (4000×3000).
// Mide lo que siente el usuario: carga, recorte, cada trazo de pincel y el
// slider de feather. Imprime ms por operación.

import { CutoutSession } from "../src/lib/jsEngine.js";

const out = [];
const log = (s) => out.push(s);

function bigPhoto(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#2a3340");
  grad.addColorStop(1, "#0d1117");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // "sujeto" grande con textura
  ctx.fillStyle = "#c8b89a";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.5, w * 0.22, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},${100 + Math.random() * 40},0.5)`;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * w * 0.2;
    ctx.fillRect(w * 0.5 + Math.cos(a) * r, h * 0.5 + Math.sin(a) * r * 1.5, 8, 8);
  }
  return ctx.getImageData(0, 0, w, h);
}

async function time(name, fn) {
  const t0 = performance.now();
  const r = await fn();
  const ms = Math.round(performance.now() - t0);
  log(`${name}: ${ms} ms`);
  return r;
}

async function main() {
  const W = 4000;
  const H = 3000;
  const img = await time("crear foto 12MP", () => bigPhoto(W, H));

  const s = new CutoutSession();
  await time("load (sesión)", () => s.load(img));
  await time("cutRect + preview", () =>
    s.cutRect({ x: 800, y: 300, w: 2400, h: 2400 })
  );
  await time("trazo pincel 1 + preview", () =>
    s.addStroke({ points: [{ x: 1200, y: 600 }, { x: 1600, y: 800 }, { x: 2000, y: 1000 }], radius: 40, foreground: true })
  );
  await time("trazo pincel 2 + preview", () =>
    s.addStroke({ points: [{ x: 900, y: 2500 }, { x: 1100, y: 2600 }], radius: 30, foreground: false })
  );
  s.setFeather(8);
  await time("feather=8 + preview", () => s.previewBlob());
  await time("export transparente full-res", () => s.composite({ type: "transparent" }));
  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

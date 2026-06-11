// Smoke test del motor de recorte: imagen sintética (cuadrado claro sobre
// fondo oscuro con ruido) → cutRect / autoCut / stroke / undo / composite.
// Se ejecuta en Chrome headless; escribe PASS/FAIL en #out.

import { CutoutSession } from "../src/lib/jsEngine.js";

const out = [];
const log = (s) => out.push(s);

function syntheticImage(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(0, 0, w, h);
  // ruido de fondo
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${20 + Math.random() * 30},${30 + Math.random() * 30},${50 + Math.random() * 30},1)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  // sujeto: rectángulo lima con esquina coral
  ctx.fillStyle = "#d6f64b";
  ctx.fillRect(60, 40, 120, 90);
  ctx.fillStyle = "#ff5e63";
  ctx.fillRect(60, 40, 30, 30);
  return ctx.getImageData(0, 0, w, h);
}

function subjectAccuracy(session, w, h) {
  // ground truth: sujeto = [60,180)x[40,130)
  const label = session.label;
  const sw = session.work.width;
  const sx = session.scale;
  let ok = 0;
  let total = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const truth = x >= 60 && x < 180 && y >= 40 && y < 130 ? 1 : 0;
      const wx = Math.min(sw - 1, Math.round(x * sx));
      const wy = Math.round(y * sx);
      const got = label[wy * sw + wx];
      if (got === truth) ok++;
      total++;
    }
  }
  return ok / total;
}

async function main() {
  const W = 240;
  const H = 180;
  const img = syntheticImage(W, H);

  const s = new CutoutSession();
  s.load(img);
  assert(s.work.width === W, "carga: resolución de trabajo");

  // 1. cutRect alrededor del sujeto (con margen)
  let url = s.cutRect({ x: 45, y: 28, w: 150, h: 115 });
  assert(typeof url === "string" && url.startsWith("data:image/png"), "cutRect: preview dataURL");
  const accRect = subjectAccuracy(s, W, H);
  assert(accRect > 0.93, `cutRect: precisión ${(accRect * 100).toFixed(1)}% > 93%`);

  // 2. stroke quitar en una esquina del fondo dentro del rect
  url = s.addStroke({ points: [{ x: 50, y: 33 }, { x: 56, y: 36 }], radius: 4, foreground: false });
  assert(typeof url === "string", "stroke: devuelve preview");
  assert(s.canUndo, "undo: disponible tras stroke");

  // 3. undo
  url = s.undo();
  assert(typeof url === "string", "undo: restaura preview");

  // 4. composite sólido
  const solid = await s.composite({ type: "solid", color: [255, 0, 0, 255] });
  assert(solid.startsWith("data:image/png"), "composite sólido: PNG");
  const webp = await s.composite({ type: "transparent", format: "webp" });
  assert(webp.startsWith("data:image/webp"), "composite: formato webp");

  // 5. autoCut en sesión nueva
  const s2 = new CutoutSession();
  s2.load(syntheticImage(W, H));
  url = s2.autoCut();
  assert(typeof url === "string", "autoCut: preview");
  const accAuto = subjectAccuracy(s2, W, H);
  assert(accAuto > 0.9, `autoCut: precisión ${(accAuto * 100).toFixed(1)}% > 90%`);

  // 6. feather no rompe nada
  s2.setFeather(6);
  assert(s2.previewUrl().startsWith("data:image/png"), "feather: preview OK");

  log("ALL_DONE");
}

function assert(cond, name) {
  log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) throw new Error(name);
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

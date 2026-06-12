// Smoke test del motor de recorte: imagen sintética (cuadrado claro sobre
// fondo oscuro con ruido) → cutRect / autoCut / stroke / undo / composite.
// Se ejecuta en Chrome headless; escribe PASS/FAIL en #out.

import { CutoutSession } from "../src/lib/jsEngine.js";
import wasmInit, { WasmCut } from "../src/lib/wasm/photocut_wasm.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[test]", s);
};

// PRNG con semilla (mulberry32): el test debe ser determinista — sin esto,
// una distribución desafortunada del ruido hace fallar autoCut a veces.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function syntheticImage(w, h) {
  const rnd = mulberry32(42);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(0, 0, w, h);
  // ruido de fondo
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${20 + rnd() * 30},${30 + rnd() * 30},${50 + rnd() * 30},1)`;
    ctx.fillRect(rnd() * w, rnd() * h, 3, 3);
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
  let blob = await s.cutRect({ x: 45, y: 28, w: 150, h: 115 });
  assert(blob instanceof Blob && blob.type === "image/png", "cutRect: preview Blob PNG");
  const accRect = subjectAccuracy(s, W, H);
  assert(accRect > 0.93, `cutRect: precisión ${(accRect * 100).toFixed(1)}% > 93%`);

  // 2. stroke quitar en una esquina del fondo dentro del rect
  blob = await s.addStroke({ points: [{ x: 50, y: 33 }, { x: 56, y: 36 }], radius: 4, foreground: false });
  assert(blob instanceof Blob, "stroke: devuelve preview");
  assert(s.canUndo, "undo: disponible tras stroke");

  // 3. undo / redo
  blob = await s.undo();
  assert(blob instanceof Blob, "undo: restaura preview");
  assert(s.canRedo, "redo: disponible tras deshacer");
  blob = await s.redo();
  assert(blob instanceof Blob, "redo: restaura el estado deshecho");
  assert(!s.canRedo, "redo: stack vacío tras rehacer");
  blob = await s.undo(); // volver al estado sin el stroke para el resto del test
  assert(blob instanceof Blob, "undo: de nuevo tras redo");

  // 4. composite sólido
  const solid = await s.composite({ type: "solid", color: [255, 0, 0, 255] });
  assert(solid instanceof Blob && solid.type === "image/png", "composite sólido: PNG");
  const webp = await s.composite({ type: "transparent", format: "webp" });
  assert(webp instanceof Blob && webp.type === "image/webp", "composite: formato webp");

  // 5. autoCut en sesión nueva
  const s2 = new CutoutSession();
  s2.load(syntheticImage(W, H));
  blob = await s2.autoCut();
  assert(blob instanceof Blob, "autoCut: preview");
  const accAuto = subjectAccuracy(s2, W, H);
  assert(accAuto > 0.9, `autoCut: precisión ${(accAuto * 100).toFixed(1)}% > 90%`);

  // 6. feather no rompe nada
  s2.setFeather(6);
  const fblob = await s2.previewBlob();
  assert(fblob instanceof Blob && fblob.type === "image/png", "feather: preview OK");

  // 7. acabado: sticker + sombra + preset
  s2.setFeather(0); // el feather de la sección 6 mezclaría el borde con el contorno
  s2.setFinish({ sticker: { width: 8, color: [255, 255, 255] }, shadow: null });
  let fin = await s2.previewBlob();
  assert(fin instanceof Blob, "sticker: preview con contorno");
  // el contorno blanco debe aparecer justo fuera del sujeto
  const finImg = await blobToImageData(fin);
  const probe = px(finImg, 56, 85); // 4px a la izquierda del sujeto (x=60..180)
  assert(
    probe[3] > 200 && probe[0] > 240 && probe[1] > 240 && probe[2] > 240,
    `sticker: píxel (56,85) blanco opaco (rgba ${probe.join(",")})`
  );
  s2.setFinish({ sticker: null, shadow: { blur: 10, dx: 0, dy: 8, opacity: 0.6 } });
  fin = await s2.previewBlob();
  const shImg = await blobToImageData(fin);
  const below = px(shImg, 120, 140); // bajo el sujeto (y>130)
  assert(below[3] > 10, `sombra: alfa presente bajo el sujeto (a=${below[3]})`);
  s2.setFinish({ sticker: null, shadow: null });

  // 7b. refinado del matte IA: niebla decidida y fantasmas eliminados
  const s4 = new CutoutSession();
  s4.load(syntheticImage(W, H));
  const matte = new Uint8ClampedArray(W * H);
  for (let y = 40; y < 130; y++)
    for (let x = 60; x < 180; x++) matte[y * W + x] = 230; // sujeto principal
  for (let y = 150; y < 160; y++)
    for (let x = 200; x < 215; x++) matte[y * W + x] = 200; // fantasma pequeño
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < W; x++) matte[y * W + x] = 90; // niebla de confianza media
  blob = await s4.aiCutFromMatte(matte);
  assert(blob instanceof Blob, "matte: preview tras refinado");
  assert(s4.softAlpha[80 * W + 120] === 255, "matte: sujeto decidido a opaco");
  assert(s4.softAlpha[155 * W + 207] === 0, "matte: fantasma eliminado");
  assert(s4.softAlpha[8 * W + 120] === 0, "matte: niebla (blur) eliminada");

  // 8. preset: avatar circular 512 — tamaño exacto y esquinas transparentes
  const av = await s2.composite({
    type: "transparent",
    preset: { w: 512, h: 512, padding: 0.1, bg: null, circle: true },
  });
  const avImg = await blobToImageData(av);
  assert(avImg.width === 512 && avImg.height === 512, "preset: lienzo 512×512");
  assert(px(avImg, 3, 3)[3] === 0, "preset circular: esquina transparente");
  assert(px(avImg, 256, 256)[3] > 0, "preset circular: centro con contenido");
  const amz = await s2.composite({
    type: "transparent",
    preset: { w: 2000, h: 2000, padding: 0.05, bg: "#ffffff" },
  });
  const amzImg = await blobToImageData(amz);
  const corner = px(amzImg, 5, 5);
  assert(
    amzImg.width === 2000 && corner[0] === 255 && corner[3] === 255,
    "preset amazon: 2000² con fondo blanco"
  );

  // 9. motor WASM (GrabCut real): misma API, precisión igual o mejor
  await wasmInit();
  const s3 = new CutoutSession();
  s3.attachWasm(WasmCut);
  assert(s3.engineName === "wasm", "wasm: motor conectado");
  s3.load(syntheticImage(W, H));
  blob = await s3.cutRect({ x: 45, y: 28, w: 150, h: 115 });
  assert(blob instanceof Blob, "wasm: cutRect produce preview");
  const accWasm = subjectAccuracy(s3, W, H);
  assert(accWasm > 0.93, `wasm: precisión ${(accWasm * 100).toFixed(1)}% > 93%`);
  blob = await s3.addStroke({ points: [{ x: 50, y: 33 }], radius: 4, foreground: false });
  assert(blob instanceof Blob, "wasm: stroke refina");
  blob = await s3.undo();
  assert(blob instanceof Blob && s3.canRedo, "wasm: undo/redo operativos");

  log("ALL_DONE");
}

async function blobToImageData(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

function px(img, x, y) {
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
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

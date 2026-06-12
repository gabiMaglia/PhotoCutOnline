// Test E2E del recorte IA (N1): backend → worker → onnxruntime-web + u2netp.
// Imagen sintética foto-realista-ish: "sujeto" con gradiente y sombra sobre
// fondo con viñeta. u2netp es detección de objeto saliente: comprobamos
// funcionamiento (matte, pinceles sobre matte, undo) e informamos el IoU.

import { backend } from "../src/lib/backend.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[ai-test]", s);
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

function syntheticPhoto(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  // fondo con viñeta
  const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.8);
  bg.addColorStop(0, "#3a4252");
  bg.addColorStop(1, "#12161e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // sujeto: círculo con gradiente cálido + "cabeza"
  const subj = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.85);
  subj.addColorStop(0, "#ffd9a0");
  subj.addColorStop(1, "#c96f3b");
  ctx.fillStyle = subj;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.62, w * 0.18, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.3, w * 0.11, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function truthAt(x, y, w, h) {
  const inBody =
    ((x - w / 2) / (w * 0.18)) ** 2 + ((y - h * 0.62) / (h * 0.25)) ** 2 <= 1;
  const inHead = (x - w / 2) ** 2 + (y - h * 0.3) ** 2 <= (w * 0.11) ** 2;
  return inBody || inHead;
}

async function decodeAlpha(url) {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

async function main() {
  const W = 320;
  const H = 320;
  const photo = syntheticPhoto(W, H);
  await backend.loadImage(photo.toDataURL("image/png"));

  log("descargando modelo…");
  const warm = await backend.warmupAi();
  assert(warm === true, "warmup: modelo + runtime cargados");

  const t0 = performance.now();
  const url = await backend.aiCut();
  log(`inferencia + preview: ${Math.round(performance.now() - t0)} ms`);
  assert(typeof url === "string" && url.startsWith("blob:"), "aiCut: devuelve preview");

  // matte: debe separar sujeto de fondo (IoU informativo, umbral laxo —
  // u2netp es genérico y la imagen es sintética)
  const img = await decodeAlpha(url);
  let inter = 0;
  let union = 0;
  let softEdges = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const a = img.data[(y * img.width + x) * 4 + 3];
      const fg = a > 127;
      const truth = truthAt(x, y, W, H);
      if (fg && truth) inter++;
      if (fg || truth) union++;
      if (a > 20 && a < 235) softEdges++;
    }
  }
  const iou = union ? inter / union : 0;
  log(`IoU vs verdad sintética: ${(iou * 100).toFixed(1)}%`);
  assert(iou > 0.3, `matte: separación razonable (IoU ${(iou * 100).toFixed(1)}% > 30%)`);
  assert(softEdges > 20, `matte: bordes suaves presentes (${softEdges} px intermedios)`);

  // pinceles sobre el matte (no re-segmentan: editan el alfa)
  const url2 = await backend.refine({
    points: [{ x: 10, y: 10 }, { x: 40, y: 10 }],
    radius: 8,
    foreground: true,
  });
  const img2 = await decodeAlpha(url2);
  assert(img2.data[(10 * img2.width + 20) * 4 + 3] === 255, "pincel: pinta el matte a 255");

  const url3 = await backend.undo();
  assert(url3?.startsWith("blob:"), "undo: restaura el matte IA");
  assert(backend.canRedo(), "redo: disponible");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

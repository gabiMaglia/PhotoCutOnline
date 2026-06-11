// Test del tope de tamaño de imagen y detección de formatos (P0).
import {
  inspectImageFile,
  bitmapToDataUrl,
  MAX_PIXELS,
  DOWNSCALE_MAX_DIM,
} from "../src/lib/imageFile.js";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

function canvasFile(w, h, name = "foto.png", type = "image/png") {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d6f64b";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(0, 0, Math.floor(w / 2), h);
  return new Promise((resolve) =>
    c.toBlob((b) => resolve(new File([b], name, { type })), type)
  );
}

function decode(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function main() {
  // 1. HEIC por tipo MIME y por extensión (sin intentar decodificar)
  let r = await inspectImageFile(new File([new Uint8Array(8)], "foto.jpg", { type: "image/heic" }));
  assert(r.kind === "heic", "HEIC por MIME detectado");
  r = await inspectImageFile(new File([new Uint8Array(8)], "IMG_0001.HEIC", { type: "" }));
  assert(r.kind === "heic", "HEIC por extensión detectado");

  // 2. archivo no decodificable
  r = await inspectImageFile(new File(["esto no es una imagen"], "x.png", { type: "image/png" }));
  assert(r.kind === "undecodable", "archivo corrupto → undecodable");

  // 3. imagen normal
  r = await inspectImageFile(await canvasFile(640, 480));
  assert(r.kind === "ok" && r.width === 640 && r.height === 480, "imagen normal → ok con dimensiones");
  r.bitmap.close();

  // 4. imagen > 24MP → oversized
  const W = 5800;
  const H = 4200; // 24.36MP
  assert(W * H > MAX_PIXELS, "fixture: supera MAX_PIXELS");
  r = await inspectImageFile(await canvasFile(W, H, "grande.png"));
  assert(r.kind === "oversized" && r.width === W, "imagen 24.4MP → oversized");

  // 5. reducción a 4K conserva aspecto y respeta el tope
  const url = bitmapToDataUrl(r.bitmap, DOWNSCALE_MAX_DIM, "image/png");
  r.bitmap.close();
  const img = await decode(url);
  assert(
    Math.max(img.naturalWidth, img.naturalHeight) === DOWNSCALE_MAX_DIM,
    `reducida: lado mayor = ${DOWNSCALE_MAX_DIM}`
  );
  const aspectSrc = W / H;
  const aspectDst = img.naturalWidth / img.naturalHeight;
  assert(Math.abs(aspectSrc - aspectDst) < 0.01, "reducida: aspecto conservado");

  // 6. JPEG de origen se reduce como JPEG (sin alfa, pesa menos)
  const jpgSrc = await canvasFile(5800, 4200, "grande.jpg", "image/jpeg");
  const rj = await inspectImageFile(jpgSrc);
  const urlJpg = bitmapToDataUrl(rj.bitmap, DOWNSCALE_MAX_DIM, "image/jpeg");
  rj.bitmap.close();
  assert(urlJpg.startsWith("data:image/jpeg"), "fuente JPEG → salida JPEG");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

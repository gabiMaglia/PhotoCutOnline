// T-014/T-015 en Chrome REAL: verifica el comportamiento de píxeles que los
// tests de jest NO pueden, porque en jsdom el canvas está mockeado. Acá el
// canvas es de verdad, así que se comprueba lo que le pasa a la imagen, no sólo
// qué argumentos recibe toBlob.
//
// El caso que importa: transparente → JPG debe rellenar BLANCO, no el negro que
// el canvas usa por defecto. Ese bug no se ve con mocks.

import { reencodeToBlob, hasTransparency, fitSize } from "../src/lib/metadata.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[reencode-test]", s);
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

// Fuente: mitad izquierda TRANSPARENTE, mitad derecha roja opaca. reencodeToBlob
// acepta cualquier cosa dibujable con .width/.height → un canvas sirve como
// "img" (drawImage lo acepta y usa canvas.width al no haber naturalWidth).
function source(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h); // izquierda: transparente
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(w / 2, 0, w / 2, h); // derecha: rojo opaco
  return c;
}

async function decode(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  return { ctx, w: bmp.width, h: bmp.height };
}
const px = (ctx, x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);

async function main() {
  const W = 80;
  const H = 40;
  const src = source(W, H);

  // 0. la fuente efectivamente tiene transparencia (sanity + prueba de hasTransparency)
  assert(hasTransparency(src) === true, "hasTransparency detecta la zona transparente");

  // 1. EL GOTCHA: transparente → JPG rellena BLANCO, no negro.
  const jpg = await reencodeToBlob(src, { format: "jpeg", quality: 0.9 });
  assert(jpg.type === "image/jpeg", "jpeg: mime correcto");
  {
    const { ctx } = await decode(jpg);
    const [r, g, b] = px(ctx, 5, 20); // zona que era transparente
    // JPG mete algo de ruido de compresión: se admite margen, pero tiene que ser
    // CLARO (blanco), no oscuro (negro). Negro sería < 60; blanco > 230.
    assert(r > 230 && g > 230 && b > 230, `jpeg: la zona transparente quedó BLANCA (rgb ${r},${g},${b}), no negra`);
    const [rr] = px(ctx, W - 5, 20); // zona roja
    assert(rr > 180, `jpeg: la zona roja sigue siendo roja (r=${rr})`);
  }

  // 2. PNG conserva la transparencia (no rellena)
  const png = await reencodeToBlob(src, { format: "png" });
  assert(png.type === "image/png", "png: mime correcto");
  {
    const { ctx } = await decode(png);
    const a = px(ctx, 5, 20)[3];
    assert(a === 0, `png: la zona transparente sigue transparente (alpha=${a})`);
  }

  // 3. WebP también conserva alfa
  const webp = await reencodeToBlob(src, { format: "webp", quality: 0.9 });
  if (webp && webp.type === "image/webp") {
    const { ctx } = await decode(webp);
    const a = px(ctx, 5, 20)[3];
    assert(a < 128, `webp: conserva la transparencia (alpha=${a})`);
  } else {
    log("SKIP: este navegador no exporta WebP");
  }

  // 4. background explícito: transparente → JPG con fondo elegido
  const jpgBlue = await reencodeToBlob(src, { format: "jpeg", quality: 0.9, background: "#0000ff" });
  {
    const { ctx } = await decode(jpgBlue);
    const [r, g, b] = px(ctx, 5, 20);
    assert(b > 200 && r < 60 && g < 60, `jpeg: respeta el background azul (rgb ${r},${g},${b})`);
  }

  // 5. redimensionado: el blob decodifica al tamaño pedido
  const small = await reencodeToBlob(src, { format: "png", width: 40, height: 20 });
  {
    const { w, h } = await decode(small);
    assert(w === 40 && h === 20, `resize: salida ${w}×${h} = 40×20 pedido`);
  }

  // 6. fitSize respeta la proporción de la fuente 80×40 (2:1)
  assert(fitSize(W, H, { width: 40, lock: true }).height === 20, "fitSize: 40 de ancho → 20 de alto (2:1)");

  // 7. calidad: menos calidad → menos peso (en un JPG con contenido real)
  const photo = document.createElement("canvas");
  photo.width = 200; photo.height = 200;
  const pctx = photo.getContext("2d");
  const grad = pctx.createLinearGradient(0, 0, 200, 200);
  grad.addColorStop(0, "#ff8800"); grad.addColorStop(1, "#0088ff");
  pctx.fillStyle = grad; pctx.fillRect(0, 0, 200, 200);
  for (let i = 0; i < 300; i++) { pctx.fillStyle = `hsl(${i},70%,50%)`; pctx.fillRect((i * 37) % 200, (i * 53) % 200, 6, 6); }
  const hi = await reencodeToBlob(photo, { format: "jpeg", quality: 0.95 });
  const lo = await reencodeToBlob(photo, { format: "jpeg", quality: 0.3 });
  assert(lo.size < hi.size, `calidad: q0.3 (${lo.size}b) pesa menos que q0.95 (${hi.size}b)`);

  log("ALL_DONE");
}

main().catch((e) => log(`ERROR: ${e.message}`));

const el = document.getElementById("out");
setInterval(() => (el.textContent = out.join("\n")), 100);

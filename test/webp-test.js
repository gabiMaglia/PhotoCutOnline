// GROW-35: WebP real en cualquier motor. Corre en Chrome (nativo) y en WebKit
// (sin WebP en canvas, así que codifica el WASM). Mira los BYTES: cabecera
// RIFF/WEBP, flag de alfa, tamaño y peso, y que el tipo declarado sea el
// contenido. El nombre de archivo sale del tipo, y eso lo cubre jest.
import { backend } from "../src/lib/backend.js";
import { EXPORT_PRESETS, fitWithinBytes } from "../src/lib/presets.js";
import { reencodeToBlob } from "../src/lib/metadata.js";
import { canEncodeWebP } from "../src/lib/webpEncoder.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[webp-test]", s);
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const str = (u, a, b) => String.fromCharCode(...u.slice(a, b));
const magic = (u) =>
  str(u, 0, 4) === "RIFF" && str(u, 8, 12) === "WEBP" ? "webp"
    : u[0] === 0x89 && str(u, 1, 4) === "PNG" ? "png"
    : u[0] === 0xff && u[1] === 0xd8 ? "jpeg"
    : "?";

async function inspect(blob) {
  const u = new Uint8Array(await blob.arrayBuffer());
  const vp8x = str(u, 12, 16) === "VP8X";
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none" });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0);
  const a = (x, y) => g.getImageData(x, y, 1, 1).data[3];
  const W = bmp.width - 1, H = bmp.height - 1;
  return {
    kind: magic(u), vp8x, alphaFlag: vp8x && !!(u[20] & 0x10),
    w: bmp.width, h: bmp.height, bytes: u.length,
    corners: [a(0, 0), a(W, 0), a(0, H), a(W, H)],
  };
}
const blobOf = async (url) => (await fetch(url)).blob();

// mitad izquierda transparente, derecha roja (fuente de la pestaña Archivo)
function source(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#ff0000";
  g.fillRect(w / 2, 0, w / 2, h);
  return c;
}

async function main() {
  const native = await canEncodeWebP();
  log(`ruta=${native ? "nativa" : "wasm"}`);

  const src = await blobOf("/media/guias/quitar-fondo-antes.jpg");
  const dataUrl = await new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(src);
  });
  await backend.loadImage(dataUrl);
  await backend.autoCut();

  // 1. Sticker WhatsApp con el mismo ajuste de peso que el editor
  const WA = EXPORT_PRESETS.find((p) => p.id === "sticker-whatsapp").preset;
  const fit = await fitWithinBytes(
    async (quality) => {
      const url = await backend.exportTransparent({ format: "webp", quality, preset: WA });
      const b = await blobOf(url);
      return { url, bytes: b.size, type: b.type };
    },
    { maxBytes: WA.maxBytes }
  );
  const wa = await inspect(await blobOf(fit.url));
  log(`sticker: ${wa.kind} ${wa.w}×${wa.h} ${(wa.bytes / 1024).toFixed(1)} KB q=${fit.quality}`);
  assert(wa.kind === "webp" && fit.type === "image/webp", `sticker: bytes WebP y tipo image/webp (${wa.kind}, ${fit.type})`);
  assert(wa.vp8x && wa.alphaFlag, "sticker: cabecera VP8X con flag de alfa");
  assert(wa.w === 512 && wa.h === 512, `sticker: 512×512 (${wa.w}×${wa.h})`);
  assert(wa.corners.every((v) => v === 0), `sticker: esquinas alfa 0 (${wa.corners.join(",")})`);
  assert(wa.bytes <= 100 * 1024, `sticker: ≤100 KB (${(wa.bytes / 1024).toFixed(1)} KB)`);

  // 2. chip WebP de Exportar, sin preset
  const plain = await inspect(await blobOf(await backend.exportTransparent({ format: "webp", quality: 0.92 })));
  assert(plain.kind === "webp" && plain.alphaFlag, "exportar WebP sin preset: WebP real con alfa");

  // 3. pestaña Archivo → WebP
  const s = source(80, 40);
  const arch = await reencodeToBlob(s, { format: "webp", quality: 0.8 });
  const ai = await inspect(arch);
  assert(arch.type === "image/webp" && ai.kind === "webp", `archivo: WebP real (${arch.type}, ${ai.kind})`);
  assert(ai.corners[0] < 128, `archivo: conserva la transparencia (alfa ${ai.corners[0]})`);

  // 4. el tipo declarado es el contenido, en los tres formatos y en los dos productores
  for (const f of ["png", "jpeg", "webp"]) {
    const e = await blobOf(await backend.exportSolid([255, 255, 255, 255], { format: f }));
    const ek = magic(new Uint8Array(await e.arrayBuffer()));
    assert(ek === f && e.type === MIME[ek], `editor ${f}: tipo ${e.type} = bytes ${ek}`);
    const r = await reencodeToBlob(s, { format: f, quality: 0.8 });
    const rk = magic(new Uint8Array(await r.arrayBuffer()));
    assert(rk === f && r.type === MIME[rk], `archivo ${f}: tipo ${r.type} = bytes ${rk}`);
  }
  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

// GROW-35 D2: si la primera carga del encoder WebP falla (sin red), el
// reintento con red tiene que funcionar, tanto en el editor (que codifica
// dentro de cutoutWorker) como en Archivo. Corre solo en WebKit, porque
// Chrome codifica WebP nativo y nunca pide el encoder. El runner bloquea el
// encoder hasta PHASE1_DONE y después llama a window.__unblock().
import { backend } from "../src/lib/backend.js";
import { reencodeToBlob } from "../src/lib/metadata.js";
import { canEncodeWebP, isWebpEncodeError } from "../src/lib/webpEncoder.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[webp-retry-test]", s);
  document.getElementById("out").textContent = out.join("\n");
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const str = (u, a, b) => String.fromCharCode(...u.slice(a, b));
const isWebp = async (blob) => {
  const u = new Uint8Array(await blob.arrayBuffer());
  return str(u, 0, 4) === "RIFF" && str(u, 8, 12) === "WEBP";
};
const blobOf = async (url) => (await fetch(url)).blob();
const failure = (p) => p.then(() => null, (e) => e);
const settle = (p) => p.catch((e) => e); // el valor o el error, para que el FAIL lo muestre

function source() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#ff0000";
  g.fillRect(32, 0, 32, 32);
  return c;
}

async function main() {
  // Con WebP nativo (WebKit de Linux en CI) el encoder no se pide nunca y no hay
  // reintento que probar. El runner rechaza este salto en macOS (GROW-35 3b).
  if (await canEncodeWebP()) {
    log("SKIP: ruta=nativa — el reintento del encoder WASM no se ejercita en este motor (deuda GROW-35)");
    log("ALL_DONE");
    return;
  }
  log("ruta=wasm");
  const src = await blobOf("/media/guias/quitar-fondo-antes.jpg");
  const dataUrl = await new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(src);
  });
  await backend.loadImage(dataUrl);
  await backend.autoCut();
  const canvas = source();

  // fase 1: encoder bloqueado
  const e1 = await failure(backend.exportTransparent({ format: "webp", quality: 0.9 }));
  assert(isWebpEncodeError(e1), `editor sin encoder: error WebP (${e1?.message ?? e1})`);
  const e2 = await failure(reencodeToBlob(canvas, { format: "webp", quality: 0.8 }));
  assert(isWebpEncodeError(e2), `archivo sin encoder: error WebP (${e2?.message ?? e2})`);

  const unblocked = new Promise((r) => (window.__unblock = r));
  log("PHASE1_DONE");
  await unblocked;

  // fase 2: con el encoder disponible, el reintento tiene que dar WebP real
  const r1 = await settle(backend.exportTransparent({ format: "webp", quality: 0.9 }).then(blobOf));
  assert(r1 instanceof Blob && (await isWebp(r1)), `editor, reintento con red: WebP real (${r1?.type ?? r1?.message ?? r1})`);
  const r2 = await settle(reencodeToBlob(canvas, { format: "webp", quality: 0.8 }));
  assert(r2 instanceof Blob && (await isWebp(r2)), `archivo, reintento con red: WebP real (${r2?.type ?? r2?.message ?? r2})`);
  log("ALL_DONE");
}

main().catch((e) => log(`ERROR: ${e.message}`));

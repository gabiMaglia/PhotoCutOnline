// Test E2E del camino web completo: backend → Web Worker → CutoutSession.
// Verifica el RPC, los object URLs, el contador de undo y que el hilo
// principal queda libre mientras el worker computa.

import { backend } from "../src/lib/backend.js";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

function syntheticDataUrl(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d6f64b";
  ctx.fillRect(60, 40, 120, 90);
  return c.toDataURL("image/png");
}

function decode(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`no se pudo decodificar ${url.slice(0, 30)}`));
    img.src = url;
  });
}

async function main() {
  assert(typeof OffscreenCanvas !== "undefined", "entorno: OffscreenCanvas disponible (camino worker)");
  assert(!backend.isDesktop, "entorno: modo web");

  const { width, height } = await backend.loadImage(syntheticDataUrl(240, 180));
  assert(width === 240 && height === 180, "loadImage: dimensiones vía worker");
  assert(!backend.canUndo(), "canUndo: false tras cargar");

  // medir bloqueo del main thread durante el corte: un intervalo de 10ms no
  // debería saltarse más de ~3 ticks si el cálculo corre en el worker
  let ticks = 0;
  const interval = setInterval(() => ticks++, 10);
  const t0 = performance.now();
  const url = await backend.cutRect({ x: 45, y: 28, w: 150, h: 115 });
  const elapsed = performance.now() - t0;
  clearInterval(interval);
  const expected = Math.floor(elapsed / 10);
  assert(typeof url === "string" && url.startsWith("blob:"), "cutRect: devuelve object URL");
  assert(
    ticks >= expected * 0.5 || elapsed < 40,
    `main thread libre durante el corte (${ticks}/${expected} ticks, ${Math.round(elapsed)} ms)`
  );

  const img = await decode(url);
  assert(img.naturalWidth === 240, "preview: decodifica y mide 240px");
  assert(backend.canUndo(), "canUndo: true tras cutRect");

  const url2 = await backend.refine({
    points: [{ x: 70, y: 50 }, { x: 90, y: 60 }],
    radius: 6,
    foreground: true,
  });
  assert(url2.startsWith("blob:") && url2 !== url, "refine: nuevo object URL");

  await backend.undo();
  await backend.undo();
  assert(!backend.canUndo(), "undo: contador llega a cero");
  assert(backend.canRedo(), "redo: disponible tras deshacer");

  const urlRedo = await backend.redo();
  assert(urlRedo?.startsWith("blob:"), "redo: restaura el recorte");
  assert(backend.canUndo(), "redo: undo vuelve a estar disponible");
  await backend.undo(); // volver al estado sin recorte para el guard de export

  // exportar sin recorte activo debe fallar con mensaje claro, no con null
  let guarded = false;
  try {
    await backend.exportTransparent({ format: "png" });
  } catch (e) {
    guarded = /recorte/i.test(String(e.message || e));
  }
  assert(guarded, "export sin recorte: error claro");

  const feathered = await backend.setFeather(5);
  assert(typeof feathered === "string" || feathered === null, "setFeather: responde");

  await backend.cutRect({ x: 45, y: 28, w: 150, h: 115 });
  const exportUrl = await backend.exportTransparent({ format: "png" });
  const exportBlob = await (await fetch(exportUrl)).blob();
  assert(exportBlob.type === "image/png", "export: blob PNG vía fetch");
  const exportImg = await decode(exportUrl);
  assert(
    exportImg.naturalWidth === 240 && exportImg.naturalHeight === 180,
    "export: resolución completa"
  );

  const webpUrl = await backend.exportTransparent({ format: "webp" });
  const webpBlob = await (await fetch(webpUrl)).blob();
  assert(webpBlob.type === "image/webp", "export: webp");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

// GROW-36: el modelo con GPU (BiRefNet) mejora de verdad a u2netp, y la red de
// seguridad anda. Reconoce la ruta: con WebGPU (esta Mac) compara los dos
// modelos; sin WebGPU (CI Linux, WebKit) verifica que se usa u2netp como hoy y
// no falla (lección GROW-35: el entorno de CI no es el de la máquina local).
//
// Fotos de las guías (public/media/guias):
//  - quitar-fondo-antes.jpg, el retrato de «Lo probamos»: u2netp deja zonas
//    semitransparentes donde el sujeto es sólido (la queja del PO con la oreja
//    de su perro). «Niebla» = fracción del matte crudo con alfa entre 20 y 235.
//  - logo-antes.jpg: emblema + la palabra de la marca debajo. Con el
//    post-proceso de cada modelo, ¿cuánto de la franja del texto (68–85 % de la
//    altura, la misma de la guía) queda opaco? u2netp la pierde entera.
//
// u2netp se obtiene por el camino real de respaldo: con las partes de BiRefNet
// sin poder bajarse, aiMatte tiene que caer a u2netp y avisar. Corre en el hilo
// principal (aiSegmenter usa <canvas> si hay document) para poder cortar la red.

import { aiMatte, releaseAi } from "../src/lib/aiSegmenter.js";
import { refineMatte } from "../src/lib/jsEngine.js";

const out = [];
const log = (s) => {
  out.push(s);
  console.log("[ai-quality-test]", s);
};
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

async function loadPhoto(url) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

const pct = (n, d) => (100 * n) / d;
const fogPct = (m) => pct(m.filter((a) => a > 20 && a < 235).length, m.length);
const fgPct = (m) => pct(m.filter((a) => a > 127).length, m.length);

/** % opaco de la franja del texto del logo tras el post-proceso del modelo. */
function textBandPct({ matte, refine }, w, h, { raw = false } = {}) {
  const m = raw ? matte : refineMatte(Uint8ClampedArray.from(matte), w, h, refine);
  const y0 = Math.round(0.68 * h);
  const y1 = Math.round(0.85 * h);
  let o = 0;
  for (let i = y0 * w; i < y1 * w; i++) if (m[i] > 128) o++;
  return pct(o, w * (y1 - y0));
}

async function timed(label, fn) {
  const t0 = performance.now();
  const r = await fn();
  log(`${label}: ${Math.round(performance.now() - t0)} ms`);
  return r;
}

async function main() {
  const persona = await loadPhoto("/media/guias/quitar-fondo-antes.jpg");
  const logo = await loadPhoto("/media/guias/logo-antes.jpg");

  const notices = [];
  const first = await timed("retrato, 1.er corte (descarga + sesión + inferencia)", () =>
    aiMatte(persona, (p) => notices.push(p))
  );
  log(`ruta=${first.model}`);
  assert(notices.length === 0, "el modelo elegido corre sin aviso de respaldo");

  if (first.model === "u2netp") {
    // sin WebGPU: lo de siempre, y ni un byte del camino GPU
    // (en dev, Vite sirve los `?url` como módulos de 1 línea con la URL: eso no es bajar el runtime)
    const gpuReqs = performance
      .getEntriesByType("resource")
      .filter((e) => /birefnet|asyncify|ort\.webgpu/.test(e.name) && !/[?&]url\b/.test(e.name));
    assert(gpuReqs.length === 0, `sin GPU no se pide nada del camino GPU (${gpuReqs.map((e) => e.name).join(", ")})`);
    assert(fgPct(first.matte) > 30 && fgPct(first.matte) < 70, `u2netp encuentra al sujeto (${fgPct(first.matte).toFixed(1)} %)`);
    log("SKIP: sin WebGPU, la comparación BiRefNet vs u2netp no aplica en este entorno");
    log("ALL_DONE");
    return;
  }

  assert(first.model === "birefnet", "con WebGPU apta el modelo es BiRefNet");
  const bLogo = await timed("logo, BiRefNet (sesión ya creada)", () => aiMatte(logo));
  await releaseAi();

  // BiRefNet no se puede bajar ⇒ respaldo u2netp con aviso
  const realFetch = window.fetch;
  window.fetch = (input, init) =>
    /birefnet-lite-1024-fp16/.test(String(input?.url ?? input))
      ? Promise.resolve(new Response("no", { status: 404 }))
      : realFetch(input, init);
  let uPersona;
  try {
    uPersona = await timed("retrato, u2netp por respaldo", () => aiMatte(persona, (p) => notices.push(p)));
  } finally {
    window.fetch = realFetch;
  }
  assert(uPersona.model === "u2netp", "respaldo: corta u2netp");
  assert(
    notices.length === 1 && notices[0].stage === "fallback" && notices[0].model === "u2netp",
    `respaldo: un aviso {stage: fallback, model: u2netp} (${JSON.stringify(notices)})`
  );
  const uLogo = await timed("logo, u2netp", () => aiMatte(logo));

  const fogB = fogPct(first.matte);
  const fogU = fogPct(uPersona.matte);
  log(`retrato: niebla BiRefNet ${fogB.toFixed(2)} % · u2netp ${fogU.toFixed(2)} %`);
  assert(fogB < fogU * 0.75, `BiRefNet deja menos niebla que u2netp (${fogB.toFixed(2)} % < 0,75 × ${fogU.toFixed(2)} %)`);
  assert(Math.abs(fgPct(first.matte) - fgPct(uPersona.matte)) < 5, "los dos encuentran el mismo sujeto (±5 pp de área)");

  const rawB = textBandPct(bLogo, logo.width, logo.height, { raw: true });
  const textB = textBandPct(bLogo, logo.width, logo.height);
  const textU = textBandPct(uLogo, logo.width, logo.height);
  // sin post-proceso con el filtro de siempre («≥ 12 % del mayor») las letras se perdían
  const oldB = textBandPct({ matte: bLogo.matte }, logo.width, logo.height);
  log(`logo, franja del texto opaca: BiRefNet crudo ${rawB.toFixed(1)} %, con su post-proceso ${textB.toFixed(1)} %, con el post-proceso de u2netp ${oldB.toFixed(1)} % · u2netp ${textU.toFixed(1)} %`);
  assert(rawB > 8, `BiRefNet detecta la palabra del logo (${rawB.toFixed(1)} % > 8 %)`);
  assert(textB >= rawB * 0.9, `su post-proceso la conserva (${textB.toFixed(1)} % ≥ 90 % de ${rawB.toFixed(1)} %)`);
  assert(oldB < rawB * 0.5, `el post-proceso de u2netp la habría borrado (${oldB.toFixed(1)} %): el cambio hace falta`);
  assert(textB > textU + 5, "y conserva bastante más que u2netp");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

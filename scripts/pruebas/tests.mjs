// Pruebas 1-4 de 20 (una por guía ES). Cada una devuelve datos crudos + frases con esos números.
import path from "node:path";
import { readFileSync } from "node:fs";
import { brotliCompressSync, constants as zc } from "node:zlib";
import * as L from "./lib.mjs";
import { f, kb, pctS, G, P, pub, imgMeta, newCtx, runAI, guideBox, stroke, clickCanvas, dl, radio, choosePreset } from "./common.mjs";

export const TESTS = {};

// =====================================================================================
TESTS["como-quitar-el-fondo-de-una-imagen"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser, { block: false });
  const reqs = [];
  const sizes = {};
  ctx.on("request", (r) => reqs.push({ m: r.method(), url: r.url(), body: r.postDataBuffer()?.length || 0 }));
  ctx.on("response", async (r) => {
    const u = r.url();
    if (sizes.__stop || !/localhost/.test(u) || !/(onnx|ort-wasm|ort\.wasm|photocut_wasm|cutoutWorker)/.test(u)) return;
    try { sizes[new URL(u).pathname] = (await r.body()).length; } catch { /* worker */ }
  });
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const cold = await runAI(page);
  const d = await dl(page);
  const a = await L.analyze(ctx, d.buf, "image/png");
  // misma pestaña, segunda corrida (modelo ya en memoria)
  const second = await runAI(page);
  // recarga: modelo en caché HTTP, sesión nueva
  sizes.__stop = 1;
  await page.reload();
  await page.waitForSelector("input[type=file]", { state: "attached" });
  await L.loadImage(page, file);
  const warm = await runAI(page);
  const ai = Object.entries(sizes).filter(([k]) => /(onnx|ort-wasm|ort\.wasm|photocut_wasm|cutoutWorker)/.test(k));
  const modelBytes = ai.filter(([k]) => /\.onnx$/.test(k)).reduce((s, [, v]) => s + v, 0);
  const runtimeBytes = ai.filter(([k]) => !/\.onnx$/.test(k)).reduce((s, [, v]) => s + v, 0);
  const aiFiles = Object.fromEntries(ai);
  // lo que viajaría por la red con Brotli (preview no comprime): comprimo los mismos archivos de dist/
  const br = Object.keys(aiFiles).reduce((acc, k) => {
    try {
      const raw = readFileSync(path.join(L.ROOT, "dist", k));
      return acc + brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }).length;
    } catch { return acc; }
  }, 0);
  const external = reqs.filter((r) => !/^http:\/\/localhost/.test(r.url));
  const hosts = [...new Set(external.map((r) => new URL(r.url).host))];
  const uploads = reqs.filter((r) => r.m !== "GET" && r.m !== "HEAD" && r.m !== "OPTIONS");
  const bodyBytes = reqs.reduce((s, r) => s + r.body, 0);
  const maxBody = Math.max(0, ...reqs.map((r) => r.body));
  await ctx.close();
  return {
    title: "la foto no sale del navegador y el modelo tarda lo que tarda",
    image,
    tool: "Recorte → Recorte IA",
    steps: [
      "Abrí /editor/ en una pestaña sin caché y cargué la foto con «Abrir foto».",
      "Apreté «Recorte IA» y medí desde el clic hasta el aviso «Recorte IA aplicado».",
      "Descargué el PNG transparente con «Descargar».",
      "Repetí el Recorte IA en la misma pestaña y después de recargar la página, con el modelo ya en la caché del navegador.",
      "Registré todas las peticiones de red de la sesión.",
    ],
    timing: { primeraVezMs: cold, mismaPestanaMs: second, trasRecargaMs: warm },
    result: {
      pngKB: a.kb, transparentPct: a.transparentPct, semiPct: a.semiPct, w: a.w, h: a.h,
      modelBytes, runtimeBytes, brotliTotalBytes: br, requests: reqs.length, nonGetRequests: uploads.length,
      requestBodyBytes: bodyBytes, maxBody, nonGet: uploads.map((r) => `${r.m} ${r.url.slice(0, 80)} (${r.body} B)`), aiFiles, externalHosts: hosts, externalRequests: external.length,
    },
    findings: [
      `Recorte IA, primera vez (con la descarga del modelo desde mi servidor local): ${f(cold / 1000, 1)} s. En la misma pestaña, segunda corrida: ${f(second / 1000, 1)} s. Tras recargar, con el modelo en la caché: ${f(warm / 1000, 1)} s.`,
      `Lo que baja la IA la primera vez, sin comprimir: ${f(modelBytes / 1e6, 2)} MB de modelo (u2netp.onnx) + ${f(runtimeBytes / 1e6, 1)} MB de motor WebAssembly. Con Brotli (nivel 11, calculado sobre esos mismos archivos de dist/) el total baja a ${f(br / 1e6, 1)} MB, en el orden de los «~7 MB» que cuenta la guía (el servidor real puede comprimir con otro nivel).`,
      `PNG exportado: ${a.w} × ${a.h} px, ${f(a.kb, 0)} KB, ${pctS(a.transparentPct)} de píxeles totalmente transparentes y ${pctS(a.semiPct)} semitransparentes (el borde suavizado).`,
      maxBody
        ? `Red: ${reqs.length} peticiones en toda la sesión. El cuerpo más grande que salió del navegador fue de ${maxBody} bytes (${uploads.length} POST de medición de anuncios) y la foto pesa ${image.kb * 1024 | 0} bytes: no pudo ir en ninguna. Las ${external.length} peticiones a otros dominios fueron a ${hosts.join(", ")}.`
        : `Red: ${reqs.length} peticiones en toda la sesión y ninguna con cuerpo (0 bytes enviados). Las ${external.length} peticiones a otros dominios (${hosts.join(", ")}) son de publicidad de Google y no llevan la foto.`,
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
TESTS["recortar-una-persona-de-una-foto"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  const A = await dl(page);
  const a = await L.analyze(ctx, A.buf, "image/png");
  // dónde es más suave el borde: franjas de la figura
  const bands = await L.edgeBands(ctx, A.buf, "image/png", [
    ["cabeza y pelo", 0.0, 0.3],
    ["hombros", 0.3, 0.5],
    ["brazos", 0.5, 0.8],
    ["torso bajo", 0.8, 1.0],
  ]);
  // retoque: Pincel quitar de 12 px por el contorno del hombro izquierdo (de la imagen)
  await page.getByRole("button", { name: /Pincel quitar/ }).click();
  await L.setRange(page, /^\s*Pincel/, 12);
  const t0 = Date.now();
  await stroke(page, image, [[120, 380], [70, 470], [48, 580], [40, 690]]);
  const strokeMs = Date.now() - t0;
  const B = await dl(page);
  const b = await L.analyze(ctx, B.buf, "image/png");
  const d = await L.diff(ctx, A.buf, "image/png", B.buf, "image/png", 0);
  await L.clickText(page, "Deshacer");
  await page.waitForTimeout(700);
  const C = await dl(page);
  const c = await L.analyze(ctx, C.buf, "image/png");
  await ctx.close();
  const worst = [...bands].sort((x, y) => y.semiPerContour - x.semiPerContour)[0];
  return {
    title: "dónde es más flojo el borde y cuánto cambia un trazo de pincel",
    image,
    tool: "Recorte → Recorte IA y Pincel quitar",
    steps: [
      "Cargué el retrato y apliqué «Recorte IA».",
      "Descargué el PNG y lo dividí en cuatro franjas (cabeza, hombros, brazos, torso) para contar píxeles semitransparentes del contorno.",
      "Elegí «Pincel quitar» a 12 px y lo pasé por el contorno del hombro izquierdo, de arriba abajo, en un solo trazo.",
      "Descargué de nuevo y comparé píxel a píxel; después apreté «Deshacer» y descargué otra vez.",
    ],
    timing: { recorteIaMs: ai, trazoMs: strokeMs },
    result: { bandas: bands, semiTotalPct: a.semiPct, pixelsCambiadosPorTrazo: d.changedPct, hashOriginal: a.hash, hashTrasTrazo: b.hash, hashTrasDeshacer: c.hash, opaqueAntes: a.opaquePct, opaqueDespues: b.opaquePct },
    findings: [
      `Recorte IA: ${f(ai / 1000, 1)} s. Ancho aproximado de la franja de borde semitransparente (píxeles semitransparentes por píxel de contorno): ${bands.map((x) => `${x.name} ${f(x.semiPerContour, 1)} px`).join(", ")}. La zona más difusa fue ${worst.name}.`,
      `Un trazo del Pincel quitar de 12 px sobre el hombro cambió ${f(d.changedPct, 2)} % de los píxeles de la imagen (opacos: ${pctS(a.opaquePct)} → ${pctS(b.opaquePct)}).`,
      c.hash === a.hash
        ? "«Deshacer» devolvió una imagen idéntica a la del recorte original (mismo hash de los píxeles RGBA)."
        : `«Deshacer» no devolvió exactamente la imagen original (hash ${a.hash} → ${c.hash}).`,
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
TESTS["cambiar-el-fondo-de-una-foto"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const bgFile = P("paisaje-sintetico.jpg");
  const image = imgMeta(file);
  const bgImage = imgMeta(bgFile);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  const semi = {};
  for (const px of [0, 2, 6]) {
    await L.setRange(page, /Suavizado de borde/, px);
    await radio(page, "Transparente");
    await radio(page, "PNG");
    const d = await dl(page);
    const a = await L.analyze(ctx, d.buf, "image/png");
    semi[px] = { semiPct: a.semiPct, transparentPct: a.transparentPct, kb: a.kb };
  }
  await L.setRange(page, /Suavizado de borde/, 2);
  await radio(page, "Color");
  await L.setColor(page, /Color de fondo/, "#1e4d8c");
  await radio(page, "JPEG");
  const dc = await dl(page);
  const c = await L.analyze(ctx, dc.buf, "image/jpeg");
  // fondo imagen
  await radio(page, "Imagen");
  await page.locator("label", { hasText: "Elegir imagen de fondo" }).locator("input[type=file]").setInputFiles(bgFile);
  await page.waitForTimeout(1000);
  const di = await dl(page);
  const i = await L.analyze(ctx, di.buf, "image/jpeg");
  await ctx.close();
  return {
    title: "recortar una vez, probar fondos sin volver a recortar",
    image,
    tool: "Recorte → Recorte IA, Exportar → Color / Imagen",
    steps: [
      "Cargué el retrato y apliqué «Recorte IA» una sola vez.",
      "Con «Transparente» + PNG descargué el recorte con el suavizado de borde en 0, 2 y 6 px y conté los píxeles semitransparentes.",
      "Elegí modo «Color», #1e4d8c, formato JPEG y descargué.",
      `Cargué ${bgImage.name} (${bgImage.w} × ${bgImage.h} px, ${f(bgImage.kb, 0)} KB) como imagen de fondo con opacidad 100 y descargué en JPEG.`,
    ],
    timing: { recorteIaMs: ai, exportColorMs: dc.ms, exportImagenMs: di.ms },
    result: { feather: semi, color: { kb: c.kb, w: c.w, h: c.h, corner: c.corners[0] }, imagen: { kb: i.kb, w: i.w, h: i.h, corner: i.corners[0] } },
    findings: [
      `Recorte IA una sola vez: ${f(ai / 1000, 1)} s. Cambiar de fondo después no volvió a correr la IA: exportar con color tardó ${f(dc.ms / 1000, 1)} s y con imagen de fondo ${f(di.ms / 1000, 1)} s (incluye la descarga).`,
      `Píxeles semitransparentes del borde según el suavizado: 0 px → ${pctS(semi[0].semiPct)}, 2 px → ${pctS(semi[2].semiPct)}, 6 px → ${pctS(semi[6].semiPct)}.`,
      `JPEG con fondo #1e4d8c: ${c.w} × ${c.h} px, ${f(c.kb, 0)} KB; el píxel de la esquina salió rgb(${c.corners[0].slice(0, 3).join(", ")}) (pedí rgb(30, 77, 140)). Con la imagen de fondo: ${f(i.kb, 0)} KB.`,
    ],
    assets: [pub(file), pub(bgFile)],
  };
};

// =====================================================================================
TESTS["poner-fondo-blanco-a-una-foto"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  await radio(page, "Color");
  await L.setColor(page, /Color de fondo/, "#ffffff");
  await radio(page, "PNG");
  const dp = await dl(page);
  const p = await L.analyze(ctx, dp.buf, "image/png");
  await radio(page, "JPEG");
  const dj = await dl(page);
  const j = await L.analyze(ctx, dj.buf, "image/jpeg");
  await ctx.close();
  return {
    title: "blanco puro: PNG contra JPEG",
    image,
    tool: "Recorte → Recorte IA, Exportar → Color #ffffff",
    steps: [
      "Cargué el retrato y apliqué «Recorte IA».",
      "En Exportar elegí «Color» con #ffffff y descargué en PNG.",
      "Cambié el formato a JPEG y descargué otra vez.",
      "Medí en las dos salidas cuántos píxeles son exactamente blancos (255, 255, 255) y cuántos de los 4 recuadros de 40 × 40 px de las esquinas no lo son.",
    ],
    timing: { recorteIaMs: ai, descargaPngMs: dp.ms, descargaJpegMs: dj.ms },
    result: { png: { kb: p.kb, whitePct: p.whitePct, cornerNonWhitePct: p.cornerNonWhitePct }, jpeg: { kb: j.kb, whitePct: j.whitePct, cornerNonWhitePct: j.cornerNonWhitePct } },
    findings: [
      `PNG: ${f(p.kb, 0)} KB, ${pctS(p.whitePct)} de píxeles #ffffff exactos, ${pctS(p.cornerNonWhitePct)} de las esquinas no son blanco puro.`,
      `JPEG: ${f(j.kb, 0)} KB (${f(100 - (100 * j.kb) / p.kb, 0)} % menos), ${pctS(j.whitePct)} de píxeles #ffffff exactos, ${pctS(j.cornerNonWhitePct)} de las esquinas no son blanco puro.`,
      `Recorte IA ${f(ai / 1000, 1)} s; la descarga del PNG tardó ${f(dp.ms / 1000, 1)} s y la del JPEG ${f(dj.ms / 1000, 1)} s.`,
    ],
    assets: [pub(file)],
  };
};

// Pruebas 5-11 de 20.
import { readFileSync } from "node:fs";
import * as L from "./lib.mjs";
import { f, pctS, G, P, pub, imgMeta, newCtx, runAI, guideBox, stroke, dl, radio, choosePreset } from "./common.mjs";

export const TESTS = {};

// Archivo: convierte/recomprime lo que haya cargado. Devuelve el peso estimado en pantalla + la descarga real.
export async function archivoConvert(page, ctx, fmt, quality, { width, height } = {}) {
  await radio(page, fmt);
  if (quality != null && fmt !== "PNG") await L.setRange(page, /Calidad/, quality);
  if (width != null) await page.getByLabel("Ancho").fill(String(width));
  if (height != null) await page.getByLabel("Alto").fill(String(height));
  await page.waitForTimeout(500);
  const est = (await L.bodyText(page)).match(/([\d.,]+ [KM]B) → ([\d.,]+ [KM]B)/)?.[0] ?? null;
  const t0 = Date.now();
  const d = await dl(page, "Descargar convertida");
  const a = await L.analyze(ctx, d.buf, L.mimeOf(d.name));
  return { est, d, a, ms: Date.now() - t0 };
}

// =====================================================================================
TESTS["foto-carnet-fondo-blanco"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  await radio(page, "Color");
  await L.setColor(page, /Color de fondo/, "#ffffff");
  await radio(page, "JPEG");
  const base = await dl(page);
  const b0 = await L.analyze(ctx, base.buf, "image/jpeg");
  // recomprimo ese JPG en Archivo para ver cuánto aguanta el blanco
  await L.loadImage(page, base.path);
  await L.tab(page, "Archivo");
  const ladder = {};
  for (const q of [80, 50, 35, 20, 5]) {
    const r = await archivoConvert(page, ctx, "JPG", q);
    ladder[q] = { kb: r.a.kb, est: r.est, cornerNonWhitePct: r.a.cornerNonWhitePct, whitePct: r.a.whitePct, esquina: r.a.corners[0].slice(0, 3) };
  }
  await ctx.close();
  return {
    title: "cuánto aguanta el blanco puro al bajar la calidad del JPG",
    image,
    tool: "Recorte → Recorte IA, Exportar → Color #ffffff, y Archivo → JPG con calidad",
    steps: [
      "Cargué el retrato, apliqué «Recorte IA» y exporté en JPEG sobre blanco #ffffff.",
      "Abrí ese JPEG en la pestaña «Archivo» y lo recomprimí como JPG con calidad 80, 50, 35, 20 y 5.",
      "En cada salida medí el peso y qué porcentaje de los cuatro recuadros de 40 × 40 px de las esquinas ya no era #ffffff exacto.",
    ],
    timing: { recorteIaMs: ai },
    result: { exportInicial: { kb: b0.kb, cornerNonWhitePct: b0.cornerNonWhitePct, whitePct: b0.whitePct }, calidad: ladder },
    findings: [
      `Exportación inicial (JPEG del Recorte): ${f(b0.kb, 1)} KB, esquinas no blancas ${pctS(b0.cornerNonWhitePct)}.`,
      ...Object.entries(ladder).map(([q, v]) => `Calidad ${q}: ${f(v.kb, 1)} KB (la pantalla estimaba ${v.est}), esquinas no blancas ${pctS(v.cornerNonWhitePct)} (píxel de la esquina rgb(${v.esquina.join(", ")})), #ffffff exactos en toda la imagen ${pctS(v.whitePct)}.`),
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
TESTS["fotos-de-producto-amazon-etsy-shopify"] = async ({ browser }) => {
  const file = P("producto-sintetico.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  await choosePreset(page, /Amazon/);
  await radio(page, "Transparente");
  await radio(page, "PNG");
  const dt = await dl(page);
  const t = await L.analyze(ctx, dt.buf, "image/png");
  await radio(page, "Color");
  await L.setColor(page, /Color de fondo/, "#ffffff");
  await radio(page, "JPEG");
  const dj = await dl(page);
  const j = await L.analyze(ctx, dj.buf, "image/jpeg");
  const nw = j.nonWhite.bbox;
  await ctx.close();
  return {
    title: "una taza sintética a 2000 × 2000 px sobre blanco",
    image,
    tool: "Recorte → Recorte IA, preset «Amazon 2000×2000», Exportar → Color #ffffff",
    steps: [
      "Cargué una imagen dibujada por mí (una taza azul con sombra sobre un gris degradado) y apliqué «Recorte IA».",
      "Elegí el preset «Amazon 2000×2000».",
      "Con «Transparente» + PNG descargué para ver qué hacía el preset con la transparencia.",
      "Elegí modo «Color» #ffffff, formato JPEG y descargué; medí la caja de los píxeles que no son casi blancos.",
    ],
    timing: { recorteIaMs: ai, descargaPngMs: dt.ms, descargaJpegMs: dj.ms },
    result: { png: { w: t.w, h: t.h, kb: t.kb, transparentPct: t.transparentPct, opaquePct: t.opaquePct }, productBox: nw, jpeg: { w: j.w, h: j.h, kb: j.kb, whitePct: j.whitePct, cornerNonWhitePct: j.cornerNonWhitePct } },
    findings: [
      `Recorte IA: ${f(ai / 1000, 1)} s sobre ${image.w} × ${image.h} px.`,
      `Con el preset salió un cuadro de ${j.w} × ${j.h} px. El producto (píxeles no casi blancos) ocupa ${f(nw.wPct, 1)} % del ancho y ${f(nw.hPct, 1)} % del alto del cuadro.`,
      `JPEG sobre blanco: ${f(j.kb, 0)} KB, ${pctS(j.whitePct)} de píxeles #ffffff exactos, esquinas no blancas ${pctS(j.cornerNonWhitePct)}. El PNG pedido como «Transparente» con el preset pesó ${f(t.kb, 0)} KB y salió con ${pctS(t.transparentPct)} de píxeles transparentes.`,
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
async function methodRun(ctx, file, method) {
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  let ms;
  if (method === "ia") ms = await runAI(page);
  else if (method === "auto") {
    await L.clickText(page, "Recorte automático");
    ms = (await L.toastSinceClick(page, /Recorte automático aplicado/, 60000)).ms;
  } else {
    await page.getByRole("button", { name: /Varita mágica/ }).click();
    const bb = await guideBox(page);
    await page.mouse.click(bb.x + 6, bb.y + 6);
    ms = (await L.toastSinceClick(page, /Zona quitada/, 30000)).ms;
  }
  await radio(page, "Transparente");
  await radio(page, "PNG");
  const d = await dl(page);
  const a = await L.analyze(ctx, d.buf, "image/png");
  const lower = await L.bandOpaque(ctx, d.buf, "image/png", 0.68, 0.85);
  await page.close();
  return { ms, a, path: d.path, lower };
}

TESTS["logo-con-fondo-transparente"] = async ({ browser }) => {
  const file = G("logo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const r = {};
  for (const m of ["ia", "auto", "varita"]) r[m] = await methodRun(ctx, file, m);
  await ctx.close();
  const row = (k) => ({ ms: r[k].ms, transparentPct: r[k].a.transparentPct, semiPct: r[k].a.semiPct, kb: r[k].a.kb, hash: r[k].a.hash, bandaInferiorOpacaPct: r[k].lower });
  return {
    title: "el mismo logo con IA, recorte automático y varita",
    image,
    tool: "Recorte → Recorte IA / Recorte automático / Varita mágica",
    steps: [
      "Cargué el logo (JPG sobre fondo liso) y apliqué «Recorte IA»; descargué el PNG.",
      "En una pestaña nueva, apliqué «Recorte automático» al mismo archivo y descargué.",
      "En otra, elegí «Varita mágica» con la tolerancia por defecto, hice un solo clic en la esquina superior izquierda (fondo) y descargué.",
      "De cada PNG medí el porcentaje de píxeles transparentes y semitransparentes.",
    ],
    timing: { iaMs: r.ia.ms, autoMs: r.auto.ms, varitaMs: r.varita.ms },
    result: { ia: row("ia"), auto: row("auto"), varita: row("varita") },
    findings: [
      `Recorte IA: ${f(r.ia.ms / 1000, 1)} s, ${pctS(r.ia.a.transparentPct)} transparente, ${pctS(r.ia.a.semiPct)} semitransparente, PNG de ${f(r.ia.a.kb, 0)} KB.`,
      `Recorte automático: ${f(r.auto.ms / 1000, 2)} s, ${pctS(r.auto.a.transparentPct)} transparente, ${pctS(r.auto.a.semiPct)} semitransparente, ${f(r.auto.a.kb, 0)} KB.`,
      `Varita mágica (un clic): ${f(r.varita.ms / 1000, 2)} s, ${pctS(r.varita.a.transparentPct)} transparente, ${pctS(r.varita.a.semiPct)} semitransparente, ${f(r.varita.a.kb, 0)} KB.`,
      `El logo tiene un emblema y, debajo, la palabra de la marca. En la franja donde está el texto (entre 68 % y 85 % de la altura) quedó opaco: ${pctS(r.ia.lower)} con la IA, ${pctS(r.auto.lower)} con el recorte automático y ${pctS(r.varita.lower)} con la varita.`,
    ],
    assets: [pub(file)],
  };
};

TESTS["quitar-fondo-a-una-firma"] = async ({ browser }) => {
  const file = G("firma-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const src = await L.analyze(ctx, readFileSync(file), "image/jpeg");
  const r = {};
  for (const m of ["varita", "auto"]) r[m] = await methodRun(ctx, file, m);
  await ctx.close();
  const inkKept = (k) => +((100 * r[k].a.darkPx) / src.darkPx).toFixed(1);
  const row = (k) => ({ ms: r[k].ms, transparentPct: r[k].a.transparentPct, semiPct: r[k].a.semiPct, kb: r[k].a.kb, inkPx: r[k].a.darkPx, inkKeptPct: inkKept(k) });
  return {
    title: "cuánta tinta sobrevive al quitar el papel",
    image,
    tool: "Recorte → Varita mágica / Recorte automático",
    steps: [
      "Cargué la foto de una firma sobre papel.",
      "Con «Varita mágica» (tolerancia por defecto) hice un clic en el papel de la esquina superior izquierda y descargué el PNG.",
      "En otra pestaña usé «Recorte automático» sobre el mismo archivo y descargué.",
      "Conté los píxeles oscuros (luminancia < 110 y opacos) en el original y en cada PNG.",
    ],
    timing: { varitaMs: r.varita.ms, autoMs: r.auto.ms },
    result: { tintaOriginalPx: src.darkPx, varita: row("varita"), auto: row("auto") },
    findings: [
      `El original tiene ${src.darkPx} píxeles de tinta (oscuros).`,
      `Varita mágica: ${f(r.varita.ms / 1000, 2)} s, ${pctS(r.varita.a.transparentPct)} transparente, PNG de ${f(r.varita.a.kb, 1)} KB y ${f(inkKept("varita"), 1)} % de la tinta conservada (${r.varita.a.darkPx} px).`,
      `Recorte automático: ${f(r.auto.ms / 1000, 2)} s, ${pctS(r.auto.a.transparentPct)} transparente, ${f(r.auto.a.kb, 1)} KB y ${f(inkKept("auto"), 1)} % de la tinta conservada (${r.auto.a.darkPx} px).`,
    ],
    assets: [pub(file)],
  };
};

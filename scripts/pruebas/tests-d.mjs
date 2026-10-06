// Pruebas de avatar, LinkedIn y stickers.
import * as L from "./lib.mjs";
import { f, pctS, G, pub, imgMeta, newCtx, runAI, dl, radio, choosePreset } from "./common.mjs";
import { archivoConvert } from "./tests-b.mjs";

export const TESTS = {};

// =====================================================================================
TESTS["foto-de-perfil-redonda"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  await choosePreset(page, /Avatar circular/);
  await radio(page, "Transparente");
  await radio(page, "PNG");
  const d = await dl(page);
  const a = await L.analyze(ctx, d.buf, "image/png");
  await ctx.close();
  const topMargin = +((100 * a.bbox.y0) / a.h).toFixed(1);
  const side = +((100 * a.bbox.x0) / a.w).toFixed(1);
  return {
    title: "qué queda dentro del círculo del preset «Avatar circular 512»",
    image,
    tool: "Recorte → Recorte IA, preset «Avatar circular 512»",
    steps: [
      "Cargué el retrato y apliqué «Recorte IA».",
      "Elegí el preset «Avatar circular 512» con «Transparente» y PNG, y descargué.",
      "Medí en el PNG la caja del sujeto, los píxeles transparentes y la alfa de las esquinas.",
    ],
    timing: { recorteIaMs: ai, descargaMs: d.ms },
    result: { w: a.w, h: a.h, kb: a.kb, transparentPct: a.transparentPct, semiPct: a.semiPct, cornersAlpha: a.corners.map((c) => c[3]), bbox: a.bbox, topMarginPct: topMargin, sideMarginPct: side, outsideCirclePct: a.outsideCirclePct },
    findings: [
      `Salió un PNG de ${a.w} × ${a.h} px y ${f(a.kb, 0)} KB. Las cuatro esquinas tienen alfa ${a.corners.map((c) => c[3]).join(", ")}: el preset recorta en círculo de verdad, no solo centra.`,
      `${pctS(a.transparentPct)} de la imagen quedó transparente: ${f(100 - (100 * Math.PI) / 4, 1)} % son las esquinas fuera del círculo y el resto es fondo recortado dentro de él.`,
      `La figura queda a ${f(topMargin, 1)} % del alto desde el borde de arriba hasta la coronilla y la figura empieza a ${f(side, 1)} % del ancho contando desde el borde izquierdo (ocupa ${f(a.bbox.wPct, 1)} % del ancho y ${f(a.bbox.hPct, 1)} % del alto).`,
      `Recorte IA ${f(ai / 1000, 1)} s; la descarga del avatar ${f(d.ms / 1000, 1)} s.`,
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
TESTS["foto-de-perfil-para-linkedin"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  await radio(page, "Color");
  await L.setColor(page, /Color de fondo/, "#c9ced6");
  await radio(page, "JPEG");
  const rows = {};
  for (const [id, re, name] of [["amazon", /Amazon/, "Amazon 2000×2000 (margen 5 %)"], ["shopify", /Shopify/, "Shopify 2048×2048 (margen 6 %)"], ["ig", /Instagram post/, "Instagram post 1080×1080 (margen 8 %)"]]) {
    await choosePreset(page, re);
    const d = await dl(page);
    const a = await L.analyze(ctx, d.buf, "image/jpeg");
    rows[id] = { name, w: a.w, h: a.h, kb: a.kb, outsideCirclePct: a.nonWhite ? a.nonWhite.outsideCirclePct : null, corner: a.corners[0].slice(0, 3) };
  }
  await ctx.close();
  return {
    title: "cuánta figura se pierde cuando LinkedIn muestra el círculo",
    image,
    tool: "Recorte → Recorte IA, presets cuadrados, Exportar → Color #c9ced6",
    steps: [
      "Cargué el retrato y apliqué «Recorte IA».",
      "En Exportar elegí «Color» #c9ced6 (un gris sobrio) y JPEG.",
      "Descargué con tres presets cuadrados: Amazon 2000×2000, Shopify 2048×2048 e Instagram post 1080×1080 (no hay un preset de LinkedIn).",
      "En cada JPEG calculé qué porcentaje de los píxeles de la figura cae fuera del círculo inscrito en el cuadrado, que es lo que LinkedIn no muestra.",
    ],
    timing: { recorteIaMs: ai },
    result: rows,
    findings: [
      `Recorte IA: ${f(ai / 1000, 1)} s.`,
      ...Object.values(rows).map((r) => `${r.name}: ${r.w} × ${r.h} px, ${f(r.kb, 0)} KB; ${r.outsideCirclePct == null ? "no pude medir la figura" : `${pctS(r.outsideCirclePct)} de la figura queda fuera del círculo`}${r.corner.join() === "201,206,214" ? "" : `; la esquina salió rgb(${r.corner.join(", ")}), no el gris pedido`}.`),
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
TESTS["stickers-de-whatsapp-y-telegram"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  const ai = await runAI(page);
  await radio(page, "Transparente");
  await radio(page, "PNG");
  const dPlain = await dl(page);
  const plain = await L.analyze(ctx, dPlain.buf, "image/png");
  await page.getByLabel("Sticker (contorno)").check();
  await page.waitForTimeout(600);
  await radio(page, "PNG");
  const dPng = await dl(page);
  const png = await L.analyze(ctx, dPng.buf, "image/png");
  await radio(page, "WEBP");
  const dWebp = await dl(page);
  const webp = await L.analyze(ctx, dWebp.buf, "image/webp");
  // llevo el WebP a 512 px de alto con Archivo
  await L.loadImage(page, dWebp.path);
  await L.tab(page, "Archivo");
  const small = await archivoConvert(page, ctx, "WebP", 80, { height: 512 });
  const width = await page.getByLabel("Ancho").inputValue();
  await ctx.close();
  return {
    title: "el peso del sticker contra el límite de 100 KB de WhatsApp",
    image,
    tool: "Recorte → Recorte IA + «Sticker (contorno)», y Archivo → WebP",
    steps: [
      "Cargué el retrato y apliqué «Recorte IA»; descargué un PNG transparente sin contorno como referencia.",
      "Activé «Sticker (contorno)» con el grosor por defecto (14 px) y descargué en PNG y en WebP.",
      "Abrí el WebP en la pestaña «Archivo», lo llevé a 512 px de alto con calidad 80 y descargué.",
    ],
    timing: { recorteIaMs: ai, archivoMs: small.ms },
    result: { sinContorno: { kb: plain.kb, w: plain.w, h: plain.h }, contornoPng: { kb: png.kb, w: png.w, h: png.h, transparentPct: png.transparentPct }, contornoWebp: { kb: webp.kb, w: webp.w, h: webp.h, transparentPct: webp.transparentPct }, a512: { kb: small.a.kb, w: small.a.w, h: small.a.h, transparentPct: small.a.transparentPct, estimadoEnPantalla: small.est, anchoMostrado: width } },
    findings: [
      `Sin contorno, PNG: ${plain.w} × ${plain.h} px, ${f(plain.kb, 0)} KB. Con contorno blanco de 14 px: PNG ${png.w} × ${png.h} px, ${f(png.kb, 0)} KB, y WebP ${f(webp.kb, 0)} KB con ${pctS(webp.transparentPct)} de píxeles transparentes.`,
      `Ese WebP, llevado en Archivo a ${small.a.w} × ${small.a.h} px (calidad 80): ${f(small.a.kb, 1)} KB y ${pctS(small.a.transparentPct)} transparente. El límite de WhatsApp es 100 KB.`,
      `El editor me dejó fijar el alto en 512 y el ancho se ajustó solo a ${width} px (la foto es vertical). Un cuadrado de 512 × 512, que es lo que pide WhatsApp, habría exigido deformar la imagen o recortarla antes.`,
    ],
    assets: [pub(file)],
  };
};

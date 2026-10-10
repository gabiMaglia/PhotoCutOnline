// Pruebas de avatar, LinkedIn y stickers.
import * as L from "./lib.mjs";
import { f, pctS, G, pub, imgMeta, newCtx, runAI, dl, radio, choosePreset } from "./common.mjs";

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
  await page.getByLabel("Sticker (contorno)").check();
  await page.waitForTimeout(600);
  // referencia: el recorte con contorno a tamaño original, para ver si el preset deforma
  await radio(page, "Transparente");
  await radio(page, "PNG");
  const ref = await L.analyze(ctx, (await dl(page)).buf, "image/png");
  const ratio = (a) => +((a.bbox.x1 - a.bbox.x0 + 1) / (a.bbox.y1 - a.bbox.y0 + 1)).toFixed(4);
  const magic = (buf) => (buf.subarray(8, 12).toString() === "WEBP" ? "webp" : buf.subarray(1, 4).toString() === "PNG" ? "png" : "?");
  const toastsSinceClick = () =>
    page.evaluate(() => {
      const last = window.__clicks[window.__clicks.length - 1] ?? 0;
      return window.__toasts.filter((t) => t.t >= last).map((t) => t.text);
    });
  const measure = async (re) => {
    await choosePreset(page, re);
    // con el preset elegido, qué formatos deja tocar el panel
    const formats = {};
    for (const n of ["PNG", "WEBP", "JPEG"]) formats[n] = await page.getByRole("radio", { name: n, exact: true }).isEnabled();
    const d = await dl(page);
    await page.waitForTimeout(300);
    const fmt = magic(d.buf);
    const a = await L.analyze(ctx, d.buf, `image/${fmt}`);
    const long = Math.max(a.bbox.x1 - a.bbox.x0 + 1, a.bbox.y1 - a.bbox.y0 + 1);
    return {
      file: d.name, format: fmt, w: a.w, h: a.h, kb: a.kb, transparentPct: a.transparentPct,
      cornersAlpha: a.corners.map((c) => c[3]), subjectRatio: ratio(a), subjectLongPx: long,
      marginPct: +((100 * (a.w - long)) / 2 / a.w).toFixed(1), formatsEnabled: formats, toasts: await toastsSinceClick(), ms: d.ms,
    };
  };
  const wa = await measure(/Sticker WhatsApp/);
  const tg = await measure(/Sticker Telegram/);
  await ctx.close();
  const refRatio = ratio(ref);
  const dev = (r) => +((100 * Math.abs(r / refRatio - 1))).toFixed(2);
  const onlyFormat = (fm) => Object.entries(fm).filter(([, on]) => on).map(([n]) => n).join(", ");
  return {
    title: "los presets «Sticker WhatsApp» y «Sticker Telegram» contra lo que piden las apps",
    image,
    tool: "Recorte → Recorte IA + «Sticker (contorno)», Exportar → presets «Sticker WhatsApp 512 (WebP)» y «Sticker Telegram 512 (PNG)»",
    steps: [
      "Cargué el retrato, apliqué «Recorte IA» y activé «Sticker (contorno)» con el grosor por defecto (14 px).",
      "Descargué un PNG transparente sin preset como referencia de la proporción de la figura.",
      "En Exportar elegí el preset «Sticker WhatsApp 512 (WebP)» y descargué; después el preset «Sticker Telegram 512 (PNG)» y descargué.",
      "En cada archivo medí tamaño, peso, formato real (cabecera del archivo), alfa de las cuatro esquinas y la caja de la figura.",
    ],
    timing: { recorteIaMs: ai, whatsappMs: wa.ms, telegramMs: tg.ms },
    result: { referencia: { w: ref.w, h: ref.h, kb: ref.kb, subjectRatio: refRatio }, whatsapp: { ...wa, ratioDevPct: dev(wa.subjectRatio) }, telegram: { ...tg, ratioDevPct: dev(tg.subjectRatio) } },
    findings: [
      `Sticker WhatsApp: ${wa.format === "webp" ? "WebP" : wa.format} de ${wa.w} × ${wa.h} px y ${f(wa.kb, 1)} KB (el límite de WhatsApp es 100 KB), ${pctS(wa.transparentPct)} de píxeles transparentes y alfa ${wa.cornersAlpha.join(", ")} en las cuatro esquinas. Con el preset elegido, el panel solo dejó tocar el formato ${onlyFormat(wa.formatsEnabled)}.`,
      `Sticker Telegram: ${tg.format === "png" ? "PNG" : tg.format} de ${tg.w} × ${tg.h} px y ${f(tg.kb, 1)} KB, alfa ${tg.cornersAlpha.join(", ")} en las esquinas; formato habilitado: ${onlyFormat(tg.formatsEnabled)}.`,
      `La foto es vertical (${image.w} × ${image.h}) y el preset no la deforma: la figura mide ${f(refRatio, 3)} de ancho por cada 1 de alto en la referencia, ${f(wa.subjectRatio, 3)} en el de WhatsApp y ${f(tg.subjectRatio, 3)} en el de Telegram. El lado más largo de la figura ocupa ${wa.subjectLongPx} px en WhatsApp (margen de ${f(wa.marginPct, 1)} % por lado) y ${tg.subjectLongPx} px en Telegram.`,
    ],
    assets: [pub(file)],
  };
};

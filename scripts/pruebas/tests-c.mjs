// Pruebas de Archivo, Icon Studio, Editar y Color Studio.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import * as L from "./lib.mjs";
import { f, pctS, G, P, pub, imgMeta, newCtx, dl, radio } from "./common.mjs";
import { archivoConvert } from "./tests-b.mjs";

export const TESTS = {};

// =====================================================================================
TESTS["png-jpg-o-webp-cual-elegir"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const alphaFile = G("logo-despues.png");
  const image = imgMeta(file);
  const alphaImg = imgMeta(alphaFile);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  await L.tab(page, "Archivo");
  const rows = {};
  for (const [k, fmt, q] of [["png", "PNG", null], ["jpg80", "JPG", 80], ["webp80", "WebP", 80], ["jpg60", "JPG", 60], ["webp60", "WebP", 60]]) {
    const r = await archivoConvert(page, ctx, fmt, q);
    rows[k] = { kb: r.a.kb, ms: r.ms, estimado: r.est, name: r.d.name };
  }
  // y con transparencia: el logo recortado pasa por JPG y por WebP
  await L.loadImage(page, alphaFile);
  const j = await archivoConvert(page, ctx, "JPG", 80);
  const w = await archivoConvert(page, ctx, "WebP", 80);
  const p = await archivoConvert(page, ctx, "PNG");
  await ctx.close();
  const alpha = {
    origenKB: alphaImg.kb,
    png: { kb: p.a.kb, transparentPct: p.a.transparentPct },
    jpg: { kb: j.a.kb, transparentPct: j.a.transparentPct, esquina: j.a.corners[0] },
    webp: { kb: w.a.kb, transparentPct: w.a.transparentPct },
  };
  return {
    title: "la misma foto en PNG, JPG y WebP, y qué pasa con la transparencia",
    image,
    tool: "Archivo → PNG / JPG / WebP con calidad",
    steps: [
      "Abrí la foto en la pestaña «Archivo» (JPG original) y la convertí a PNG, JPG calidad 80, WebP calidad 80, JPG 60 y WebP 60, descargando cada una.",
      `Repetí con ${alphaImg.name} (${alphaImg.w} × ${alphaImg.h} px, ${f(alphaImg.kb, 0)} KB, PNG con fondo transparente) en PNG, JPG 80 y WebP 80.`,
      "Medí el peso real de cada descarga y, en las del logo, el porcentaje de píxeles transparentes.",
    ],
    timing: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k + "Ms", v.ms])),
    result: { foto: rows, logo: alpha },
    findings: [
      `Foto de ${f(image.kb, 0)} KB: PNG ${f(rows.png.kb, 0)} KB · JPG 80 ${f(rows.jpg80.kb, 0)} KB · WebP 80 ${f(rows.webp80.kb, 0)} KB · JPG 60 ${f(rows.jpg60.kb, 0)} KB · WebP 60 ${f(rows.webp60.kb, 0)} KB.`,
      `La pantalla de Archivo estimó «${rows.jpg80.estimado}» para JPG 80 y la descarga real pesó ${f(rows.jpg80.kb, 1)} KB.`,
      `Logo con transparencia (${f(alphaImg.kb, 0)} KB de origen): PNG ${f(alpha.png.kb, 0)} KB con ${pctS(alpha.png.transparentPct)} transparente; WebP 80 ${f(alpha.webp.kb, 0)} KB con ${pctS(alpha.webp.transparentPct)} transparente; JPG 80 ${f(alpha.jpg.kb, 0)} KB con ${pctS(alpha.jpg.transparentPct)} transparente (la esquina pasó a rgb(${alpha.jpg.esquina.slice(0, 3).join(", ")})).`,
    ],
    assets: [pub(file), pub(alphaFile)],
  };
};

// =====================================================================================
TESTS["quitar-la-ubicacion-de-una-foto"] = async ({ browser }) => {
  const file = P("gps-sintetica.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  await L.tab(page, "Archivo");
  await page.waitForTimeout(800);
  const text = await L.bodyText(page);
  const i0 = text.indexOf("Cámara y captura");
  const i1 = text.indexOf("Ver en el mapa");
  const sec = text.slice(i0, i1 > i0 ? i1 : i0 + 300);
  const d = await dl(page, "Descargar sin metadatos");
  const out = path.join(L.TMP, "sin-metadatos.jpg");
  writeFileSync(out, d.buf);
  const probe = (p) =>
    JSON.parse(
      L.py(
        "import sys,json\nfrom PIL import Image\nim=Image.open(sys.argv[1]); e=im.getexif()\nprint(json.dumps({'tags':len([k for k in e if k not in (34853,34665)]),'gps':len(e.get_ifd(0x8825)),'exifIfd':len(e.get_ifd(0x8769)),'size':list(im.size),'info':sorted(k for k in im.info.keys())}))",
        [p]
      )
    );
  const antes = probe(file);
  const despues = probe(out);
  const a = await L.analyze(ctx, d.buf, "image/jpeg");
  const orig = await L.analyze(ctx, readFileSync(file), "image/jpeg");
  await ctx.close();
  return {
    title: "qué campos EXIF muestra el panel y qué queda en la copia limpia",
    image,
    tool: "Archivo → «Descargar sin metadatos»",
    steps: [
      "Generé con Pillow un JPG de 1600 × 1200 px con EXIF de prueba: marca, modelo, software, fecha y coordenadas GPS de un monumento público.",
      "Lo abrí en la pestaña «Archivo» y leí lo que muestra la sección «Cámara y captura (EXIF)».",
      "Apreté «Descargar sin metadatos» y abrí el resultado con Pillow para contar las etiquetas EXIF y el bloque GPS.",
    ],
    timing: { descargaMs: d.ms },
    result: { panel: sec, antes, despues, kbAntes: image.kb, kbDespues: a.kb, mismosPixeles: orig.hash === a.hash },
    findings: [
      `El original trae ${antes.tags} campos EXIF principales (marca, modelo, software, fecha), ${antes.exifIfd} en el bloque de captura y ${antes.gps} campos GPS.`,
      `Lo que mostró el panel: «${sec.replace(/\s+/g, " ").trim()}».`,
      `La copia sin metadatos: ${despues.tags} campos EXIF, ${despues.gps} campos GPS, ${a.w} × ${a.h} px y ${f(a.kb, 1)} KB (el original pesaba ${f(image.kb, 1)} KB). Descarga en ${f(d.ms / 1000, 1)} s.${despues.info.includes("icc_profile") ? " Eso sí: trae un perfil de color ICC que no estaba en el original." : ""}`,
      orig.hash === a.hash ? "Los píxeles de la copia son idénticos a los del original." : "Los píxeles de la copia no son idénticos a los del original: el archivo se vuelve a codificar con pérdida (JPEG).",
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
TESTS["medidas-de-fotos-para-redes-sociales-2026"] = async ({ browser }) => {
  const file = P("paisaje-sintetico.jpg");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  const loadMs = await L.loadImage(page, file);
  await L.tab(page, "Archivo");
  const lockedWidth = 1080;
  const a = await archivoConvert(page, ctx, "JPG", 80, { width: lockedWidth });
  const alto = await page.getByLabel("Alto").inputValue();
  // destrabo la proporción y fuerzo 1080 × 1350
  await page.getByRole("button", { name: "🔒" }).click();
  await page.waitForTimeout(300);
  const b = await archivoConvert(page, ctx, "JPG", 80, { width: 1080, height: 1350 });
  await ctx.close();
  const stretch = +((1080 / 1350) / (image.w / image.h)).toFixed(2);
  return {
    title: "de 4000 × 3000 px a las medidas de una publicación",
    image,
    tool: "Archivo → ancho y alto con el candado",
    steps: [
      `Abrí ${image.name} (${image.w} × ${image.h} px, foto «de celular» sintética) y fui a «Archivo».`,
      "Con el candado de proporción activado puse ancho 1080, JPG calidad 80, y descargué.",
      "Apagué el candado, puse 1080 × 1350 (la medida vertical de Instagram) y descargué otra vez.",
    ],
    timing: { cargaMs: loadMs, redimensionarCandadoMs: a.ms, redimensionarLibreMs: b.ms },
    result: { original: { w: image.w, h: image.h, kb: image.kb }, conCandado: { w: a.a.w, h: a.a.h, kb: a.a.kb, altoMostrado: alto }, sinCandado: { w: b.a.w, h: b.a.h, kb: b.a.kb, factorDeformacion: stretch } },
    findings: [
      `Con el candado: ancho 1080 → alto ${alto}. Salió un JPG de ${a.a.w} × ${a.a.h} px y ${f(a.a.kb, 0)} KB (el original pesaba ${f(image.kb, 0)} KB) en ${f(a.ms / 1000, 1)} s contando la descarga.`,
      `Sin el candado, 1080 × 1350 px: ${b.a.w} × ${b.a.h} px y ${f(b.a.kb, 0)} KB. Como la foto es 4:3 y la medida pedida 4:5, la imagen quedó estirada a ${f(stretch * 100, 0)} % de su proporción horizontal.`,
    ],
    assets: [pub(file)],
  };
};

// =====================================================================================
const unzipList = (zipPath) =>
  JSON.parse(L.py("import sys,json,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nprint(json.dumps([{'name':i.filename,'size':i.file_size} for i in z.infolist() if not i.is_dir()]))", [zipPath]));

async function iconStudioLoad(page, file) {
  await L.tab(page, "Icon Studio");
  await page.locator("label", { hasText: "Abrir PNG" }).locator("input[type=file]").setInputFiles(file);
  await page.waitForTimeout(1200);
}

TESTS["medidas-de-iconos-de-app-ios-android-2026"] = async ({ browser }) => {
  const file = G("logo-despues.png");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await iconStudioLoad(page, file);
  const checks = await page.locator("input[type=checkbox]").evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => ({ label: e.closest("label")?.innerText.replace(/\s+/g, " ").slice(0, 40), on: e.checked })));
  const plat = checks.filter((c) => !/^Fondo/.test(c.label));
  const d = await dl(page, "Descargar ZIP de iconos");
  const zp = path.join(L.TMP, "iconos.zip");
  writeFileSync(zp, d.buf);
  const list = unzipList(zp);
  const top = {};
  for (const e of list) { const k = e.name.split("/")[1] || e.name; top[k] = (top[k] || 0) + 1; }
  const biggest = [...list].sort((a, b) => b.size - a.size)[0];
  await ctx.close();
  return {
    title: "un ZIP con todas las plataformas desde un solo PNG",
    image,
    tool: "Icon Studio → «Abrir PNG…» → «Descargar ZIP de iconos»",
    steps: [
      `En Icon Studio abrí ${image.name} (${image.w} × ${image.h} px, ${f(image.kb, 0)} KB, PNG con fondo transparente).`,
      "Dejé los ajustes por defecto (margen 8 %, las cinco plataformas marcadas) y apreté «Descargar ZIP de iconos».",
      "Abrí el ZIP y conté archivos por carpeta.",
    ],
    timing: { zipMs: d.ms },
    result: { plataformasMarcadas: checks, zipKB: +(d.buf.length / 1024).toFixed(1), archivos: list.length, porCarpeta: top, masGrande: biggest },
    findings: [
      `El ZIP se generó y descargó en ${f(d.ms / 1000, 1)} s y pesa ${f(d.buf.length / 1024, 0)} KB.`,
      `Trae ${list.length} archivos: ${Object.entries(top).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
      `El archivo más grande es ${biggest.name} (${f(biggest.size / 1024, 0)} KB).`,
      `Plataformas marcadas al empezar: ${plat.filter((c) => c.on).length} de ${plat.length}.`,
    ],
    assets: [pub(file)],
    _zip: zp,
  };
};

TESTS["favicons-medidas-y-html"] = async ({ browser }) => {
  const file = G("logo-despues.png");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await iconStudioLoad(page, file);
  // solo Web / PWA
  const boxes = page.locator("input[type=checkbox]");
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const lab = await boxes.nth(i).evaluate((e) => e.closest("label")?.innerText || "");
    const want = /Web \/ PWA/.test(lab);
    if (/(iOS|Android|macOS|Windows|Web)/.test(lab) && (await boxes.nth(i).isChecked()) !== want) await boxes.nth(i).setChecked(want);
  }
  const d = await dl(page, "Descargar ZIP de iconos");
  const zp = path.join(L.TMP, "favicons.zip");
  writeFileSync(zp, d.buf);
  const list = unzipList(zp);
  await page.getByRole("button", { name: "Copiar HTML de favicons" }).click();
  await page.waitForTimeout(500);
  const html = await page.evaluate(() => navigator.clipboard.readText());
  const links = html.split("\n").filter((l) => /<(link|meta)/.test(l));
  // 16 px: lo extraigo del ZIP y lo miro
  const x16 = list.find((e) => /16/.test(e.name) && /\.png$/.test(e.name));
  let px16 = null;
  if (x16) {
    const out16 = path.join(L.TMP, "favicon-16.png");
    L.py("import sys,zipfile\nopen(sys.argv[3],'wb').write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))", [zp, x16.name, out16]);
    const buf = readFileSync(out16);
    px16 = await L.analyze(ctx, buf, "image/png");
  }
  await ctx.close();
  return {
    title: "el set Web/PWA y cómo queda el favicon a 16 px",
    image,
    tool: "Icon Studio → solo «Web / PWA» → «Descargar ZIP» y «Copiar HTML de favicons»",
    steps: [
      `En Icon Studio abrí ${image.name} (${image.w} × ${image.h} px, PNG transparente).`,
      "Desmarqué iOS, Android, macOS y Windows; dejé solo «Web / PWA».",
      "Descargué el ZIP y apreté «Copiar HTML de favicons» para leer el portapapeles.",
      "Abrí el PNG de 16 px del ZIP y medí cuánto del cuadro queda opaco.",
    ],
    timing: { zipMs: d.ms },
    result: { zipKB: +(d.buf.length / 1024).toFixed(1), archivos: list, lineasHtml: links, px16: px16 && { name: x16.name, w: px16.w, h: px16.h, kb: px16.kb, opaquePct: px16.opaquePct, transparentPct: px16.transparentPct, semiPct: px16.semiPct } },
    findings: [
      `ZIP de ${f(d.buf.length / 1024, 0)} KB con ${list.length} archivos en ${f(d.ms / 1000, 1)} s: ${list.map((e) => `${e.name} (${f(e.size / 1024, 1)} KB)`).join(", ")}.`,
      `El HTML copiado tiene ${links.length} líneas <link>/<meta>.`,
      px16 ? `El PNG de ${px16.w} × ${px16.h} px: ${pctS(px16.opaquePct)} de los píxeles opacos, ${pctS(px16.semiPct)} semitransparentes y ${pctS(px16.transparentPct)} transparentes.` : "No encontré un PNG de 16 px en el ZIP.",
    ],
    assets: [pub(file)],
    _html: html,
    _zip: zp,
  };
};

// =====================================================================================
TESTS["poner-marca-de-agua-a-una-foto"] = async ({ browser }) => {
  const file = G("quitar-fondo-antes.jpg");
  const image = imgMeta(file);
  const src = readFileSync(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  await L.tab(page, "Editar");
  await radio(page, "Marca de agua");
  await page.locator("textarea:visible").first().fill("© Prueba PhotoCut");
  await page.waitForTimeout(500);
  const rows = {};
  for (const op of [28, 60]) {
    await L.setRange(page, /Opacidad/, op);
    await page.waitForTimeout(400);
    const d = await dl(page, "Descargar con marca");
    const a = await L.analyze(ctx, d.buf, "image/png");
    const df = await L.diff(ctx, src, "image/jpeg", d.buf, "image/png", 8);
    rows[op] = { kb: a.kb, w: a.w, h: a.h, changedPct: df.changedPct, meanAbsDiff: df.meanAbsDiff, ms: d.ms };
  }
  await ctx.close();
  return {
    title: "cuánta foto cubre la marca en mosaico y cuánto pesa el resultado",
    image,
    tool: "Editar → Marca de agua",
    steps: [
      "Abrí el retrato, fui a «Editar» → «Marca de agua» y escribí «© Prueba PhotoCut».",
      "Dejé tamaño 4, ángulo −30° y separación 50 (los valores por defecto) y descargué con opacidad 28 y con 60.",
      "Comparé cada PNG con el original píxel a píxel (diferencia > 8 niveles en algún canal).",
    ],
    timing: { descarga28Ms: rows[28].ms, descarga60Ms: rows[60].ms },
    result: rows,
    findings: [
      `Opacidad 28: ${rows[28].w} × ${rows[28].h} px, ${f(rows[28].kb, 0)} KB; ${pctS(rows[28].changedPct)} de los píxeles cambiaron (diferencia media ${f(rows[28].meanAbsDiff, 2)} niveles).`,
      `Opacidad 60: ${f(rows[60].kb, 0)} KB; ${pctS(rows[60].changedPct)} de los píxeles cambiaron (diferencia media ${f(rows[60].meanAbsDiff, 2)}).`,
      `El original es un JPG de ${f(image.kb, 0)} KB y la salida siempre es PNG: pesa ${f(rows[28].kb / image.kb, 1)} veces más.`,
    ],
    assets: [pub(file)],
  };
};

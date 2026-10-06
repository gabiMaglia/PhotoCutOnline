// Pruebas de Color Studio: contraste, paleta y tema oscuro.
import * as L from "./lib.mjs";
import { f, pctS, G, P, pub, imgMeta, newCtx, dl } from "./common.mjs";

export const TESTS = {};

// WCAG 2.x, calculado aparte para contrastar con lo que muestra la app
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
export const wcag = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function colorStudio(page) {
  await L.tab(page, "Color Studio");
}

// =====================================================================================
TESTS["accesibilidad-de-color-contraste-y-daltonismo"] = async ({ browser }) => {
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await colorStudio(page);
  const read = () =>
    page.evaluate(() => ({
      ratio: document.querySelector(".contrast-ratio")?.textContent,
      badges: [...document.querySelectorAll(".wcag-badge")].map((b) => b.textContent.trim()),
    }));
  const pairs = [
    ["#1f2937", "#d6f64b"], // la que trae por defecto
    ["#777777", "#ffffff"],
    ["#767676", "#ffffff"],
    ["#2563eb", "#ffffff"],
    ["#ffffff", "#d6f64b"],
  ];
  const rows = [];
  let mismatches = 0;
  for (const [fg, bg] of pairs) {
    const before = (await read()).ratio;
    const t0 = Date.now();
    await L.setColor(page, /^Texto$/, fg);
    await L.setColor(page, /^Fondo$/, bg);
    await page.waitForFunction((b) => document.querySelector(".contrast-ratio")?.textContent !== b || b === null, before, { timeout: 3000 }).catch(() => {});
    const ms = Date.now() - t0;
    const r = await read();
    const mine = wcag(fg, bg);
    const shown = parseFloat(r.ratio);
    const ok = Math.abs(shown - mine) < 0.011;
    if (!ok) mismatches++;
    const pass = (x) => r.badges.filter((b) => b.startsWith("✓")).length;
    rows.push({ fg, bg, mostrado: r.ratio, ms: rows.length ? ms : null, mio: +mine.toFixed(3), coincide: ok, badges: r.badges });
  }
  await ctx.close();
  const line = (r) => `${r.fg} sobre ${r.bg}: ${r.mostrado} → ${r.badges.map((b) => b.replace(/\s+/g, " ")).join(", ")}`;
  return {
    title: "el verificador de contraste contra mi propia cuenta de WCAG",
    image: null,
    tool: "Color Studio → Paleta → Contraste (WCAG)",
    steps: [
      "En Color Studio puse cinco pares de colores en «Texto» y «Fondo» con el selector de color (sin cargar ninguna imagen).",
      "Anoté la proporción y los cuatro sellos (AA normal, AA grande, AAA normal, AAA grande) que muestra.",
      "Calculé cada proporción aparte con la fórmula de luminancia relativa de WCAG 2.x y las comparé.",
    ],
    timing: {},
    result: { pares: rows, discrepancias: mismatches },
    findings: [
      ...rows.map(line).map((x) => x + "."),
      `Mi cálculo aparte coincidió con el que muestra la app, a dos decimales, en ${rows.length - mismatches} de ${rows.length} pares.`,
      "No medí tiempos: es una cuenta aritmética que se actualiza al cambiar el color, y la latencia de mi herramienta de medición es mayor que la del cálculo.",
    ],
    assets: [],
  };
};

// =====================================================================================
TESTS["como-elegir-una-paleta-de-colores"] = async ({ browser }) => {
  const photo = G("quitar-fondo-antes.jpg");
  const ui = P("captura-ui-clara.png");
  const image = imgMeta(photo);
  const uiImg = imgMeta(ui);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, photo);
  const t0 = Date.now();
  await colorStudio(page);
  await page.waitForSelector(".color-swatch", { timeout: 15000 });
  const firstMs = Date.now() - t0;
  const swatches = () => page.locator(".color-swatch").evaluateAll((els) => els.map((e) => e.textContent.trim()));
  const sets = {};
  for (const n of [3, 6, 12]) {
    const t1 = Date.now();
    await L.setRange(page, /Cantidad de colores/, n);
    await page.waitForFunction((n) => document.querySelectorAll(".color-swatch").length === n, n, { timeout: 8000 }).catch(() => {});
    sets[n] = { ms: Date.now() - t1, hex: await swatches() };
  }
  await L.setRange(page, /Cantidad de colores/, 6);
  await page.waitForTimeout(500);
  const hex6 = await swatches();
  await page.getByRole("button", { name: "Copiar variables CSS" }).click();
  await page.waitForTimeout(300);
  const css = await page.evaluate(() => navigator.clipboard.readText());
  await page.getByRole("button", { name: "Copiar JSON" }).click();
  await page.waitForTimeout(300);
  const json = await page.evaluate(() => navigator.clipboard.readText());
  let jsonOk = true;
  try { JSON.parse(json); } catch { jsonOk = false; }
  // cuentagotas: sobre una captura de colores planos conocidos
  await L.loadImage(page, ui);
  await page.waitForTimeout(800);
  const pts = [[416, 200, "#F5F7FA"], [1090, 32, "#2563EB"], [900, 283, "#DC2626"], [60, 283, "#16A34A"]];
  const box = await page.locator("canvas.color-canvas").boundingBox();
  const picked = [];
  for (const [x, y, want] of pts) {
    await page.mouse.click(box.x + ((x + 0.5) / uiImg.w) * box.width, box.y + ((y + 0.5) / uiImg.h) * box.height);
    await page.waitForTimeout(150);
    const got = await page.locator(".color-pin").evaluateAll((els) => els.map((e) => e.textContent.trim()));
    picked.push({ pedido: want, pines: got });
  }
  // cada clic suma un pin nuevo: el pin de cada punto es el que apareció respecto al clic anterior
  picked.forEach((p, i) => { const prev = i ? picked[i - 1].pines : []; p.ultimo = p.pines.find((h) => !prev.includes(h)) ?? p.pines[0] ?? null; });
  const exactos = picked.filter((p) => p.ultimo && p.ultimo.toUpperCase() === p.pedido.toUpperCase()).length;
  await ctx.close();
  return {
    title: "de una foto a 6 HEX, a variables CSS, y el cuentagotas contra colores conocidos",
    image,
    tool: "Color Studio → Paleta",
    steps: [
      "Cargué el retrato con «Abrir foto» y fui a «Color Studio» (paleta de 6 colores por defecto).",
      "Moví «Cantidad de colores» a 3, a 12 y de vuelta a 6; apreté «Copiar variables CSS» y «Copiar JSON» y leí el portapapeles.",
      `Cargué ${uiImg.name} (${uiImg.w} × ${uiImg.h} px, ${f(uiImg.kb, 0)} KB), una captura dibujada por mí con colores planos conocidos, y fijé con clic el cuentagotas sobre cuatro zonas.`,
    ],
    timing: { primeraPaletaMs: firstMs, de3Ms: sets[3].ms, de12Ms: sets[12].ms },
    result: { paleta3: sets[3].hex, paleta6: hex6, paleta12: sets[12].hex, cssLineas: css.split("\n").length, jsonValido: jsonOk, css, cuentagotas: picked, cuentagotasExactos: exactos },
    findings: [
      `Al entrar a Color Studio la paleta de 6 apareció en ${f(firstMs / 1000, 2)} s. Cambiar a 3 colores tardó ${sets[3].ms} ms y a 12, ${sets[12].ms} ms.`,
      `Paleta de 6: ${hex6.join(", ")}. Con 3: ${sets[3].hex.join(", ")}.`,
      `«Copiar variables CSS» dejó ${css.split("\n").length} líneas en el portapapeles (primera: «${css.split("\n")[0]}»). «Copiar JSON» ${jsonOk ? "es un JSON válido" : "no es un JSON válido"}.`,
      `Cuentagotas sobre colores planos conocidos: ${exactos} de ${picked.length} HEX coincidieron exactamente (${picked.map((p) => `${p.pedido} → ${p.ultimo}`).join("; ")}).`,
    ],
    assets: [pub(photo), pub(ui)],
  };
};

// =====================================================================================
TESTS["generar-modo-oscuro-desde-una-captura"] = async ({ browser }) => {
  const file = P("captura-ui-clara.png");
  const image = imgMeta(file);
  const { ctx } = await newCtx(browser);
  const page = await L.openEditor(ctx);
  await L.loadImage(page, file);
  await colorStudio(page);
  await page.getByRole("radio", { name: "Tema", exact: true }).click();
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const c = document.querySelectorAll("canvas.cs-canvas")[1];
    if (!c || !c.width) return false;
    const d = c.getContext("2d").getImageData(0, 0, Math.min(c.width, 64), Math.min(c.height, 64)).data;
    return d.some((v, i) => i % 4 === 3 && v > 0);
  }, null, { timeout: 15000 });
  const renderMs = Date.now() - t0;
  const pts = [[416, 200], [380, 315], [1090, 32], [900, 283], [60, 283]]; // fondo de página, tarjeta, botón azul, sello rojo, sello verde
  const src = await L.pixels(ctx, (await import("node:fs")).readFileSync(file), "image/png", pts);
  const a = await dl(page, "Descargar imagen");
  const dark = await L.analyze(ctx, a.buf, "image/png");
  const darkPx = await L.pixels(ctx, a.buf, "image/png", pts);
  const before = await L.analyze(ctx, (await import("node:fs")).readFileSync(file), "image/png");
  // mantener acentos
  await page.getByRole("checkbox", { name: /Mantener colores de acento/ }).check().catch(async () => { await page.getByLabel("Mantener colores de acento").check(); });
  await page.waitForTimeout(600);
  const b = await dl(page, "Descargar imagen");
  const keepPx = await L.pixels(ctx, b.buf, "image/png", pts);
  // intensidad más baja, sin acentos
  await page.getByLabel("Mantener colores de acento").uncheck();
  await L.setRange(page, /Intensidad/, 70);
  await page.waitForTimeout(600);
  const c70 = await dl(page, "Descargar imagen");
  const px70 = await L.pixels(ctx, c70.buf, "image/png", pts);
  await page.getByRole("button", { name: "Copiar CSS" }).click();
  await page.waitForTimeout(300);
  const css = await page.evaluate(() => navigator.clipboard.readText());
  await ctx.close();
  const hex = (p) => "#" + p.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
  const names = ["fondo de página", "fondo de tarjeta", "botón azul", "sello rojo", "sello verde"];
  const ratio = (p, q) => wcag(hex(p), hex(q));
  return {
    title: "una captura clara pasada a oscuro y qué cambia de verdad",
    image,
    tool: "Color Studio → Tema → «→ Oscuro»",
    steps: [
      `Cargué ${image.name} (${image.w} × ${image.h} px, ${f(image.kb, 0)} KB), una captura de una app en modo claro dibujada por mí.`,
      "En Color Studio → «Tema» dejé «→ Oscuro» con intensidad 100 y descargué la imagen.",
      "Marqué «Mantener colores de acento», descargué otra vez y leí cinco píxeles de referencia en las tres versiones.",
      "Apreté «Copiar CSS» del esquema de color y leí el portapapeles.",
    ],
    timing: { dibujarMs: renderMs, descargaMs: a.ms },
    result: {
      lumaMedia: { antes: before.meanLuma, despues: dark.meanLuma },
      pixeles: names.map((n, i) => ({ zona: n, original: hex(src[i]), oscuro: hex(darkPx[i]), conAcentos: hex(keepPx[i]) })),
      contrasteFondoTarjeta: { antes: +ratio(src[0], src[1]).toFixed(2), despues: +ratio(darkPx[0], darkPx[1]).toFixed(2), intensidad70: +ratio(px70[0], px70[1]).toFixed(2) },
      intensidad70: { fondo: hex(px70[0]), tarjeta: hex(px70[1]) },
      cssLineas: css.split("\n").length,
      kbOscuro: dark.kb,
    },
    findings: [
      `La luminancia media pasó de ${f(before.meanLuma, 0)} a ${f(dark.meanLuma, 0)} (de 0 a 255). El modo oscuro se dibujó en ${renderMs} ms y la descarga tardó ${a.ms} ms.`,
      ...names.map((n, i) => `${n}: ${hex(src[i])} → ${hex(darkPx[i])} (con acentos: ${hex(keepPx[i])}).`),
      `El contraste entre el fondo de página y el de tarjeta pasó de ${f(ratio(src[0], src[1]), 2)}:1 a ${f(ratio(darkPx[0], darkPx[1]), 2)}:1.`,
      `Con la intensidad en 70 el fondo de página queda ${hex(px70[0])} y la tarjeta ${hex(px70[1])}: contraste ${f(ratio(px70[0], px70[1]), 2)}:1.`,
      `El esquema CSS copiado tiene ${css.split("\n").length} líneas.`,
    ],
    assets: [pub(file)],
  };
};

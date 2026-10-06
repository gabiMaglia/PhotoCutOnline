// Utilidades compartidas por los módulos de pruebas (GROW-31).
import path from "node:path";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import * as L from "./lib.mjs";

// ---------- utilidades de formato (ES: coma decimal) ----------
export const f = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
export const kb = (b) => f(b / 1024, 1);
export const pctS = (x) => f(x, 1) + " %";

export const G = (n) => path.join(L.GUIAS, n);
export const P = (n) => path.join(L.GUIAS, "pruebas", n);
export const pub = (abs) => "/" + path.relative(path.join(L.ROOT, "public"), abs);

export function imgMeta(file) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]).toString();
  return {
    name: path.basename(file),
    src: pub(file),
    w: +out.match(/pixelWidth: (\d+)/)[1],
    h: +out.match(/pixelHeight: (\d+)/)[1],
    kb: +(statSync(file).size / 1024).toFixed(1),
  };
}

export async function newCtx(browser, { block = true } = {}) {
  const ctx = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const blocked = block ? await L.blockThirdParty(ctx) : [];
  return { ctx, blocked };
}

// Recorte IA sobre la imagen cargada; devuelve ms desde el clic hasta el aviso "Recorte IA aplicado".
export async function runAI(page) {
  await L.clickText(page, "Recorte IA");
  return (await L.toastSinceClick(page, /Recorte IA aplicado/, 90000)).ms;
}

export async function guideBox(page) {
  return page.locator("canvas.guide").boundingBox();
}

// Trazo con el pincel actual en coordenadas de imagen; ~700 ms entre trazos (el motor los encola).
export async function stroke(page, img, pts) {
  const bb = await guideBox(page);
  const sx = bb.width / img.w, sy = bb.height / img.h;
  const map = ([x, y]) => [bb.x + x * sx, bb.y + y * sy];
  const [a, ...rest] = pts.map(map);
  await page.mouse.move(...a);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(...p, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(700);
}

export async function clickCanvas(page, img, [x, y]) {
  const bb = await guideBox(page);
  await page.mouse.click(bb.x + (x * bb.width) / img.w, bb.y + (y * bb.height) / img.h);
}

export const dl = (page, name = "Descargar") => L.download(page, () => page.getByRole("button", { name, exact: false }).first().click());
export const radio = (page, name) => page.getByRole("radio", { name, exact: true }).click();

export async function choosePreset(page, re) {
  await page.getByRole("button", { name: "Preset de tamaño" }).click();
  await page.getByRole("option", { name: re }).click();
  await page.waitForTimeout(200);
}


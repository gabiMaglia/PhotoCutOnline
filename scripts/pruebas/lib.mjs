// Utilidades compartidas por las pruebas de "Lo probamos" (GROW-31).
// Todas las mediciones salen de Chrome real contra `npm run build` + `vite preview`.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const BASE = process.env.PRUEBAS_BASE || "http://localhost:4399";
export const ROOT = path.resolve(import.meta.dirname, "../..");
export const GUIAS = path.join(ROOT, "public/media/guias");
export const TMP = process.env.PRUEBAS_TMP || "/tmp/pruebas-grow31";
mkdirSync(TMP, { recursive: true });

export async function launch() {
  return chromium.launch({ channel: "chrome", headless: true });
}

export function chromeVersion(browser) {
  return browser.version();
}

export function macVersion() {
  return execFileSync("sw_vers", ["-productVersion"]).toString().trim();
}

export function commit() {
  return execFileSync("git", ["merge-base", "HEAD", "main"], { cwd: ROOT }).toString().trim().slice(0, 7);
}

// Abre el editor en ES, sin onboarding, con un observador de toasts con marca de tiempo.
export async function openEditor(ctx, { viewport = { width: 1440, height: 900 } } = {}) {
  const page = await ctx.newPage();
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem("pc-lang", "es");
    localStorage.setItem("pc-onboarded", "1");
    window.__toasts = [];
    window.__clicks = [];
    document.addEventListener("click", () => window.__clicks.push(performance.now()), true);
    addEventListener("DOMContentLoaded", () => {
      new MutationObserver((ms) => {
        for (const m of ms)
          for (const n of m.addedNodes)
            if (n.nodeType === 1 && n.classList?.contains("toast"))
              window.__toasts.push({ t: performance.now(), text: n.textContent });
      }).observe(document.body, { childList: true, subtree: true });
    });
  });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.goto(`${BASE}/editor/`);
  await page.waitForSelector("input[type=file]", { state: "attached" });
  return page;
}

export async function loadImage(page, file, input = 0) {
  const t0 = Date.now();
  await page.locator("input[type=file]").nth(input).setInputFiles(file);
  await page.waitForFunction(() => window.__toasts.some((t) => /cargados/.test(t.text)), null, { timeout: 20000 }).catch(() => {});
  return Date.now() - t0;
}

// Espera un toast que cumpla el patrón y devuelve ms desde el último click.
export async function toastSinceClick(page, re, timeout = 60000) {
  await page.waitForFunction(
    (src) => {
      const r = new RegExp(src);
      const last = window.__clicks[window.__clicks.length - 1] ?? 0;
      return window.__toasts.some((t) => t.t >= last && r.test(t.text));
    },
    re.source,
    { timeout, polling: 10 }
  );
  return page.evaluate((src) => {
    const r = new RegExp(src);
    const last = window.__clicks[window.__clicks.length - 1] ?? 0;
    const t = window.__toasts.find((x) => x.t >= last && r.test(x.text));
    return { ms: Math.round(t.t - last), text: t.text };
  }, re.source);
}

export const clickText = (page, text, opts = {}) =>
  page.getByRole(opts.role || "button", { name: text, exact: opts.exact ?? false }).first().click();

export async function tab(page, name) {
  await page.getByRole("tab", { name, exact: true }).click();
  await page.waitForTimeout(400);
}

// Descarga disparada por `action`; devuelve {buf, name, ms}.
export async function download(page, action) {
  const t0 = Date.now();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), action()]);
  const p = path.join(TMP, `${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(p);
  return { buf: readFileSync(p), name: dl.suggestedFilename(), path: p, ms: Date.now() - t0 };
}

// Analiza bytes de imagen dentro de una página en blanco (canvas).
// Devuelve dimensiones, peso, % transparente/semitransparente/blanco puro, caja del
// sujeto (alpha>128), % del sujeto que cae fuera del círculo inscrito, luminancia media,
// píxeles "oscuros" (tinta) y un hash del RGBA para comparar imágenes idénticas.
export async function analyze(ctx, buf, mime) {
  const pg = await ctx.newPage();
  await pg.goto("about:blank");
  const out = await pg.evaluate(
    async ({ b64, mime }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin], { type: mime }), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
      const W = bmp.width, H = bmp.height;
      const c = new OffscreenCanvas(W, H);
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      const n = W * H;
      let t0 = 0, semi = 0, opaque = 0, white = 0, lum = 0, dark = 0, subj = 0, outside = 0;
      let x0 = W, y0 = H, x1 = -1, y1 = -1, h = 2166136261, cornerNW = 0, cornerN = 0;
      let nx0 = W, ny0 = H, nx1 = -1, ny1 = -1, nwCount = 0, nwOut = 0;
      const PW = Math.min(40, W >> 2), PH = Math.min(40, H >> 2);
      const R = Math.min(W, H) / 2, cx = W / 2, cy = H / 2;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const a = d[i + 3];
          if (a === 0) t0++; else if (a === 255) opaque++; else semi++;
          if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255 && a === 255) white++;
          if ((x < PW || x >= W - PW) && (y < PH || y >= H - PH)) { cornerN++; if (!(d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255 && a === 255)) cornerNW++; }
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          lum += l;
          if (a > 128 && l < 110) dark++;
          if (a > 128 && Math.min(d[i], d[i + 1], d[i + 2]) < 235) {
            nwCount++;
            if (x < nx0) nx0 = x; if (x > nx1) nx1 = x; if (y < ny0) ny0 = y; if (y > ny1) ny1 = y;
            if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R) nwOut++;
          }
          if (a > 128) {
            subj++;
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R) outside++;
          }
          h = Math.imul(h ^ d[i], 16777619) ^ d[i + 1]; h = Math.imul(h, 16777619) ^ d[i + 2]; h = Math.imul(h, 16777619) ^ a;
        }
      }
      const px = (x, y) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
      const pct = (v, t = n) => +((100 * v) / t).toFixed(2);
      return {
        w: W, h: H, n,
        transparentPct: pct(t0), semiPct: pct(semi), opaquePct: pct(opaque), whitePct: pct(white),
        meanLuma: +(lum / n).toFixed(2), darkPx: dark, subjectPx: subj,
        bbox: subj ? { x0, y0, x1, y1, wPct: pct(x1 - x0 + 1, W), hPct: pct(y1 - y0 + 1, H) } : null,
        outsideCirclePct: subj ? pct(outside, subj) : null,
        nonWhite: nwCount ? { bbox: { x0: nx0, y0: ny0, x1: nx1, y1: ny1, wPct: pct(nx1 - nx0 + 1, W), hPct: pct(ny1 - ny0 + 1, H) }, outsideCirclePct: pct(nwOut, nwCount), px: nwCount } : null,
        cornerNonWhitePct: pct(cornerNW, cornerN),
        hash: (h >>> 0).toString(16),
        corners: [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)],
        center: px(W >> 1, H >> 1),
      };
    },
    { b64: buf.toString("base64"), mime }
  );
  await pg.close();
  return { kb: +(buf.length / 1024).toFixed(1), bytes: buf.length, ...out };
}

// Lee píxeles puntuales de una imagen: pts=[[x,y],...] -> [[r,g,b,a],...]
export async function pixels(ctx, buf, mime, pts) {
  const pg = await ctx.newPage();
  await pg.goto("about:blank");
  const out = await pg.evaluate(
    async ({ b64, mime, pts }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin], { type: mime }), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      return pts.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data));
    },
    { b64: buf.toString("base64"), mime, pts }
  );
  await pg.close();
  return out;
}

// Compara dos imágenes del mismo tamaño: % de píxeles que difieren > umbral y diferencia media.
export async function diff(ctx, bufA, mimeA, bufB, mimeB, thr = 8) {
  const pg = await ctx.newPage();
  await pg.goto("about:blank");
  const out = await pg.evaluate(
    async ({ a, ma, b, mb, thr }) => {
      const load = async (b64, m) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bin], { type: m }));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(bmp, 0, 0);
        return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
      };
      const A = await load(a, ma), B = await load(b, mb);
      if (A.w !== B.w || A.h !== B.h) return { error: `tamaños distintos ${A.w}x${A.h} vs ${B.w}x${B.h}` };
      let chg = 0, sum = 0;
      for (let i = 0; i < A.d.length; i += 4) {
        const m = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
        sum += m; if (m > thr) chg++;
      }
      const n = A.w * A.h;
      return { changedPct: +((100 * chg) / n).toFixed(2), meanAbsDiff: +(sum / n).toFixed(2) };
    },
    { a: bufA.toString("base64"), ma: mimeA, b: bufB.toString("base64"), mb: mimeB, thr }
  );
  await pg.close();
  return out;
}

// Mueve un range de React (dispara input/change nativos).
export async function setRange(page, labelRe, value) {
  const ok = await page.evaluate(
    ({ src, value }) => {
      const re = new RegExp(src);
      const label = [...document.querySelectorAll("label")].filter((l) => l.offsetParent).find((l) => re.test(l.textContent));
      const inp = label && (label.querySelector("input[type=range]") || document.getElementById(label.htmlFor));
      if (!inp) return false;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(inp, String(value));
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { src: labelRe.source, value }
  );
  if (!ok) throw new Error("range no encontrado: " + labelRe);
  await page.waitForTimeout(150);
}

export async function setColor(page, ariaOrLabelRe, hex) {
  const ok = await page.evaluate(
    ({ src, hex }) => {
      const re = new RegExp(src);
      const inp = [...document.querySelectorAll("input[type=color]")].find((i) => i.offsetParent && re.test(i.getAttribute("aria-label") || ""));
      if (!inp) return false;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(inp, hex);
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { src: ariaOrLabelRe.source, hex }
  );
  if (!ok) throw new Error("color no encontrado: " + ariaOrLabelRe);
  await page.waitForTimeout(150);
}

export const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

// Bloquea hosts de terceros (anuncios) para medir sin ruido; devuelve la lista bloqueada.
export async function blockThirdParty(ctx) {
  const blocked = [];
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => { blocked.push(new URL(r.request().url()).host); r.abort(); });
  return blocked;
}

export function mimeOf(name) {
  return /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : "image/jpeg";
}

export function py(code, args = []) {
  return execFileSync("python3", ["-c", code, ...args], { cwd: ROOT }).toString();
}

export function saveJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

// Densidad de borde por franjas horizontales: píxeles semitransparentes y de contorno por banda.
export async function edgeBands(ctx, buf, mime, bands) {
  const pg = await ctx.newPage();
  await pg.goto("about:blank");
  const out = await pg.evaluate(
    async ({ b64, mime, bands }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin], { type: mime }), { premultiplyAlpha: "none" });
      const W = bmp.width, H = bmp.height;
      const c = new OffscreenCanvas(W, H);
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      const A = (x, y) => d[(y * W + x) * 4 + 3];
      return bands.map(([name, ya, yb]) => {
        let semi = 0, contour = 0;
        for (let y = Math.max(1, Math.round(ya * H)); y < Math.min(H - 1, Math.round(yb * H)); y++)
          for (let x = 1; x < W - 1; x++) {
            const a = A(x, y);
            if (a > 0 && a < 255) semi++;
            if (a > 128 && (A(x - 1, y) < 128 || A(x + 1, y) < 128 || A(x, y - 1) < 128 || A(x, y + 1) < 128)) contour++;
          }
        return { name, semi, contour, semiPerContour: contour ? +(semi / contour).toFixed(2) : null };
      });
    },
    { b64: buf.toString("base64"), mime, bands }
  );
  await pg.close();
  return out;
}

// % de píxeles opacos (alpha>128) en una franja horizontal [ya, yb) (fracciones de la altura).
export async function bandOpaque(ctx, buf, mime, ya, yb) {
  const pg = await ctx.newPage();
  await pg.goto("about:blank");
  const out = await pg.evaluate(
    async ({ b64, mime, ya, yb }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin], { type: mime }), { premultiplyAlpha: "none" });
      const W = bmp.width, H = bmp.height;
      const c = new OffscreenCanvas(W, H);
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      const y0 = Math.round(ya * H), y1 = Math.round(yb * H);
      const d = g.getImageData(0, y0, W, y1 - y0).data;
      let o = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 128) o++;
      return +((100 * o) / (W * (y1 - y0))).toFixed(2);
    },
    { b64: buf.toString("base64"), mime, ya, yb }
  );
  await pg.close();
  return out;
}

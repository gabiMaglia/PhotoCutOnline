// Suite del service worker frente a deploys (BUG-08, casos C1–C6 y C8 del plan).
//
// No usa `vite dev` como el resto: ahí el SW no se registra y no hay hashes.
// Hace su propio build en un tmp, deriva tres deploys (A, B, C) y los sirve en
// el mismo origen con un servidor que imita a Vercel (404 text/html para el
// /assets/ que ya no existe). Corre desde run-tests.mjs en Chrome y WebKit, o
// suelta:  node test/sw-deploy-test.mjs [chrome|webkit]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDeployServer } from "./lib/deployServer.mjs";
import { foreignBodyViolation } from "./lib/originPolicy.mjs";
import { readBuildId, renameSet, deriveDeploy } from "./lib/deploys.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5188;
const ORIGIN = `http://localhost:${PORT}`;
const NOTICE = "Hay una versión nueva de PhotoCut. Recargá la página para seguir.";
// WebKit es mucho más lento en el recorte (ver TIMEOUT_MS de run-tests.mjs)
const WAIT_MS = { chrome: 60_000, webkit: 240_000 };

// ---- preparación: un build real + deploys derivados (una vez por proceso) ----

let prepared = null;
function prepare() {
  if (prepared) return prepared;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photocut-sw-"));
  process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
  const B = path.join(tmp, "B");
  const vite = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  // VITE_SITE_URL vacío: el plugin SEO escribe en dist/ del repo si la variable existe
  const r = spawnSync(process.execPath, [vite, "build", "--outDir", B, "--emptyOutDir", "--logLevel", "error"], {
    cwd: ROOT,
    env: { ...process.env, VITE_SITE_URL: "" },
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("falló el build de la suite");

  const id = readBuildId(B);
  const renamed = renameSet(B);
  const A = deriveDeploy(B, path.join(tmp, "A"), "a", renamed, id);
  const C = deriveDeploy(B, path.join(tmp, "C"), "c", renamed, id);
  const entryOf = (list) => list.find((f) => /^editor-.*\.js$/.test(f));
  prepared = {
    roots: { A: A.dir, B, C: C.dir },
    ids: { A: A.id, B: id, C: C.id },
    only: { A: A.renamed, B: renamed, C: C.renamed },
    entry: { A: entryOf(A.renamed), B: entryOf(renamed), C: entryOf(C.renamed) },
  };
  return prepared;
}

// ---- utilidades ----

// PNG RGBA mínimo (sin fixture ni dependencias): fondo claro y un cuadrado oscuro
function makePng(w = 96, h = 96) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x > w / 4 && x < (3 * w) / 4 && y > h / 4 && y < (3 * h) / 4;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw.set(inside ? [30, 60, 160, 255] : [235, 235, 230, 255], o);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const PNG = makePng();

async function newContext(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("pc-onboarded", "1");
      localStorage.setItem("pc-lang", "es");
    } catch {
      /* sin storage */
    }
  });
  // editor/index.html trae AdSense fijo: los terceros se cortan (suite hermética),
  // pero en WebKit con el SW activo ctx.route no los ve y el script real corre.
  // Se exige la promesa de privacidad (la foto no sale del navegador): ver
  // lib/originPolicy.mjs, que tolera solo los pings de los anuncios declarados.
  await ctx.route((url) => url.origin !== ORIGIN, (route) => route.abort());
  const foreign = [];
  const budget = { used: 0 };
  ctx.on("request", (r) => {
    const bad = foreignBodyViolation({ origin: ORIGIN, method: r.method(), url: r.url(), body: r.postDataBuffer(), budget });
    if (bad) foreign.push(bad);
  });
  return { ctx, foreign };
}

// Espera a que el SW del build `id` esté activo y controlando la página. Sin id
// (sw.js sin BUILD_ID, árbol previo) alcanza con que haya uno activo.
// SW mínimo con la forma de los anteriores a BUG-08: una sola caché photocut-v2
// con una entrada vieja y el modelo.
const LEGACY_SW = `
self.addEventListener("install", (e) => e.waitUntil((async () => {
  const c = await caches.open("photocut-v2");
  await c.put("/assets/old-XXXX.js", new Response("// viejo", { headers: { "content-type": "text/javascript" } }));
  await c.add("/models/u2netp.onnx");
  await self.skipWaiting();
})()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
`;

async function waitFor(page, fn, timeout = 30_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`condición no cumplida en ${timeout} ms`);
}

// Polling desde node con evaluate (que sí espera Promises): waitForFunction no
// documenta predicados async y una Promise cuenta como «truthy».
async function waitActive(page, id, timeout = 30_000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await page
      .evaluate(async (id) => {
        const r = await navigator.serviceWorker.getRegistration();
        if (!r || r.installing || r.waiting || r.active?.state !== "activated") return "sin SW activo";
        if (!navigator.serviceWorker.controller) return "sin controller";
        if (!id) return true;
        const meta = await (await caches.open("photocut-meta")).match("/__photocut-sw/builds");
        const current = meta && (await meta.json())[0]?.id;
        return current === id || `build activo ${current}`;
      }, id)
      .catch((e) => e.message.split("\n")[0]);
    if (last === true) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`el SW del build ${id ?? "(sin id)"} no quedó activo en ${timeout} ms (${last})`);
}

const entryScript = (page) =>
  page.evaluate(() => document.querySelector('script[type="module"][src*="/assets/editor-"]')?.getAttribute("src"));
const buildMeta = (page) =>
  page.evaluate(() => document.querySelector('meta[name="photocut-build"]')?.getAttribute("content") ?? null);

// Abre la imagen por el input del navbar y espera el resultado (toast o aviso).
async function openImage(page, timeout) {
  await page.locator('input[type="file"]').first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  return settle(page, /px cargados/, timeout);
}

async function settle(page, okText, timeout) {
  const handle = await page.waitForFunction(
    (src) => {
      if (document.querySelector(".update-notice")) return "notice";
      const err = document.querySelector(".toast-error");
      if (err) return `error: ${err.textContent}`;
      const ok = [...document.querySelectorAll(".toast-ok")].some((t) => new RegExp(src).test(t.textContent));
      return ok ? "ok" : false;
    },
    okText.source,
    { timeout, polling: 200 }
  );
  return handle.jsonValue();
}

async function openFilters(page, timeout = 15_000) {
  await page.getByRole("radio", { name: "Filtros" }).first().click();
  // el radio marcado lo dibuja la propia FiltersPage: si su chunk no cargó, no aparece
  await page.getByRole("radio", { name: "Filtros", checked: true }).first().waitFor({ state: "visible", timeout });
}

const bodyText = (page) => page.evaluate(() => document.body.innerText);
const assets404 = (log) => log.filter((e) => e.path.startsWith("/assets/") && e.status === 404).map((e) => e.path);
const swState = (page) =>
  page.evaluate(async () => {
    const out = {};
    for (const name of await caches.keys()) {
      out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
    }
    return out;
  });

// ---- casos ----

const CASES = {
  // C1 + C6 + C2 comparten contexto: A visitado → deploy B → offline.
  async "C1/C6/C2 deploy nuevo con el editor visitado, sin re-descargas, y offline"(browser, tag, P, srv, check) {
    const { ctx, foreign } = await newContext(browser);
    try {
      const page = await ctx.newPage();
      srv.state.deploy = "A";
      await page.goto(`${ORIGIN}/editor/`);
      await waitActive(page, P.ids.A);
      // segunda visita ya controlada por el SW (el usuario que vuelve): es la
      // que deja el HTML de A en la caché del SW actual
      await page.goto(`${ORIGIN}/editor/`);
      const fetchedUnderA = new Set(srv.state.log.filter((e) => e.status === 200).map((e) => e.path));
      const mark = srv.state.log.length;

      srv.state.deploy = "B";
      await page.goto(`${ORIGIN}/editor/`);
      check("C1", (await entryScript(page)) === `/assets/${P.entry.B}`, `HTML servido = deploy B (entry ${await entryScript(page)})`);
      if (P.ids.B) check("C1", (await buildMeta(page)) === P.ids.B, `BUILD_ID del HTML = B (${await buildMeta(page)})`);
      const loaded = await openImage(page, WAIT_MS[tag]).catch((e) => `timeout: ${e.message.split("\n")[0]}`);
      check("C1", loaded === "ok", `imagen cargada por el worker (${loaded})`);
      if (loaded === "ok") {
        await page.locator(".btn-auto").first().click();
        const auto = await settle(page, /Recorte automático aplicado/, WAIT_MS[tag]).catch((e) => `timeout: ${e.message.split("\n")[0]}`);
        check("C1", auto === "ok", `recorte automático terminado (${auto})`);
      }
      check("C1", !/worker error/i.test(await bodyText(page)), "sin «worker error» en pantalla");
      await waitActive(page, P.ids.B);
      const afterB = srv.state.log.slice(mark);
      check("C1", assets404(afterB).length === 0, `0 respuestas 404 de /assets/ (${assets404(afterB).join(", ")})`);
      const refetched = afterB.filter((e) => e.path.startsWith("/assets/") && fetchedUnderA.has(e.path)).map((e) => e.path);
      check("C6", refetched.length === 0, `0 re-descargas de assets ya bajados con A (${refetched.join(", ")})`);

      // C2: sin red (el puerto rechaza conexiones, como un usuario real; en Chrome además setOffline)
      await srv.setDown(true);
      if (tag === "chrome") await ctx.setOffline(true);
      let offline = "ok";
      try {
        await page.goto(`${ORIGIN}/editor/?tab=text`);
        await openFilters(page);
      } catch (e) {
        // el mensaje completo trae el «intercepts pointer events» / «not visible» que
        // explica un timeout de click; la primera línea sola lo esconde (BUG-15)
        offline = e.message.split("\n").slice(0, 8).join(" | ");
        // WebKit/Linux a veces pierde registro y cachés a mitad de la carga: es del motor, no del SW
        const lost = await page
          .evaluate(async () => !(await navigator.serviceWorker.getRegistration()) || (await caches.keys()).length === 0)
          .catch(() => false);
        if (lost) offline = `arnés: WebKit perdió el storage (${offline})`;
      }
      check("C2", offline === "ok", `offline: el editor arranca y abre Filtros (${offline})`);
      if (tag === "chrome") await ctx.setOffline(false);
      await srv.setDown(false);
    } finally {
      check("origen", foreign.length === 0, `ninguna request fuera del origen con cuerpo (${foreign.join(", ")})`);
      await ctx.close();
    }
  },

  async "C3 red lenta: HTML de caché en ≤ 3,5 s y después el más nuevo"(browser, tag, P, srv, check) {
    const { ctx, foreign } = await newContext(browser);
    try {
      const page = await ctx.newPage();
      srv.state.deploy = "B";
      await page.goto(`${ORIGIN}/editor/`);
      await waitActive(page, P.ids.B);

      srv.state.deploy = "C";
      srv.state.htmlDelay = 6000;
      const t0 = Date.now();
      await page.goto(`${ORIGIN}/editor/`, { waitUntil: "domcontentloaded" });
      const dt = Date.now() - t0;
      check("C3", dt <= 3500, `HTML servido en ${dt} ms (≤ 3500)`);
      check("C3", (await entryScript(page)) === `/assets/${P.entry.B}`, `HTML de caché = B (${await entryScript(page)})`);
      const loaded = await openImage(page, WAIT_MS[tag]).catch((e) => `timeout: ${e.message.split("\n")[0]}`);
      check("C3", loaded === "ok", `la imagen carga con el worker de B (${loaded})`);

      srv.state.htmlDelay = 0;
      await page.goto(`${ORIGIN}/editor/`);
      check("C3", (await entryScript(page)) === `/assets/${P.entry.C}`, `sin demora llega el HTML nuevo = C (${await entryScript(page)})`);
    } finally {
      check("origen", foreign.length === 0, `ninguna request fuera del origen con cuerpo (${foreign.join(", ")})`);
      await ctx.close();
    }
  },

  async "C4 pestaña abierta durante un deploy (N-1)"(browser, tag, P, srv, check) {
    const { ctx, foreign } = await newContext(browser);
    try {
      const page = await ctx.newPage();
      srv.state.deploy = "A";
      await page.goto(`${ORIGIN}/editor/?tab=text`);
      await waitActive(page, P.ids.A);
      await page.getByRole("radio", { name: "Texto", checked: true }).first().waitFor({ state: "visible" });

      srv.state.deploy = "B";
      const mark = srv.state.log.length;
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
      await waitActive(page, P.ids.B);
      let res = "ok";
      try {
        await openFilters(page);
      } catch (e) {
        res = e.message.split("\n")[0];
      }
      check("C4", res === "ok", `la pestaña de A abre Filtros con B ya activo (${res})`);
      const bad = assets404(srv.state.log.slice(mark));
      check("C4", bad.length === 0, `0 respuestas 404 de /assets/ (${bad.join(", ")})`);
    } finally {
      check("origen", foreign.length === 0, `ninguna request fuera del origen con cuerpo (${foreign.join(", ")})`);
      await ctx.close();
    }
  },

  async "C5 poda: A → B → C, sin caché heredada ni re-descarga del modelo"(browser, tag, P, srv, check) {
    const { ctx, foreign } = await newContext(browser);
    try {
      const page = await ctx.newPage();
      // La caché heredada la escribe un SW «de antes» (como pasó en la realidad).
      // Sembrarla desde la página no sirve en WebKit de Playwright: el SW ve el
      // nombre de la caché pero no sus entradas escritas desde la página.
      srv.state.deploy = "A";
      srv.state.swOverride = LEGACY_SW;
      await page.goto(`${ORIGIN}/editor/`);
      await waitFor(page, async () => {
        const c = await caches.open("photocut-v2");
        return (await c.keys()).length === 2 && !!navigator.serviceWorker.controller;
      });
      srv.state.swOverride = null;
      const mark = srv.state.log.length;
      for (const d of ["A", "B", "C"]) {
        srv.state.deploy = d;
        await page.goto(`${ORIGIN}/editor/`);
        await waitActive(page, P.ids[d]);
      }
      const caches = await swState(page);
      const all = Object.values(caches).flat();
      const has = (name) => all.some((u) => u.endsWith(`/${name}`));
      check("C5", !("photocut-v2" in caches), `no queda la caché heredada photocut-v2 (${Object.keys(caches).join(", ")})`);
      check("C5", !all.includes("/assets/old-XXXX.js"), "no queda la entrada vieja sembrada");
      const leftA = P.only.A.filter(has);
      check("C5", leftA.length === 0, `ninguna URL exclusiva de A (${leftA.join(", ")})`);
      const missing = [...P.only.B, ...P.only.C].filter((n) => !has(n));
      check("C5", missing.length === 0, `quedan las de B y C (faltan: ${missing.join(", ")})`);
      check("C5", all.includes("/models/u2netp.onnx"), "el modelo vigente sigue en caché");
      const refetched = srv.state.log.slice(mark).filter((e) => e.path === "/models/u2netp.onnx").length;
      check("C5", refetched === 0, `el modelo no se volvió a pedir (${refetched} veces)`);
    } finally {
      check("origen", foreign.length === 0, `ninguna request fuera del origen con cuerpo (${foreign.join(", ")})`);
      await ctx.close();
    }
  },

  async "C8 aviso de versión nueva (worker 404 y chunk 404)"(browser, tag, P, srv, check) {
    // sin SW: así el 404 llega sí o sí al cliente
    const { ctx, foreign } = await newContext(browser, { serviceWorkers: "block" });
    try {
      const expectNotice = async (page, what) => {
        const notice = page.locator(".update-notice");
        await notice.waitFor({ state: "visible", timeout: 20_000 });
        check("C8", (await notice.textContent()).includes(NOTICE), `${what}: aviso traducido visible`);
        check("C8", await notice.getByRole("button", { name: "Recargar" }).isVisible(), `${what}: botón Recargar`);
        check("C8", !/worker error/i.test(await bodyText(page)), `${what}: sin «worker error»`);
        check("C8", (await page.evaluate(() => window.__noReload)) === 1, `${what}: la página no se recargó sola`);
      };

      srv.state.deploy = "B";
      srv.state.missing = /cutoutWorker-/;
      const page = await ctx.newPage();
      await page.goto(`${ORIGIN}/editor/`);
      await page.evaluate(() => (window.__noReload = 1));
      await openImage(page, 20_000).catch(() => {});
      await expectNotice(page, "worker 404").catch((e) => check("C8", false, `worker 404: ${e.message.split("\n")[0]}`));

      srv.state.missing = /FiltersPage-/;
      const page2 = await ctx.newPage();
      await page2.goto(`${ORIGIN}/editor/?tab=text`);
      await page2.evaluate(() => (window.__noReload = 1));
      await page2.getByRole("radio", { name: "Filtros" }).first().click();
      await expectNotice(page2, "chunk 404 (vite:preloadError)").catch((e) =>
        check("C8", false, `chunk 404: ${e.message.split("\n")[0]}`)
      );
    } finally {
      srv.state.missing = null;
      check("origen", foreign.length === 0, `ninguna request fuera del origen con cuerpo (${foreign.join(", ")})`);
      await ctx.close();
    }
  },
};

/** Corre todos los casos en `browser`. Devuelve la cantidad de casos con fallos. */
export async function runSwDeploy(browser, tag) {
  process.stdout.write(`\n■ sw-deploy-test${tag === "chrome" ? "" : ` [${tag}]`}\n`);
  const P = prepare();
  const srv = createDeployServer({ roots: P.roots, port: PORT });
  await srv.listen();
  let bad = 0;
  try {
    for (const [name, run] of Object.entries(CASES)) {
      await srv.reset();
      const fails = [];
      const check = (id, ok, msg) => {
        console.log(`  ${ok ? "PASS" : "FAIL"}: ${id} ${msg}`);
        if (!ok) fails.push(msg);
      };
      const t0 = Date.now();
      try {
        await run(browser, tag, P, srv, check);
      } catch (e) {
        check("ERROR", false, `${name}: ${e.message.split("\n")[0]}`);
      }
      console.log(`  (${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      if (fails.length) bad++;
    }
  } finally {
    await srv.close();
  }
  return bad;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { chromium, webkit } = await import("playwright-core");
  const tag = process.argv[2] || "chrome";
  const browser =
    tag === "webkit"
      ? await webkit.launch({ headless: true })
      : await chromium.launch({
          channel: process.env.CHROME_CHANNEL || "chrome",
          headless: true,
          args: process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
        });
  let bad = 1;
  try {
    bad = await runSwDeploy(browser, tag);
  } finally {
    await browser.close();
  }
  console.log(bad === 0 ? "\n✓ sw-deploy verde" : `\n✗ ${bad} caso(s) con fallos`);
  process.exit(bad === 0 ? 0 : 1);
}

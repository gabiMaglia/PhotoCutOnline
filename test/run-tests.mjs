// Runner de los smoke tests web en Chrome real (headless).
//
// Usa playwright-core con el Chrome instalado (channel: "chrome") — sin
// descargar navegadores. Levanta Vite, abre cada test/*.html y espera el
// ALL_DONE/ERROR que el test escribe en #out. Sale con código != 0 si algo
// falla: listo para CI.
//
//   npm run test:web

import { spawn } from "node:child_process";
import { chromium, webkit } from "playwright-core";

const PORT = 5187;
const TESTS = [
  "ai-test",
  "sticker-test",
  "canvas-test",
  "engine-test",
  "reencode-test",
  "errorboundary-test",
  "icons-test",
  "i18n-test",
  "imagefile-test",
  "mobile-test",
  "preview-test",
  "worker-test",
  "perf-test",
  "webp-test",
];

// viewport por suite (por defecto escritorio)
const VIEWPORTS = {
  "mobile-test": { width: 390, height: 844 }, // iPhone-ish
};
const DESKTOP = { width: 1280, height: 800 };

// GROW-35: lo que depende del códec corre también en WebKit (el motor de Safari
// no codifica WebP en canvas). Es la corrida que le faltó a GROW-34.
const WEBKIT_TESTS = ["webp-test", "reencode-test"];

// Límite de espera por motor, explícito. WebKit es más lento (autoCut ronda los
// 28 s en un Mac cargado y puede multiplicarse en un runner de 2 vCPU); uno
// único alto taparía cuelgues en Chrome, cuyas suites son rápidas.
const TIMEOUT_MS = { chrome: 120_000, webkit: 240_000 };

// Autoprueba del runner (GROW-35 D-i2-1), solo a pedido: una página que tarda
// 35 s tiene que pasar en los dos motores. No corre por defecto.
const SELFTEST = process.env.RUNNER_SELFTEST === "1";
const SELFTEST_SUITE = ["runner-timeout-test"];
const noCheck = () => [];
const ORIGIN = `http://localhost:${PORT}`;
const ENCODER_WASM = /webp_enc[^/]*\.wasm/;

// Chrome tiene WebP nativo: si pide el encoder, se rompió la detección (y el peso).
const checkChrome = (name, reqs) =>
  name === "webp-test" && reqs.some((u) => ENCODER_WASM.test(u))
    ? [`Chrome pidió el encoder WASM: ${reqs.filter((u) => ENCODER_WASM.test(u)).join(", ")}`]
    : [];

// WebKit: cero requests fuera del origen (privacidad) y, en macOS, la ruta WASM probada de verdad.
const checkWebkit = (name, reqs, txt) => {
  const msgs = [];
  const foreign = reqs.filter((u) => !u.startsWith(ORIGIN) && !/^(blob|data):/.test(u));
  if (foreign.length) msgs.push(`requests fuera del origen: ${foreign.join(", ")}`);
  if (name === "webp-test" && process.platform === "darwin" && !txt.includes("ruta=wasm"))
    msgs.push("en WebKit/macOS se esperaba la ruta WASM (¿la detección dio true?)");
  return msgs;
};

// GROW-35 D2: el encoder no carga (sin red) y después sí. Contexto propio: con el
// service worker activo, ctx.route no ve lo que pide el SW (QA H-03).
const ENCODER_ROUTE = /@jsquash\/webp\/|\/encode-[^/]*\.js|webp_enc/;
async function runRetry(browser) {
  const name = "webp-retry-test";
  process.stdout.write(`\n■ ${name} [webkit]\n`);
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const blocked = [];
  await ctx.route(ENCODER_ROUTE, (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("  [webkit pageerror]", e.message));
  const settled = (re) =>
    page.waitForFunction((src) => new RegExp(src).test(document.getElementById("out")?.textContent || ""), re, {
      timeout: TIMEOUT_MS.webkit,
    });
  let bad = 0;
  try {
    await page.goto(`${ORIGIN}/test/${name}.html`);
    await settled("PHASE1_DONE|ERROR");
    await ctx.unroute(ENCODER_ROUTE);
    await page.evaluate(() => window.__unblock?.());
    await settled("ALL_DONE|ERROR");
  } catch {
    console.error(`  TIMEOUT esperando PHASE1_DONE/ALL_DONE (${TIMEOUT_MS.webkit} ms)`);
    bad++;
  }
  const txt = (await page.textContent("#out")) || "";
  for (const line of txt.trim().split("\n")) console.log(`  ${line}`);
  // si no se bloqueó nada, la fase 1 no probó el camino de error
  if (!blocked.length) console.log("  FAIL: no se bloqueó ningún request del encoder");
  // anclado al inicio de línea: los PASS de la fase 1 citan «WEBP_ENCODE_FAILED»
  if (/^(FAIL|ERROR):/m.test(txt) || !blocked.length) bad++;
  await ctx.close();
  return bad ? 1 : 0;
}

async function runSuite(browser, names, tag, check) {
  let bad = 0;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const reqs = [];
  ctx.on("request", (r) => reqs.push(r.url()));
  page.on("pageerror", (e) => console.error(`  [${tag} pageerror]`, e.message));
  for (const name of names) {
    process.stdout.write(`\n■ ${name}${tag === "chrome" ? "" : ` [${tag}]`}\n`);
    reqs.length = 0;
    await page.setViewportSize(VIEWPORTS[name] || DESKTOP);
    const t0 = Date.now();
    await page.goto(`${ORIGIN}/test/${name}.html`);
    try {
      // la firma es (fn, arg, options): sin el null, {timeout} viajaba como arg y
      // mandaba el default de 30 s de Playwright (GROW-35 D-i2-1)
      await page.waitForFunction(
        () => /ALL_DONE|ERROR/.test(document.getElementById("out")?.textContent || ""),
        null,
        { timeout: TIMEOUT_MS[tag] }
      );
    } catch {
      console.error(`  TIMEOUT esperando ALL_DONE (${TIMEOUT_MS[tag]} ms)`);
      bad++;
      continue;
    }
    const txt = await page.textContent("#out");
    for (const line of txt.trim().split("\n")) console.log(`  ${line}`);
    // la duración queda en el log de CI para ver cuánto margen hay contra el límite
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s de ${TIMEOUT_MS[tag] / 1000} s)`);
    const extra = check(name, reqs, txt);
    for (const m of extra) console.log(`  FAIL: ${m}`);
    if (/FAIL|ERROR/.test(txt) || extra.length) bad++;
  }
  await ctx.close();
  return bad;
}

async function waitForServer(url, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* aún no */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Vite no arrancó");
}

const vite = spawn("npx", ["vite", "dev", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
  detached: false,
});

let failed = 0;
let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch({
    channel: process.env.CHROME_CHANNEL || "chrome",
    headless: true,
    // en CI (contenedores/runners) el sandbox de Chrome suele no estar disponible
    args: process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
  });
  failed += await runSuite(browser, SELFTEST ? SELFTEST_SUITE : TESTS, "chrome", SELFTEST ? noCheck : checkChrome);

  let wk = null;
  try {
    wk = await webkit.launch({ headless: true });
  } catch (e) {
    if (process.env.SKIP_WEBKIT === "1")
      console.warn("\n⚠ WebKit saltado a pedido (SKIP_WEBKIT=1): los casos WebP de Safari NO se probaron");
    else {
      console.error(`\n✗ No arrancó WebKit de Playwright: ${e.message.split("\n")[0]}`);
      console.error("  Instalalo con: npx playwright-core install webkit");
      failed++;
    }
  }
  if (wk) {
    try {
      if (SELFTEST) failed += await runSuite(wk, SELFTEST_SUITE, "webkit", noCheck);
      else {
        failed += await runSuite(wk, WEBKIT_TESTS, "webkit", checkWebkit);
        failed += await runRetry(wk);
      }
    } finally {
      await wk.close();
    }
  }
} finally {
  await browser?.close();
  vite.kill();
}

console.log(failed === 0 ? "\n✓ todo verde" : `\n✗ ${failed} suite(s) con fallos`);
process.exit(failed === 0 ? 0 : 1);

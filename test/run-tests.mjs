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
    await page.goto(`${ORIGIN}/test/${name}.html`);
    try {
      await page.waitForFunction(
        () => /ALL_DONE|ERROR/.test(document.getElementById("out")?.textContent || ""),
        { timeout: 120000 }
      );
    } catch {
      console.error("  TIMEOUT esperando ALL_DONE");
      bad++;
      continue;
    }
    const txt = await page.textContent("#out");
    for (const line of txt.trim().split("\n")) console.log(`  ${line}`);
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
  failed += await runSuite(browser, TESTS, "chrome", checkChrome);

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
      failed += await runSuite(wk, WEBKIT_TESTS, "webkit", checkWebkit);
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

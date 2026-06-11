// Runner de los smoke tests web en Chrome real (headless).
//
// Usa playwright-core con el Chrome instalado (channel: "chrome") — sin
// descargar navegadores. Levanta Vite, abre cada test/*.html y espera el
// ALL_DONE/ERROR que el test escribe en #out. Sale con código != 0 si algo
// falla: listo para CI.
//
//   npm run test:web

import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 5187;
const TESTS = [
  "engine-test",
  "errorboundary-test",
  "icons-test",
  "imagefile-test",
  "mobile-test",
  "preview-test",
  "worker-test",
  "perf-test",
];

// viewport por suite (por defecto escritorio)
const VIEWPORTS = {
  "mobile-test": { width: 390, height: 844 }, // iPhone-ish
};
const DESKTOP = { width: 1280, height: 800 };

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
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("  [pageerror]", e.message));

  for (const name of TESTS) {
    process.stdout.write(`\n■ ${name}\n`);
    await page.setViewportSize(VIEWPORTS[name] || DESKTOP);
    await page.goto(`http://localhost:${PORT}/test/${name}.html`);
    try {
      await page.waitForFunction(
        () => /ALL_DONE|ERROR/.test(document.getElementById("out")?.textContent || ""),
        { timeout: 120000 }
      );
    } catch {
      console.error("  TIMEOUT esperando ALL_DONE");
      failed++;
      continue;
    }
    const txt = await page.textContent("#out");
    for (const line of txt.trim().split("\n")) console.log(`  ${line}`);
    if (/FAIL|ERROR/.test(txt)) failed++;
  }
} finally {
  await browser?.close();
  vite.kill();
}

console.log(failed === 0 ? "\n✓ todo verde" : `\n✗ ${failed} suite(s) con fallos`);
process.exit(failed === 0 ? 0 : 1);

// Ejecuta las pruebas reales de "Lo probamos" (GROW-31) contra el build servido con
// `npx vite preview --port 4399` y escribe los datos crudos en scripts/pruebas.json.
//
//   npm run build && npx vite preview --port 4399 &
//   node scripts/pruebas/run.mjs            # las 20
//   node scripts/pruebas/run.mjs <slug> …   # solo algunas
//
// El campo `caveat` (lo que salió mal / el límite) lo escribe una persona mirando las
// imágenes de salida y se conserva entre corridas; el resto se regenera.
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as L from "./lib.mjs";
import { TESTS as T1 } from "./tests.mjs";
import { TESTS as T2 } from "./tests-b.mjs";
import { TESTS as T3 } from "./tests-c.mjs";
import { TESTS as T4 } from "./tests-d.mjs";
import { TESTS as T5 } from "./tests-e.mjs";
const TESTS = { ...T1, ...T2, ...T4, ...T3, ...T5 };

const JSON_PATH = path.join(L.ROOT, "scripts/pruebas.json");
const only = process.argv.slice(2);
const db = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, "utf8")) : {};

const browser = await L.launch();
const meta = {
  date: new Date().toISOString().slice(0, 10),
  browser: `Chrome ${browser.version()}`,
  os: `macOS ${L.macVersion()}`,
  build: L.commit(),
};

const slugs = Object.keys(TESTS).filter((s) => !only.length || only.includes(s));
for (const slug of slugs) {
  process.stdout.write(`\n■ ${slug}\n`);
  const t0 = Date.now();
  try {
    const r = await TESTS[slug]({ browser, L });
    const prev = db[slug] || {};
    db[slug] = { ...meta, ...r, caveat: prev.caveat ?? null };
    console.log(`  ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    console.log("  " + JSON.stringify(r.result).slice(0, 600));
  } catch (e) {
    console.log("  FALLÓ:", e.message.split("\n")[0]);
    console.log(e.stack.split("\n").slice(1, 4).join("\n"));
  }
  // orden estable (el de TESTS) y guardado incremental
  const ordered = {};
  for (const s of Object.keys(TESTS)) if (db[s]) ordered[s] = db[s];
  writeFileSync(JSON_PATH, JSON.stringify(ordered, null, 2) + "\n");
}
await browser.close();

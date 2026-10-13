import test from "node:test";
import assert from "node:assert/strict";
import { retryVerdict } from "../../test/run-tests.mjs";

// GROW-35 3b: en Linux el WebKit de Playwright codifica WebP nativo y el encoder
// WASM nunca se pide, así que webp-retry-test salta ahí. En macOS no puede saltar:
// es el único lugar donde se prueba de verdad el reintento del encoder.
const SKIP = "SKIP: ruta=nativa — el reintento del encoder WASM no se ejercita en este motor (deuda GROW-35)\nALL_DONE";
const MAC_OK = [
  "ruta=wasm",
  "PASS: editor sin encoder: error WebP (WEBP_ENCODE_FAILED: load: Importing a module script failed.)",
  "PASS: archivo sin encoder: error WebP (WEBP_ENCODE_FAILED: load: Importing a module script failed.)",
  "PHASE1_DONE",
  "PASS: editor, reintento con red: WebP real (image/webp)",
  "PASS: archivo, reintento con red: WebP real (image/webp)",
  "ALL_DONE",
].join("\n");

test("SKIP por ruta nativa en macOS es un fallo", () => {
  assert.ok(retryVerdict(SKIP, 0, "darwin").length > 0);
});

test("SKIP por ruta nativa fuera de macOS pasa, aunque no se haya bloqueado nada", () => {
  assert.deepEqual(retryVerdict(SKIP, 0, "linux"), []);
});

test("sin SKIP y sin requests bloqueados falla en cualquier plataforma", () => {
  assert.ok(retryVerdict("ruta=wasm\nALL_DONE", 0, "linux").length > 0);
  assert.ok(retryVerdict("ruta=wasm\nALL_DONE", 0, "darwin").length > 0);
});

test("una línea FAIL: o ERROR: es fallo, también junto a un SKIP fuera de macOS", () => {
  assert.ok(retryVerdict(`${MAC_OK}\nFAIL: algo`, 2, "darwin").length > 0);
  assert.ok(retryVerdict(`ERROR: boom\n${SKIP}`, 0, "linux").length > 0);
});

test("la salida real de macOS (fases completas, con bloqueados) pasa", () => {
  assert.deepEqual(retryVerdict(MAC_OK, 2, "darwin"), []);
});

test("sin ALL_DONE no pasa (la página no terminó)", () => {
  assert.ok(retryVerdict("ruta=wasm\nPHASE1_DONE", 2, "darwin").length > 0);
});

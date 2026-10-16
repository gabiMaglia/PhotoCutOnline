// Parte un modelo .onnx en trozos para que entre en git (GitHub rechaza > 100 MB)
// y deja en src/lib/modelParts.json lo que el worker necesita para rearmarlo:
// URL y bytes de cada parte, y el sha256 del total (GROW-36).
//
//   node scripts/split-model.mjs <modelo.onnx> [--name birefnet-lite-1024-fp16] [--key birefnet] [--parts 2]
//
// El nombre lleva la versión: el service worker cachea /models/* por nombre, así
// que un modelo distinto necesita un nombre distinto.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MODELS_DIR = path.join(ROOT, "public/models");
export const PARTS_JSON = path.join(ROOT, "src/lib/modelParts.json");
export const MAX_PART_BYTES = 60_000_000;

/** Corta `buf` en `n` trozos contiguos de tamaño casi igual (el último absorbe el resto). */
export function splitBuffer(buf, n) {
  const size = Math.ceil(buf.length / n);
  const out = [];
  for (let i = 0; i < n; i++) out.push(buf.subarray(i * size, Math.min(buf.length, (i + 1) * size)));
  return out;
}

export const partUrl = (name, i) => `/models/${name}.onnx.part${i}`;

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function main(argv) {
  const [src, ...rest] = argv;
  if (!src) throw new Error("uso: node scripts/split-model.mjs <modelo.onnx> [--name x] [--key y] [--parts n]");
  const opt = (k, d) => {
    const i = rest.indexOf(`--${k}`);
    return i >= 0 ? rest[i + 1] : d;
  };
  const name = opt("name", "birefnet-lite-1024-fp16");
  const key = opt("key", "birefnet");
  const buf = readFileSync(src);
  const n = Number(opt("parts", Math.ceil(buf.length / MAX_PART_BYTES)));
  const parts = splitBuffer(buf, n);
  if (parts.some((p) => p.length >= MAX_PART_BYTES)) throw new Error(`alguna parte supera ${MAX_PART_BYTES} bytes: usá más --parts`);

  // borrar partes viejas del mismo nombre (si antes eran más)
  for (const f of readdirSync(MODELS_DIR)) if (f.startsWith(`${name}.onnx.part`)) unlinkSync(path.join(MODELS_DIR, f));
  parts.forEach((p, i) => writeFileSync(path.join(MODELS_DIR, path.basename(partUrl(name, i))), p));

  let json = {};
  try {
    json = JSON.parse(readFileSync(PARTS_JSON, "utf8"));
  } catch {
    /* primera vez */
  }
  json[key] = {
    bytes: buf.length,
    sha256: sha256(buf),
    parts: parts.map((p, i) => ({ url: partUrl(name, i), bytes: p.length })),
  };
  writeFileSync(PARTS_JSON, JSON.stringify(json, null, 2) + "\n");
  console.log(`${key}: ${buf.length} bytes en ${n} partes → ${PARTS_JSON}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

// Genera src/generated/licenses.json con las dependencias de producción
// (npm + crates de photocut-core) para la pantalla "Acerca de / Licencias".
//
//   npm run licenses    (correr tras cambiar dependencias y commitear el JSON)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const entries = [];

for (const name of Object.keys(pkg.dependencies || {})) {
  try {
    const dep = JSON.parse(
      readFileSync(join(root, "node_modules", name, "package.json"), "utf8")
    );
    entries.push({
      name,
      version: dep.version,
      license: dep.license || "ver repositorio",
      source: "npm",
    });
  } catch {
    entries.push({ name, version: "?", license: "ver repositorio", source: "npm" });
  }
}

// Lo que viaja DENTRO del bundle sin figurar en package.json (GROW-35): la
// dependencia transitiva de @jsquash/webp y libwebp, compilada en su .wasm.
// El aviso BSD de libwebp se publica completo en /licenses/.
const depVersion = (name) => {
  try {
    return JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version;
  } catch {
    return "?";
  }
};
entries.push(
  { name: "wasm-feature-detect", version: depVersion("wasm-feature-detect"), license: "Apache-2.0", source: "npm" },
  {
    name: "libwebp (en @jsquash/webp)",
    version: "1.1.0",
    license: "BSD-3-Clause (texto: /licenses/libwebp-COPYING.txt)",
    source: "embebido",
  }
);

// Modelos de IA servidos desde /models/ (GROW-36). No son paquetes: van a mano.
// Atribución completa y salvedades en /licenses/ai-models-NOTICE.txt.
entries.push(
  {
    name: "BiRefNet-lite 1024 fp16 (ZhengPeng7/BiRefNet; export jiabins0303)",
    version: "birefnet-lite-1024-fp16.onnx",
    license: "MIT (aviso: /licenses/ai-models-NOTICE.txt)",
    source: "modelo",
  },
  {
    name: "U^2-Net u2netp (xuebinqin)",
    version: "u2netp.onnx",
    license: "Apache-2.0 (aviso: /licenses/ai-models-NOTICE.txt)",
    source: "modelo",
  }
);

// Crates del motor Rust (escritorio). Licencias declaradas en
// crates/photocut-core/Cargo.toml; verificar con `cargo deny` / `cargo about`.
const cargo = readFileSync(join(root, "crates/photocut-core/Cargo.toml"), "utf8");
const RUST_LICENSES = {
  image: "MIT OR Apache-2.0",
  nalgebra: "Apache-2.0",
  thiserror: "MIT OR Apache-2.0",
};
const depsBlock = cargo.split("[dependencies]")[1]?.split("[dev-dependencies]")[0] || "";
for (const line of depsBlock.split("\n")) {
  const m = line.match(/^([a-z0-9_-]+)\s*=/);
  if (m) {
    entries.push({
      name: m[1],
      version: (line.match(/version\s*=\s*"([^"]+)"|=\s*"([^"]+)"/) || [])
        .slice(1)
        .find(Boolean) || "?",
      license: RUST_LICENSES[m[1]] || "ver crates.io",
      source: "crates.io",
    });
  }
}

entries.sort((a, b) => a.name.localeCompare(b.name));

const outDir = join(root, "src/generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "licenses.json"),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), entries }, null, 2)
);
console.log(`licenses.json: ${entries.length} dependencias`);

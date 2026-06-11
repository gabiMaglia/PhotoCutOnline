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

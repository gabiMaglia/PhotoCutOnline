import fs from "node:fs";
import { execFileSync } from "node:child_process";

// Fecha (ISO UTC) de la última modificación REAL de un archivo fuente:
// el último commit que lo tocó; sin git o sin historial, el mtime.
//
// - Los commits con "[lastmod-skip]" en el mensaje se ignoran: son cambios
//   mecánicos masivos (footers, favicons...) que no son contenido nuevo y
//   volverían a poner la misma fecha en las 133 URLs.
// - En un clone superficial (Vercel) git devuelve el último commit DISPONIBLE;
//   con --depth=1 todas las fechas colapsan a esa; es un límite aceptado.
export function lastModified(file, cwd = process.cwd()) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--invert-grep", "--grep=\\[lastmod-skip\\]", "--", file],
      { cwd, stdio: ["ignore", "pipe", "ignore"] }
    )
      .toString()
      .trim();
    if (out) return new Date(out).toISOString();
  } catch {
    // git ausente o no es un repo: caemos al mtime
  }
  return fs.statSync(file).mtime.toISOString();
}

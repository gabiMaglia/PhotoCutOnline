// Garantiza un dist/ con sitemap (build con VITE_SITE_URL) para los tests que
// inspeccionan el build. `node --test` corre los archivos en paralelo: un lock
// por directorio evita que dos tests construyan a la vez sobre el mismo dist/.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SITE = "https://www.photocutapp.com";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function ensureDist(root) {
  const dist = path.join(root, "dist");
  const ready = () =>
    fs.existsSync(path.join(dist, "index.html")) && fs.existsSync(path.join(dist, "sitemap.xml"));
  if (ready()) return dist;

  const lock = path.join(root, "dist.lock");
  const deadline = Date.now() + 5 * 60 * 1000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      // Mientras otro proceso tiene el lock, el build puede haber escrito ya
      // sitemap.xml pero seguir inyectando og/hreflang en las estáticas: no
      // vale `ready()` hasta que el lock desaparezca (carrera vista en CI).
      // lock huérfano (proceso muerto): más de 10 min => se descarta
      if (Date.now() - fs.statSync(lock).mtimeMs > 10 * 60 * 1000) fs.rmSync(lock, { recursive: true, force: true });
      if (Date.now() > deadline) throw new Error("timeout esperando el build de dist/");
      sleep(500);
    }
  }
  try {
    if (!ready()) {
      execFileSync("npx", ["vite", "build"], {
        cwd: root,
        stdio: "ignore",
        env: { ...process.env, VITE_SITE_URL: process.env.VITE_SITE_URL || SITE },
      });
    }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
  return dist;
}

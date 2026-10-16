// Servidor estático que imita a Vercel para la suite del service worker (BUG-08).
//
// Sirve uno de varios «deploys» (directorios de build) en el MISMO origen y se
// cambia de deploy en caliente, como pasa en producción. Lo importante es que,
// igual que Vercel, un /assets/ que no existe en el deploy activo devuelve
// 404 text/html: es exactamente lo que rompía el worker viejo.
//
// Controles en `state`: deploy (clave de `roots`), down (corta el socket: lo que
// ve el SW sin red), htmlDelay (ms, solo HTML: red lenta), missing (regex de
// rutas a responder 404 aunque existan), swOverride (texto servido como /sw.js:
// para simular el SW de una versión anterior). `log` registra cada request con su
// estado: es la fuente de verdad de «qué se pidió a la red» en ambos motores
// (Playwright solo reporta las requests del SW en Chromium).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

// mismos Cache-Control que vercel.json
function cacheControl(p) {
  if (p.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (p.startsWith("/models/")) return "public, max-age=604800";
  return "public, max-age=0, must-revalidate";
}

export function createDeployServer({ roots, port }) {
  const state = { deploy: Object.keys(roots)[0], down: false, htmlDelay: 0, missing: null, swOverride: null, log: [] };

  const server = http.createServer(async (req, res) => {
    if (state.down) return req.socket.destroy();
    const url = new URL(req.url, "http://localhost");
    let p = decodeURIComponent(url.pathname);
    const deploy = state.deploy;
    const root = roots[deploy];
    const entry = { path: url.pathname, deploy, status: 0 };
    state.log.push(entry);

    if (p === "/editor") p = "/editor/"; // rewrite de vercel.json
    if (p.endsWith("/")) p += "index.html";
    if (p.endsWith(".html") && state.htmlDelay) await new Promise((r) => setTimeout(r, state.htmlDelay));
    if (state.down) {
      entry.status = -1;
      return req.socket.destroy();
    }

    if (p === "/sw.js" && state.swOverride) {
      entry.status = 200;
      res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": cacheControl(p) });
      return res.end(state.swOverride);
    }
    const file = path.join(root, p);
    const inside = file.startsWith(root + path.sep);
    const exists = inside && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists || state.missing?.test(p)) {
      entry.status = 404;
      res.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0" });
      return res.end("<!doctype html><title>404</title><h1>404</h1>");
    }
    entry.status = 200;
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": cacheControl(url.pathname),
    });
    fs.createReadStream(file).pipe(res);
  });

  return {
    state,
    reset() {
      Object.assign(state, { down: false, htmlDelay: 0, missing: null, swOverride: null });
    },
    listen: () => new Promise((resolve) => server.listen(port, resolve)),
    close() {
      server.closeAllConnections?.();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

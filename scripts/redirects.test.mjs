import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDist } from "./lib/ensure-dist.mjs";

// GROW-30: una URL con 301 no puede seguir viva en el build, ni en el sitemap,
// ni enlazada desde ninguna página (si no, Google la sigue viendo como válida
// o el usuario pasa por una redirección evitable). Además, crawl interno:
// ningún enlace/recurso local de dist/ apunta a un archivo inexistente.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = ensureDist(root);
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const redirects = vercel.redirects || [];
const rewrites = new Map((vercel.rewrites || []).map((r) => [r.source, r.destination]));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const pages = walk(dist).map((p) => ({
  rel: path.relative(dist, p).split(path.sep).join("/"),
  html: fs.readFileSync(p, "utf8"),
}));
// Enlaces reales: se ignoran <script> y <pre> (ejemplos de código que muestran href="/favicon-32.png")
const sinCodigo = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<pre[\s\S]*?<\/pre>/g, "");
const sitemap = fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

// Ruta pública -> archivo en dist/ (misma lógica que sirve Vercel para estáticos)
function resolveLocal(urlPath) {
  let p = urlPath.split("#")[0].split("?")[0];
  if (rewrites.has(p)) p = rewrites.get(p);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(dist, decodeURIComponent(p));
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

test("hay redirecciones permanentes declaradas en vercel.json", () => {
  assert.ok(redirects.length >= 18, `solo ${redirects.length} redirects`);
  for (const r of redirects) assert.equal(r.permanent, true, r.source);
});

test("cada destino de un redirect existe en dist/ y está en el sitemap", () => {
  for (const r of redirects) {
    assert.ok(resolveLocal(r.destination), `destino inexistente: ${r.destination}`);
    assert.ok(locs.includes(r.destination), `destino fuera del sitemap: ${r.destination}`);
  }
});

test("ninguna URL redirigida sigue existiendo como archivo en dist/", () => {
  const vivas = redirects.filter((r) => resolveLocal(r.source)).map((r) => r.source);
  assert.deepEqual(vivas, []);
});

test("ninguna URL redirigida está en el sitemap", () => {
  const enSitemap = redirects.filter((r) => locs.includes(r.source)).map((r) => r.source);
  assert.deepEqual(enSitemap, []);
});

test("ninguna página de dist/ enlaza (href) a una URL redirigida", () => {
  const sources = new Set(redirects.map((r) => r.source));
  const malos = [];
  for (const { rel, html } of pages) {
    for (const m of sinCodigo(html).matchAll(/href="([^"]+)"/g)) {
      let h = m[1];
      if (/^https?:\/\//.test(h)) {
        try {
          const u = new URL(h);
          if (!/(^|\.)photocutapp\.com$/.test(u.hostname)) continue;
          h = u.pathname;
        } catch {
          continue;
        }
      }
      if (sources.has(h.split("#")[0].split("?")[0])) malos.push(`${rel} -> ${h}`);
    }
  }
  assert.deepEqual(malos, []);
});

test("crawl interno: 0 enlaces y recursos locales rotos", () => {
  const rotos = [];
  for (const { rel, html } of pages) {
    for (const m of sinCodigo(html).matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const v = m[1];
      if (!v.startsWith("/") || v.startsWith("//")) continue; // externos, mailto:, #, relativos al documento
      if (!resolveLocal(v)) rotos.push(`${rel} -> ${v}`);
    }
  }
  assert.deepEqual(rotos, []);
});

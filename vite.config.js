import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Páginas que deben indexarse (sitemap + canonical).
const SEO_ROUTES = [
  "/",
  "/guias/",
  "/guias/como-quitar-el-fondo-de-una-imagen.html",
  "/guias/medidas-de-iconos-de-app-ios-android-2026.html",
  "/guias/favicons-medidas-y-html.html",
  "/guias/fotos-de-producto-amazon-etsy-shopify.html",
  "/guias/foto-de-perfil-redonda.html",
  "/legal/privacidad.html",
  "/legal/terminos.html",
];

// Tauri expects a fixed port and serves from ../dist
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const site = (env.VITE_SITE_URL || "").replace(/\/$/, "");

  return {
    plugins: [react(), absoluteOgTags(site), seoArtifacts(site)],
    clearScreen: false,
    worker: {
      // el worker de recorte hace import() dinámico (onnxruntime-web):
      // requiere workers en formato ES (soportado por toda nuestra matriz)
      format: "es",
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      target: "es2021",
      sourcemap: false,
    },
  };
});

// Con VITE_SITE_URL definida, convierte el og:image/twitter:image a absolutos e
// inyecta og:url + canonical (las previsualizaciones de redes y el SEO los
// necesitan absolutos). Sin la variable, deja las rutas relativas tal cual.
function absoluteOgTags(site) {
  return {
    name: "absolute-og-tags",
    transformIndexHtml(html) {
      if (!site) return html;
      return html
        .replaceAll('content="/og.png"', `content="${site}/og.png"`)
        .replace(
          '<meta property="og:type" content="website" />',
          `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${site}/" />\n    <link rel="canonical" href="${site}/" />`
        );
    },
  };
}

// Post-build: con VITE_SITE_URL genera sitemap.xml, agrega la línea Sitemap en
// robots.txt e inyecta canonical/og:url en las páginas estáticas (guías y
// legales) — lo que Google necesita para indexarlas. Sin la variable, no hace
// nada (las URLs deben ser absolutas).
function seoArtifacts(site) {
  return {
    name: "seo-artifacts",
    apply: "build",
    closeBundle() {
      if (!site) return;
      const dist = path.resolve("dist");
      if (!fs.existsSync(dist)) return;
      const today = new Date().toISOString().slice(0, 10);

      const urls = SEO_ROUTES.map(
        (r) => `  <url><loc>${site}${r}</loc><lastmod>${today}</lastmod></url>`
      ).join("\n");
      fs.writeFileSync(
        path.join(dist, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      );

      fs.writeFileSync(
        path.join(dist, "robots.txt"),
        `# PhotoCut Studio\nUser-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`
      );

      // canonical + og:url en cada página estática (index lo hace absoluteOgTags)
      for (const r of SEO_ROUTES) {
        if (r === "/") continue;
        const file = r.endsWith("/") ? path.join(dist, r, "index.html") : path.join(dist, r);
        if (!fs.existsSync(file)) continue;
        let html = fs.readFileSync(file, "utf8");
        if (html.includes('rel="canonical"')) continue;
        const url = `${site}${r}`;
        html = html.replace(
          "</head>",
          `  <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n  </head>`
        );
        fs.writeFileSync(file, html);
      }
    },
  };
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Páginas que deben indexarse (sitemap + canonical).
const SEO_ROUTES = [
  "/",
  "/herramientas/",
  "/herramientas/paleta-de-colores.html",
  "/guias/",
  "/guias/como-quitar-el-fondo-de-una-imagen.html",
  "/guias/medidas-de-iconos-de-app-ios-android-2026.html",
  "/guias/favicons-medidas-y-html.html",
  "/guias/fotos-de-producto-amazon-etsy-shopify.html",
  "/guias/foto-de-perfil-redonda.html",
  "/guias/como-quitar-fondo-gratis.html",
  "/guias/convertir-png-a-ico.html",
  "/guias/sticker-de-whatsapp.html",
  "/guias/foto-carnet-fondo-blanco.html",
  "/guias/cambiar-el-fondo-de-una-foto.html",
  "/guias/fondo-blanco-para-mercadolibre.html",
  "/guias/quitar-fondo-a-una-firma.html",
  "/guias/logo-con-fondo-transparente.html",
  "/guias/foto-de-perfil-para-linkedin.html",
  "/guias/recortar-una-persona-de-una-foto.html",
  "/guias/quitar-el-fondo-de-una-foto-en-el-celular.html",
  "/guias/medidas-de-fotos-para-redes-sociales-2026.html",
  "/guias/png-jpg-o-webp-cual-elegir.html",
  "/guias/sticker-de-telegram.html",
  "/guias/poner-fondo-blanco-a-una-foto.html",
  "/acerca.html",
  "/contacto.html",
  "/legal/privacidad.html",
  "/legal/terminos.html",
];

// Tauri expects a fixed port and serves from ../dist
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const site = (env.VITE_SITE_URL || "").replace(/\/$/, "");

  return {
    plugins: [react(), absoluteOgTags(site), seoArtifacts(site, env), umamiTag(env)],
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
      rollupOptions: {
        // MPA (T-011): "/" es la landing estática, "/editor" es la app React.
        input: {
          main: path.resolve(__dirname, "index.html"),
          editor: path.resolve(__dirname, "editor/index.html"),
        },
      },
    },
  };
});

// Analytics Umami (cookieless, sin banner de consentimiento): inyecta el script
// en el <head> de AMBAS páginas (landing index.html + editor/index.html) cuando
// están definidas VITE_UMAMI_SRC (URL del script.js de tu instancia) y
// VITE_UMAMI_WEBSITE_ID (el UUID del sitio en Umami). Sin ellas, no carga nada.
function umamiScript(env) {
  const src = (env.VITE_UMAMI_SRC || "").trim();
  const id = (env.VITE_UMAMI_WEBSITE_ID || "").trim();
  return src && id ? `<script defer src="${src}" data-website-id="${id}"></script>` : "";
}

// Inyecta Umami en las páginas Vite (landing index.html + editor/index.html).
// Las estáticas (guías/legales) las cubre seoArtifacts en closeBundle.
function umamiTag(env) {
  const tag = umamiScript(env);
  return {
    name: "umami-tag",
    transformIndexHtml(html) {
      return tag ? html.replace("</head>", `    ${tag}\n  </head>`) : html;
    },
  };
}

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
function seoArtifacts(site, env = {}) {
  const umami = umamiScript(env);
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

      // canonical/og:url + Umami en cada página estática (index/editor los hacen
      // absoluteOgTags/umamiTag). canonical y umami son independientes, con guard
      // anti-doble por si la página ya los trae.
      for (const r of SEO_ROUTES) {
        if (r === "/") continue;
        const file = r.endsWith("/") ? path.join(dist, r, "index.html") : path.join(dist, r);
        if (!fs.existsSync(file)) continue;
        let html = fs.readFileSync(file, "utf8");
        let changed = false;
        if (!html.includes('rel="canonical"')) {
          const url = `${site}${r}`;
          html = html.replace(
            "</head>",
            `  <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n  </head>`
          );
          changed = true;
        }
        if (umami && !html.includes("data-website-id")) {
          html = html.replace("</head>", `    ${umami}\n  </head>`);
          changed = true;
        }
        if (changed) fs.writeFileSync(file, html);
      }
    },
  };
}

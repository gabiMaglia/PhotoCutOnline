import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and serves from ../dist
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const site = (env.VITE_SITE_URL || "").replace(/\/$/, "");

  return {
    plugins: [react(), absoluteOgTags(site)],
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

// Manifiesto del service worker por build (BUG-08).
//
// El navegador solo instala un SW nuevo si cambian sus bytes. Antes, sw.js era
// idéntico en cada deploy: su install corría una vez en la vida del visitante y
// la caché acumulaba hashes para siempre. Ahora el build le inyecta un BUILD_ID
// y la lista de URLs del deploy, así cada deploy trae un SW nuevo que precachea
// un conjunto coherente y poda lo que ya no existe.

import { createHash } from "node:crypto";

const SHELL_ASSET = /\.(?:js|css|mjs)$/;
// solo del camino GPU (GROW-36): se baja bajo demanda, no en el install de todos
const GPU_ONLY = /\/ort\.webgpu\.|\.asyncify[-.]/;
const HTML_ROUTES = ["/", "/editor/"];
const START = "/*__PHOTOCUT_BUILD__*/";
const END = "/*__PHOTOCUT_BUILD_END__*/";

/**
 * assets: nombres de archivo de /assets/; models: de /models/; html: { "/": src, "/editor/": src }.
 * shell = lo que el install precachea (todo o nada); keep = lo que la poda conserva.
 */
export function buildSwManifest({ assets, models, html }) {
  const assetUrls = [...assets].sort().map((f) => `/assets/${f}`);
  const shell = [...HTML_ROUTES, ...assetUrls.filter((u) => SHELL_ASSET.test(u) && !GPU_ONLY.test(u))];
  const keep = [...assetUrls, ...[...models].sort().map((f) => `/models/${f}`)];
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ shell, keep }));
  for (const route of HTML_ROUTES) hash.update(html[route] ?? "");
  return { id: hash.digest("hex").slice(0, 12), shell, keep };
}

/** Reemplaza el bloque centinela de sw.js. Tira si no está: un SW sin versionar no debe salir. */
export function injectSwBuild(swSource, build) {
  const a = swSource.indexOf(START);
  const b = swSource.indexOf(END);
  if (a < 0 || b < a) throw new Error("sw.js: no se encontró el centinela /*__PHOTOCUT_BUILD__*/");
  return swSource.slice(0, a + START.length) + ` ${JSON.stringify(build)} ` + swSource.slice(b);
}

/** Deja el BUILD_ID visible en el HTML (diagnóstico y tests: qué deploy se sirvió). */
export function injectBuildMeta(html, id) {
  const tag = `<meta name="photocut-build" content="${id}" />`;
  if (html.includes(tag)) return html;
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

// IndexNow — avisa a Bing (y por extensión a Copilot, Yandex, etc.) qué URLs
// publicar/re-rastrear. Google NO usa IndexNow, pero Bing alimenta a Copilot y
// a varios asistentes, así que acelera el descubrimiento fuera de Google.
//
// Cómo funciona el protocolo: se hostea un archivo <KEY>.txt en la raíz del
// dominio (ya está en public/) cuyo contenido es la propia KEY; IndexNow lo
// verifica antes de aceptar el envío. Después se hace UN POST con la lista de
// URLs.
//
// Uso:  node scripts/indexnow.mjs
// Requisitos: el archivo <KEY>.txt tiene que estar YA DESPLEGADO en el dominio
// (deploy primero, después correr esto). Lee las URLs del sitemap en vivo, así
// siempre envía exactamente lo que está indexable.

const HOST = "www.photocutapp.com";
const KEY = "b94f19930d557c5ad88a59a8407ede67";
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function main() {
  // 1. verificar que la key esté publicada (si no, IndexNow rechaza todo)
  const keyUrl = `https://${HOST}/${KEY}.txt`;
  const keyRes = await fetch(keyUrl);
  if (!keyRes.ok) {
    console.error(`✗ La key no está accesible en ${keyUrl} (HTTP ${keyRes.status}).`);
    console.error("  Desplegá el sitio primero: el archivo vive en public/ y se publica con el build.");
    process.exit(1);
  }
  const keyBody = (await keyRes.text()).trim();
  if (keyBody !== KEY) {
    console.error(`✗ ${keyUrl} no contiene la key esperada.`);
    process.exit(1);
  }

  // 2. leer las URLs del sitemap en vivo
  const smRes = await fetch(SITEMAP);
  if (!smRes.ok) {
    console.error(`✗ No se pudo leer el sitemap (${SITEMAP}, HTTP ${smRes.status}).`);
    process.exit(1);
  }
  const xml = await smRes.text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urlList.length) {
    console.error("✗ El sitemap no tiene URLs.");
    process.exit(1);
  }

  // 3. enviar (IndexNow acepta hasta 10.000 URLs por POST)
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: keyUrl, urlList }),
  });
  // 200 y 202 = aceptado; el cuerpo suele venir vacío
  if (res.status === 200 || res.status === 202) {
    console.log(`✓ ${urlList.length} URLs enviadas a IndexNow (HTTP ${res.status}).`);
  } else {
    console.error(`✗ IndexNow respondió HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});

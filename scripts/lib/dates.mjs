// Fechas de las guías, inyectadas en build (no a mano en 60 archivos) para que
// dateModified se mantenga solo a partir del manifiesto lastmod.

const MONTHS = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
};

// "Actualizado el 6 de octubre de 2026" / "Updated on October 6, 2026" / "Atualizado em 6 de outubro de 2026"
const LABEL = { es: "Actualizado el", en: "Updated on", pt: "Atualizado em" };

// Tabla fija en vez de Intl: la salida no depende del ICU de la máquina de build.
export function longDate(iso, lang) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const month = MONTHS[lang][d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return lang === "en" ? `${month} ${day}, ${year}` : `${day} de ${month} de ${year}`;
}

const LDJSON = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;

// Marcador estable en el byline de cada guía: <span data-updated>…</span>
const MARKER = /<span data-updated>[\s\S]*?<\/span>/;

export function injectGuideDates(html, { published, modified, lang }) {
  const pub = new Date(published) > new Date(modified) ? modified : published;
  let out = html.replace(LDJSON, (whole, open, body, close) => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return whole;
    }
    if (data["@type"] !== "Article") return whole;
    const next = { ...data, datePublished: pub, dateModified: modified };
    return `${open}\n${JSON.stringify(next, null, 2)}\n    ${close}`;
  });
  if (MARKER.test(out)) {
    const day = modified.slice(0, 10);
    out = out.replace(MARKER, `${LABEL[lang]} <time datetime="${day}">${longDate(modified, lang)}</time>`);
  }
  return out;
}

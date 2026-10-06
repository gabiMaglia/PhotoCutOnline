// Mide cuánto de una guía es FAQ y cuánto de la FAQ repite el cuerpo (5-gramas de palabras).
//
//   node scripts/faq-overlap.mjs                 # tabla de las guías ES
//   node scripts/faq-overlap.mjs --questions     # además, por pregunta
//
// Métricas por página:
//   faq%     palabras de la FAQ / palabras de la página
//   dup%     5-gramas de la FAQ que también están en el cuerpo / 5-gramas de la FAQ
//   shared%  5-gramas únicos compartidos FAQ↔cuerpo / 5-gramas únicos de la página (objetivo ≤ 10 %)
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public/guias");

const strip = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z#0-9]+;/g, " ");
const words = (t) => t.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const grams = (w, n = 5) => {
  const out = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(" "));
  return out;
};

// separa la página en cuerpo / FAQ (sin el bloque "Lo probamos" ni los enlaces relacionados)
export function split(html) {
  const start = html.indexOf("<h1>");
  const end = html.indexOf('<section aria-labelledby="related');
  let main = html.slice(start, end > 0 ? end : undefined);
  main = main.replace(/<!-- pruebas:start -->[\s\S]*?<!-- pruebas:end -->/, "").replace(/<div class="tried">[\s\S]*?<\/div>/, "");
  const fi = main.search(/<h2[^>]*>\s*Preguntas frecuentes\s*<\/h2>/);
  if (fi < 0) return { body: main, faq: "", questions: [] };
  let faq = main.slice(fi);
  const cta = faq.search(/<a class="cta"/);
  if (cta > 0) faq = faq.slice(0, cta);
  const body = main.slice(0, fi) + (cta > 0 ? main.slice(fi).slice(cta) : "");
  const questions = [...faq.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => ({
    q: strip(m[1]).replace(/\s+/g, " ").trim(),
    a: strip(m[2]).replace(/\s+/g, " ").trim(),
  }));
  return { body, faq, questions };
}

export function measure(html) {
  const { body, faq, questions } = split(html);
  const bw = words(strip(body)), fw = words(strip(faq));
  const bg = new Set(grams(bw)), fg = grams(fw);
  const fgSet = new Set(fg);
  const shared = [...fgSet].filter((g) => bg.has(g));
  const pageGrams = new Set([...bg, ...fgSet]);
  const perQ = questions.map((x) => {
    const g = grams(words(x.q + " " + x.a));
    const dup = g.length ? g.filter((k) => bg.has(k)).length / g.length : 0;
    return { ...x, words: words(x.a).length, dupPct: +(100 * dup).toFixed(1) };
  });
  return {
    pageWords: bw.length + fw.length,
    faqWords: fw.length,
    faqPct: +((100 * fw.length) / (bw.length + fw.length || 1)).toFixed(1),
    dupPct: fg.length ? +((100 * fg.filter((g) => bg.has(g)).length) / fg.length).toFixed(1) : 0,
    sharedPct: +((100 * shared.length) / (pageGrams.size || 1)).toFixed(1),
    questions: perQ,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const showQ = process.argv.includes("--questions");
  console.log("slug".padEnd(48), "palabras", "faq%", "dup%", "shared%", "preguntas");
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".html") && x !== "index.html").sort()) {
    const m = measure(readFileSync(path.join(DIR, f), "utf8"));
    console.log(f.replace(".html", "").padEnd(48), String(m.pageWords).padStart(8), String(m.faqPct).padStart(5), String(m.dupPct).padStart(5), String(m.sharedPct).padStart(7), String(m.questions.length).padStart(9));
    if (showQ) for (const q of m.questions) console.log("     ", String(q.dupPct).padStart(5) + "%", String(q.words).padStart(3) + "w", q.q);
  }
}

// Quita preguntas de la FAQ de una guía y deja el FAQPage JSON-LD sincronizado.
//
//   node scripts/faq-prune.mjs <slug> all            # saca toda la FAQ (sección + JSON-LD)
//   node scripts/faq-prune.mjs <slug> 1,3            # saca las preguntas 1 y 3 (base 1, como en faq-overlap)
//   node scripts/faq-prune.mjs <slug> keep:2         # deja solo la 2
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const norm = (s) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const H2_RE = /<h2[^>]*>\s*Preguntas frecuentes\s*<\/h2>/;
const LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g;

// Devuelve { start, end, items:[{index, qNorm, from, to}] } de la FAQ visible.
export function faqRegion(html) {
  const m = H2_RE.exec(html);
  if (!m) return null;
  const from = m.index + m[0].length;
  const rest = html.slice(from);
  const stops = [rest.search(/<!-- pruebas:start -->/), rest.search(/<div class="tried">/), rest.search(/<a class="cta"/), rest.search(/<section aria-labelledby="related/)].filter((i) => i >= 0);
  const to = from + Math.min(...stops, rest.length);
  const items = [];
  const re = /\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  const seg = html.slice(from, to);
  let x;
  while ((x = re.exec(seg))) items.push({ index: items.length + 1, qNorm: norm(x[1]), from: from + x.index, to: from + x.index + x[0].length });
  return { h2: { from: m.index, to: from }, start: from, end: to, items };
}

export function pruneFaq(html, spec) {
  const reg = faqRegion(html);
  if (!reg) throw new Error("no hay FAQ");
  const n = reg.items.length;
  let drop;
  if (spec === "all") drop = reg.items.map((i) => i.index);
  else if (spec.startsWith("keep:")) { const k = spec.slice(5).split(",").map(Number); drop = reg.items.map((i) => i.index).filter((i) => !k.includes(i)); }
  else drop = spec.split(",").map(Number);
  const dropped = reg.items.filter((i) => drop.includes(i.index));
  let out = html;
  // de atrás para adelante para no mover los índices
  for (const it of [...dropped].reverse()) out = out.slice(0, it.from) + out.slice(it.to);
  if (dropped.length === n) {
    const r2 = H2_RE.exec(out);
    out = out.slice(0, r2.index).replace(/[ \t]*$/, "") + out.slice(r2.index + r2[0].length).replace(/^\s*\n/, "\n");
  }
  const gone = new Set(dropped.map((i) => i.qNorm));
  out = out.replace(LD_RE, (all, body) => {
    let j;
    try { j = JSON.parse(body); } catch { return all; }
    if (j["@type"] !== "FAQPage") return all;
    j.mainEntity = j.mainEntity.filter((q) => !gone.has(norm(q.name)));
    if (!j.mainEntity.length) return "";
    const ser = JSON.stringify(j, null, 2).split("\n").map((l, i) => (i ? "    " + l : l)).join("\n");
    return `<script type="application/ld+json">\n    ${ser}\n    </script>\n    `;
  });
  return { html: out, dropped: dropped.map((i) => i.qNorm), kept: n - dropped.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [slug, spec] = process.argv.slice(2);
  const f = path.join(ROOT, "public/guias", `${slug}.html`);
  const r = pruneFaq(readFileSync(f, "utf8"), spec);
  writeFileSync(f, r.html);
  console.log(`${slug}: quité ${r.dropped.length}, quedan ${r.kept}`);
  for (const q of r.dropped) console.log("   -", q);
}

// BUG-12: editor mobile (390×844) respirable. Mide los criterios numéricos del
// ticket sobre la App REAL: sin foto solo el CTA; con foto, la bandeja con aire;
// topbar sin controles apretados. Corre en Chromium y WebKit.
import { createRoot } from "react-dom/client";
import App from "../src/App.jsx";
import "../src/styles.css";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rect = (el) => el.getBoundingClientRect();
const $ = (s, root = document) => root.querySelector(s);

async function until(fn, label, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return;
    await sleep(50);
  }
  throw new Error(`timeout: ${label}`);
}

async function pngFile() {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const g = c.getContext("2d");
  g.fillStyle = "#c33";
  g.fillRect(0, 0, 640, 480);
  g.fillStyle = "#39c";
  g.fillRect(160, 120, 320, 240);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  return new File([blob], "foto.png", { type: "image/png" });
}

async function main() {
  assert(window.innerWidth === 390 && window.innerHeight === 844, `viewport 390×844 (${window.innerWidth}×${window.innerHeight})`);
  localStorage.setItem("pc-onboarded", "1");
  createRoot(document.getElementById("root")).render(<App />);
  await until(() => $(".canvas-empty"), "estado vacío");
  await sleep(700); // animación de entrada (empty-in)

  // --- sin foto: solo el CTA ---
  const rail = $(".rail");
  const wrap = $(".canvas-wrap");
  const empty = $(".canvas-empty");
  assert(getComputedStyle(rail).display === "none", "sin foto: la bandeja (.rail) no se muestra");
  const w = rect(wrap);
  const e = rect(empty);
  assert(Math.abs(w.bottom - window.innerHeight) <= 1, `sin foto: la zona vacía llega al borde inferior (${w.bottom} vs ${window.innerHeight})`);
  assert(wrap.scrollHeight <= wrap.clientHeight + 1, "sin foto: el contenedor no desborda");
  assert(empty.scrollHeight <= empty.clientHeight + 1, `sin foto: el contenido no se recorta (${empty.scrollHeight} <= ${empty.clientHeight})`);
  assert(
    e.top >= w.top - 0.5 && e.bottom <= w.bottom + 0.5 && e.left >= 0 && e.right <= window.innerWidth,
    "sin foto: el borde punteado se ve completo en los 4 lados"
  );
  assert(e.height >= w.height * 0.8, `sin foto: la zona vacía ocupa el alto disponible (${e.height} de ${w.height})`);

  // --- CTA ---
  const cta = $(".canvas-empty .btn-primary");
  assert(!!cta, "CTA: botón primario dentro de la zona vacía");
  assert(/Abrir foto/.test(cta.textContent), "CTA: dice «Abrir foto»");
  assert(rect(cta).height >= 44, `CTA: alto >= 44 px (${rect(cta).height})`);
  const ctaInput = $("input[type=file]", cta);
  const topInput = $(".topbar-actions input[type=file]");
  assert(!!ctaInput && ctaInput.accept === topInput.accept, "CTA: abre el mismo selector de archivos que la topbar");

  // --- topbar ---
  const donate = $(".btn-icon-donate");
  const about = $(".topbar-icons .btn-icon:last-child");
  assert(!!donate && !!about, "topbar: ☕ e ⓘ presentes");
  const gapIcons = rect(about).left - rect(donate).right;
  assert(gapIcons >= 8, `topbar: separación ☕–ⓘ >= 8 px (${gapIcons})`);
  const top = $(".topbar");
  const rowBottom = Math.max(rect($(".brand")).bottom, rect($(".topbar-actions")).bottom);
  const gapRows = rect($(".tabs")).top - rowBottom;
  assert(gapRows >= 10, `topbar: acciones–pestañas >= 10 px (${gapRows})`);
  // BUG-12 «header prolijo»: padding 12/16, fila de acciones pareja, sin divisor
  const cs = getComputedStyle(top);
  assert(parseFloat(cs.paddingTop) >= 12 && parseFloat(cs.paddingBottom) >= 12, `header: padding vertical >= 12 px (${cs.paddingTop}/${cs.paddingBottom})`);
  assert(parseFloat(cs.paddingLeft) >= 16 && parseFloat(cs.paddingRight) >= 16, `header: padding lateral >= 16 px (${cs.paddingLeft}/${cs.paddingRight})`);
  const row = [$(".topbar-actions .btn"), $(".lang-select"), donate, about];
  const hs = row.map((c) => rect(c).height);
  assert(Math.max(...hs) - Math.min(...hs) <= 1, `header: controles de la fila con la misma altura (${hs.join("/")})`);
  const gaps = row.slice(1).map((c, i) => rect(c).left - rect(row[i]).right);
  assert(Math.min(...gaps) >= 8 && Math.max(...gaps) - Math.min(...gaps) <= 1, `header: separación pareja >= 8 px (${gaps.join("/")})`);
  assert(parseFloat(getComputedStyle($(".topbar-icons")).borderLeftWidth) === 0, "header: sin divisor vertical entre idioma y ☕");
  const sideL = Math.min(rect($(".tabs")).left, rect(row[0]).left, rect($(".brand")).left);
  const sideR = window.innerWidth - Math.max(rect($(".tabs")).right, rect(about).right);
  assert(sideL >= 16 - 0.5 && sideR >= 16 - 0.5, `header: margen lateral >= 16 px en pestañas y acciones (${sideL}/${sideR})`);
  assert(rect($(".tabs")).right <= window.innerWidth - 16 + 0.5 && rect(about).right <= window.innerWidth - 16 + 0.5, "header: pestañas y acciones alinean a la derecha dentro de 16 px");
  // mismo molde para idioma, ☕ e ⓘ: tamaño y radio idénticos
  const trio = [$(".lang-select"), donate, about].map((c) => {
    const r = rect(c);
    return { w: Math.round(r.width), h: Math.round(r.height), br: getComputedStyle(c).borderTopLeftRadius };
  });
  const same = trio.every((x) => x.w === 44 && x.h === 44 && x.br === trio[0].br);
  assert(same, `header: idioma, ☕ e ⓘ misma forma 44×44 y mismo radio (${JSON.stringify(trio)})`);
  // la pista de arrastrar/pegar solo se oculta en táctil
  const hint = $(".canvas-empty-hint");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const hintShown = getComputedStyle(hint).display !== "none";
  assert(hintShown === !coarse, `pista de arrastrar/pegar: visible=${hintShown} con pointer ${coarse ? "coarse" : "fine"} (solo se oculta en táctil)`);
  const underTop = rect(empty).top - rect(top).bottom;
  assert(underTop >= 16 - 0.5, `header: zona vacía a >= 16 px de la topbar (${underTop})`);

  // --- con foto: se carga por el CTA (prueba que está cableado) ---
  const dt = new DataTransfer();
  dt.items.add(await pngFile());
  ctaInput.files = dt.files;
  ctaInput.dispatchEvent(new Event("change", { bubbles: true }));
  await until(() => !$(".canvas-empty") && $(".canvas-stage"), "foto cargada vía CTA");
  assert(getComputedStyle(rail).display !== "none", "con foto: la bandeja se muestra");
  const tools = [...rail.querySelectorAll(".tool")];
  assert(tools.length >= 4, `con foto: ${tools.length} herramientas`);
  for (let i = 1; i < tools.length; i++) {
    const gap = rect(tools[i]).top - rect(tools[i - 1]).bottom;
    if (gap < 0) continue; // otro grupo/columna
    assert(gap >= 10, `con foto: aire entre herramientas ${i} >= 10 px (${gap})`);
  }
  const stageGap = rect($(".canvas-stage")).top - rect(top).bottom;
  assert(stageGap >= 16 - 0.5, `header: lienzo a >= 16 px de la topbar (${stageGap})`);
  rail.scrollTop = rail.scrollHeight;
  await sleep(100);
  const ctrlsRail = [...rail.querySelectorAll("button, select, input:not(.file-input-sr), a, label.btn")].filter(
    (c) => rect(c).height > 0
  );
  const last = ctrlsRail[ctrlsRail.length - 1];
  const below = rect(rail).bottom - rect(last).bottom;
  assert(rect(last).top >= rect(rail).top && below >= 12, `con foto: el último control se ve entero con margen (${below} px)`);

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

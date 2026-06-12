// Test responsive (P1): monta la App REAL con viewport de móvil (390px,
// configurado por el runner) y verifica el layout de bandeja inferior,
// además del modal Acerca de / Licencias.
import { createRoot } from "react-dom/client";
import App from "../src/App.jsx";
import "../src/styles.css";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const tick = () => new Promise((r) => setTimeout(r, 50));

async function main() {
  assert(window.innerWidth <= 760, `viewport móvil (${window.innerWidth}px ≤ 760)`);

  localStorage.removeItem("pc-onboarded"); // forzar primera visita
  createRoot(document.getElementById("root")).render(<App />);
  await tick();

  // onboarding de primera visita
  const ob = document.querySelector(".onboarding-card");
  assert(!!ob, "onboarding: aparece en la primera visita");
  assert(ob.querySelectorAll(".onboarding-steps li").length === 3, "onboarding: 3 pasos");
  assert(/nunca se suben/.test(ob.textContent), "onboarding: promesa de privacidad");
  ob.querySelector(".onboarding-go").click();
  await tick();
  assert(!document.querySelector(".onboarding-card"), "onboarding: se cierra");
  assert(localStorage.getItem("pc-onboarded") === "1", "onboarding: no volverá a aparecer");

  // modal de atajos con "?" y cierre con Esc
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
  await tick();
  const help = document.querySelector(".modal-help");
  assert(!!help, "ayuda: «?» abre el modal de atajos");
  assert(help.querySelectorAll(".shortcut-list li").length >= 9, "ayuda: lista de atajos completa");
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await tick();
  assert(!document.querySelector(".modal-help"), "ayuda: Esc cierra");

  // PWA / SEO: lo declarado en index.html y los archivos servidos
  const indexHtml = await (await fetch("/")).text();
  assert(indexHtml.includes('rel="manifest"'), "pwa: manifest enlazado en index.html");
  assert(indexHtml.includes('property="og:image"'), "seo: og:image en index.html");
  assert((await fetch("/site.webmanifest")).ok, "pwa: site.webmanifest servido");
  assert((await fetch("/sw.js")).ok, "pwa: sw.js servido");
  assert((await fetch("/icons/icon-512.png")).ok, "pwa: icono 512 servido");
  assert((await fetch("/og.png")).ok, "seo: og.png servido");

  // layout: bandeja inferior
  const body = document.querySelector(".body");
  assert(getComputedStyle(body).flexDirection === "column-reverse", "layout: .body en column-reverse");

  const rail = document.querySelector(".rail");
  const workspace = document.querySelector(".workspace");
  assert(
    rail.getBoundingClientRect().top > workspace.getBoundingClientRect().top,
    "layout: el rail queda debajo del lienzo"
  );
  assert(
    Math.abs(rail.getBoundingClientRect().width - window.innerWidth) < 2,
    "layout: el rail ocupa todo el ancho"
  );
  assert(getComputedStyle(rail).flexDirection === "column", "layout: secciones apiladas en columna");
  const groups = rail.querySelectorAll(".rail-group");
  assert(
    groups[1].getBoundingClientRect().top >= groups[0].getBoundingClientRect().bottom,
    "layout: Exportar debajo de Marcar (no al lado)"
  );
  assert(
    rail.scrollWidth <= rail.clientWidth + 1,
    "layout: sin scroll horizontal en la bandeja"
  );
  assert(
    getComputedStyle(document.querySelector(".brand-env")).display === "none",
    "layout: chips de entorno ocultos en móvil"
  );
  assert(
    getComputedStyle(document.querySelector(".rail-help")).display === "none",
    "layout: ayuda de atajos oculta en móvil"
  );

  // modal Descargar app
  const dlBtn = document.querySelector('[aria-label*="escritorio"]');
  assert(!!dlBtn, "descarga: botón ⬇ presente en web");
  dlBtn.click();
  await tick();
  const dlModal = document.querySelector(".modal-download");
  assert(!!dlModal, "descarga: modal abre");
  assert(
    dlModal.querySelector('a[href*="github.com"][href*="releases"]'),
    "descarga: enlace a releases siempre visible"
  );
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await tick();
  assert(!document.querySelector(".modal-download"), "descarga: Esc cierra");

  // modal Acerca de / Licencias
  document.querySelector('[aria-label*="licencias"], [aria-label*="licenças"], [aria-label*="licenses"]').click();
  await tick();
  const modal = document.querySelector(".modal-about");
  assert(!!modal, "acerca de: el modal abre");
  assert(/PhotoCut/.test(modal.textContent), "acerca de: título");
  assert(/nunca se suben/.test(modal.textContent), "acerca de: promesa de privacidad");
  const items = modal.querySelectorAll(".license-list li");
  assert(items.length >= 8, `licencias: ${items.length} dependencias listadas`);
  assert(/react/.test(modal.textContent), "licencias: react presente");
  assert(/nalgebra/.test(modal.textContent), "licencias: crates de Rust presentes");

  modal.querySelector(".modal-actions .btn").click();
  await tick();
  assert(!document.querySelector(".modal-about"), "acerca de: cierra");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

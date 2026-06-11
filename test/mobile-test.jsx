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

  createRoot(document.getElementById("root")).render(<App />);
  await tick();

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
  assert(getComputedStyle(rail).flexDirection === "row", "layout: rail horizontal con scroll");
  assert(
    getComputedStyle(document.querySelector(".brand-env")).display === "none",
    "layout: chips de entorno ocultos en móvil"
  );
  assert(
    getComputedStyle(document.querySelector(".rail-help")).display === "none",
    "layout: ayuda de atajos oculta en móvil"
  );

  // modal Acerca de / Licencias
  document.querySelector(".btn-icon").click();
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

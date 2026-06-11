// Test de i18n (P2): detección por navigator.language, cambio en vivo con el
// selector ES/EN/PT, persistencia en localStorage y html[lang].
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

function switchLang(code) {
  const sel = document.querySelector(".lang-select");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  ).set;
  setter.call(sel, code);
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

const railTitles = () =>
  [...document.querySelectorAll(".rail-title")].map((el) => el.textContent);

const OB_TITLES = {
  en: "Remove the background in three steps",
  es: "Quita el fondo en tres pasos",
  pt: "Remova o fundo em três passos",
};

async function main() {
  createRoot(document.getElementById("root")).render(<App />);
  await tick();

  // 1. detección según el locale REAL del navegador (agnóstico a la máquina:
  //    en CI es en-US, en una Mac en español es es-419)
  const prefix = navigator.language.slice(0, 2).toLowerCase();
  const expected = ["es", "en", "pt"].includes(prefix) ? prefix : "en";
  assert(
    document.documentElement.lang === expected,
    `detección: html[lang]=${expected} (navigator ${navigator.language})`
  );
  const ob = document.querySelector(".onboarding-card");
  assert(ob.textContent.includes(OB_TITLES[expected]), `detección: onboarding en «${expected}»`);
  ob.querySelector(".onboarding-go").click();
  await tick();

  // 2. selector visible con el valor detectado
  const sel = document.querySelector(".lang-select");
  assert(!!sel && sel.value === expected, "selector: presente con el idioma detectado");

  // 3. cambio en vivo a EN (estado conocido para el resto del test)
  switchLang("en");
  await tick();
  assert(railTitles().includes("Mark"), "en: rail en inglés (Mark)");
  assert(document.documentElement.lang === "en", "en: html[lang] actualizado");

  // 4. cambio en vivo a PT
  switchLang("pt");
  await tick();
  assert(document.documentElement.lang === "pt", "pt: html[lang] actualizado");
  assert(localStorage.getItem("pc-lang") === "pt", "pt: persistido en localStorage");
  assert(
    [...document.querySelectorAll(".tool")].some((b) => /Retângulo/.test(b.textContent)),
    "pt: herramienta «Retângulo» en vivo"
  );

  // 4. cambio a ES
  switchLang("es");
  await tick();
  assert(
    [...document.querySelectorAll(".tool")].some((b) => /Recuadro/.test(b.textContent)),
    "es: herramienta «Recuadro» en vivo"
  );
  assert(
    [...document.querySelectorAll(".tool")].some((b) => /Pincel quitar/.test(b.textContent)),
    "es: «Pincel quitar» (≠ pt «Pincel remover»)"
  );

  // 5. el modal de ayuda también traduce
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
  await tick();
  assert(
    /Atajos de teclado/.test(document.querySelector(".modal-help").textContent),
    "es: modal de ayuda traducido"
  );
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await tick();

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

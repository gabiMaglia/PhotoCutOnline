// Test del ErrorBoundary (P0): un throw en render debe mostrar la pantalla
// de recuperación (no pantalla blanca) y "Reiniciar" debe volver a la app.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "../src/components/ErrorBoundary.jsx";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const tick = () => new Promise((r) => setTimeout(r, 30));

let setBrokenExternal;

function Bomb({ broken }) {
  if (broken) throw new Error("explosión controlada de test");
  return <p id="alive">app viva</p>;
}

function Harness() {
  const [broken, setBroken] = useState(false);
  setBrokenExternal = setBroken;
  return (
    <ErrorBoundary onReset={() => setBroken(false)}>
      <Bomb broken={broken} />
    </ErrorBoundary>
  );
}

async function main() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  createRoot(root).render(<Harness />);
  await tick();

  assert(!!root.querySelector("#alive"), "estado inicial: la app renderiza");

  // detonar un throw en render
  setBrokenExternal(true);
  await tick();

  const crash = root.querySelector(".crash-screen");
  assert(!!crash, "throw en render: aparece la pantalla de recuperación");
  assert(!root.querySelector("#alive"), "throw en render: la app rota no queda visible");
  assert(/Algo salió mal/.test(crash.textContent), "pantalla: título presente");
  assert(
    /explosión controlada de test/.test(crash.querySelector(".crash-detail pre").textContent),
    "pantalla: detalle técnico incluye el error"
  );

  // reiniciar
  crash.querySelector("button").click();
  await tick();
  assert(!root.querySelector(".crash-screen"), "reiniciar: la pantalla de error desaparece");
  assert(!!root.querySelector("#alive"), "reiniciar: la app vuelve a renderizar");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

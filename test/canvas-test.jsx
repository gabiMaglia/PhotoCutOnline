// Test del lienzo (N2+N3): zoom con rueda hacia el cursor, reset, y el
// comparador antes/después con su divisor arrastrable.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import CanvasEditor from "../src/features/cutout/CanvasEditor.jsx";
import "../src/styles.css";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

function dataUrl(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  return c.toDataURL("image/png");
}

const IMG = dataUrl(400, 300, (ctx, w, h) => {
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d6f64b";
  ctx.fillRect(120, 70, 160, 160);
});
const RESULT = dataUrl(400, 300, (ctx) => {
  ctx.fillStyle = "#d6f64b";
  ctx.fillRect(120, 70, 160, 160);
});

let setCompareExternal;

function Harness() {
  const [compare, setCompare] = useState(false);
  setCompareExternal = setCompare;
  return (
    <div className="workspace" style={{ width: 900, height: 600, display: "flex" }}>
      <CanvasEditor
        imageUrl={IMG}
        imageSize={{ width: 400, height: 300 }}
        resultUrl={RESULT}
        mode="fg"
        brushSize={20}
        onRect={() => {}}
        onStroke={() => {}}
        busy={false}
        compare={compare}
        onCompareChange={setCompare}
      />
    </div>
  );
}

async function waitStableWidth(el) {
  // el CSS de Vite carga async: esperar a que el layout se asiente
  let prev = -1;
  for (let i = 0; i < 30; i++) {
    const w = el.getBoundingClientRect().width;
    if (Math.abs(w - prev) < 0.5 && w > 0) {
      window.dispatchEvent(new Event("resize")); // re-encajar con el layout final
      await tick(80);
      return el.getBoundingClientRect().width;
    }
    prev = w;
    await tick(100);
  }
  return prev;
}

async function main() {
  createRoot(document.getElementById("root")).render(<Harness />);
  await tick(150);

  const wrap = document.querySelector(".canvas-wrap");
  const stage = document.querySelector(".canvas-stage");
  assert(!!stage, "stage: se renderiza");
  const w0 = await waitStableWidth(stage);
  assert(w0 > 100, `stage: encajado (${Math.round(w0)}px)`);

  const hud = [...document.querySelectorAll(".hud-btn")];
  const zoomBtn = hud.find((b) => /%$/.test(b.textContent));
  assert(zoomBtn?.textContent === "100%", "hud: zoom inicial 100%");

  // N3: rueda = zoom hacia el cursor
  const r = wrap.getBoundingClientRect();
  wrap.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY: -400,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      bubbles: true,
      cancelable: true,
    })
  );
  await tick();
  const w1 = stage.getBoundingClientRect().width;
  assert(w1 > w0 * 1.5, `zoom: el stage crece (${Math.round(w0)} → ${Math.round(w1)}px)`);
  assert(parseInt(zoomBtn.textContent) > 150, `hud: badge actualizado (${zoomBtn.textContent})`);

  // ghost del pincel escala con el zoom
  wrap.dispatchEvent(
    new PointerEvent("pointermove", {
      clientX: r.left + 200,
      clientY: r.top + 200,
      bubbles: true,
    })
  );
  await tick();

  // reset por botón
  zoomBtn.click();
  await tick(200);
  const wReset = stage.getBoundingClientRect().width;
  assert(
    Math.abs(wReset - w0) < 2,
    `zoom: reset restaura el encaje (${Math.round(w0)} vs ${Math.round(wReset)}, badge ${zoomBtn.textContent})`
  );
  assert(zoomBtn.textContent === "100%", "hud: badge 100% tras reset");

  // N2: comparador
  const cmpBtn = hud.find((b) => /Comparar/.test(b.textContent));
  assert(!!cmpBtn, "compare: botón en el HUD");
  cmpBtn.click();
  await tick(450); // la opacidad de la base transiciona 0.35s
  assert(stage.classList.contains("comparing"), "compare: clase activa");
  const divider = stage.querySelector(".compare-divider");
  assert(!!divider, "compare: divisor visible");
  const baseOp = parseFloat(getComputedStyle(stage.querySelector(".base")).opacity);
  assert(baseOp >= 0.99, `compare: lado «antes» a opacidad completa (${baseOp})`);
  const resultLayer = stage.querySelector(".result");
  assert(
    getComputedStyle(resultLayer).clipPath.includes("inset"),
    "compare: resultado recortado al lado «después»"
  );
  assert(/Antes/.test(stage.textContent) && /Después/.test(stage.textContent),
    "compare: etiquetas Antes/Después");

  // arrastrar el divisor
  const sr = stage.getBoundingClientRect();
  const left0 = parseFloat(divider.style.left);
  divider.dispatchEvent(new PointerEvent("pointerdown", { clientX: sr.left + sr.width / 2, bubbles: true }));
  divider.dispatchEvent(new PointerEvent("pointermove", { clientX: sr.left + sr.width * 0.8, bubbles: true }));
  divider.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await tick();
  const left1 = parseFloat(divider.style.left);
  assert(left1 > left0 + 10, `compare: divisor arrastrado (${left0}% → ${left1}%)`);

  // apagar desde el harness (equivale al atajo C de App)
  setCompareExternal(false);
  await tick();
  assert(!stage.querySelector(".compare-divider"), "compare: se desactiva");

  log("ALL_DONE");
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

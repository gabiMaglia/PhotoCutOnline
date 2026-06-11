// Smoke test del panel flotante "Vista previa": misma estructura/JSX que en
// App.jsx, montado de forma aislada con un recorte real (CutoutSession) para
// verificar render, clases CSS y los toggles de fondo (checker/blanco/negro/color).
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CutoutSession } from "../src/lib/jsEngine.js";
import "../src/styles.css";

const out = [];
const log = (s) => out.push(s);
const assert = (c, n) => {
  log(`${c ? "PASS" : "FAIL"}: ${n}`);
  if (!c) throw new Error(n);
};

function syntheticImage(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d6f64b";
  ctx.fillRect(40, 30, 120, 90);
  return ctx.getImageData(0, 0, w, h);
}

function PreviewHarness({ resultUrl }) {
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewBg, setPreviewBg] = useState("checker");
  const [previewColor, setPreviewColor] = useState("#ffffff");

  if (!previewOpen) return <p id="closed-marker">closed</p>;

  return (
    <div className="preview-panel">
      <div className="preview-panel-head">
        <span className="preview-panel-title">Vista previa</span>
        <div className="preview-bg-switch" role="radiogroup" aria-label="Fondo de la vista previa">
          <button
            className={`bg-chip bg-chip-checker ${previewBg === "checker" ? "bg-chip-on" : ""}`}
            onClick={() => setPreviewBg("checker")}
            aria-label="Fondo transparente"
            aria-pressed={previewBg === "checker"}
          />
          <button
            className={`bg-chip bg-chip-white ${previewBg === "white" ? "bg-chip-on" : ""}`}
            onClick={() => setPreviewBg("white")}
            aria-label="Fondo blanco"
            aria-pressed={previewBg === "white"}
          />
          <button
            className={`bg-chip bg-chip-black ${previewBg === "black" ? "bg-chip-on" : ""}`}
            onClick={() => setPreviewBg("black")}
            aria-label="Fondo negro"
            aria-pressed={previewBg === "black"}
          />
          <input
            type="color"
            className={`bg-chip bg-chip-color ${previewBg === "color" ? "bg-chip-on" : ""}`}
            value={previewColor}
            onChange={(e) => {
              setPreviewColor(e.target.value);
              setPreviewBg("color");
            }}
            aria-label="Color de fondo personalizado"
          />
        </div>
        <button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa">
          ×
        </button>
      </div>
      <div
        className={`preview-body preview-bg-${previewBg}`}
        style={previewBg === "color" ? { background: previewColor } : undefined}
      >
        {previewBg === "checker" && <div className="checker" />}
        <img src={resultUrl} alt="Vista previa del recorte sobre el fondo elegido" />
      </div>
    </div>
  );
}

async function main() {
  const session = new CutoutSession();
  session.load(syntheticImage(200, 150));
  const blob = await session.cutRect({ x: 35, y: 25, w: 130, h: 100 });
  assert(blob instanceof Blob && blob.type === "image/png", "engine: cutRect produce PNG");
  const resultUrl = URL.createObjectURL(blob);

  const root = document.createElement("div");
  document.body.appendChild(root);
  createRoot(root).render(<PreviewHarness resultUrl={resultUrl} />);

  await tick();

  const panel = root.querySelector(".preview-panel");
  assert(!!panel, "panel: se renderiza");

  const img = panel.querySelector(".preview-body img");
  assert(img.src === resultUrl, "panel: <img> muestra el resultUrl");

  const checkerChip = panel.querySelector(".bg-chip-checker");
  const whiteChip = panel.querySelector(".bg-chip-white");
  const blackChip = panel.querySelector(".bg-chip-black");
  const colorChip = panel.querySelector(".bg-chip-color");
  assert(checkerChip.classList.contains("bg-chip-on"), "fondo inicial: checker activo");
  assert(!!panel.querySelector(".preview-body .checker"), "fondo checker: <div class=checker> presente");

  whiteChip.click();
  await tick();
  assert(whiteChip.classList.contains("bg-chip-on"), "click blanco: chip activo");
  assert(!checkerChip.classList.contains("bg-chip-on"), "click blanco: checker ya no activo");
  assert(panel.querySelector(".preview-body").classList.contains("preview-bg-white"), "click blanco: clase preview-bg-white");
  assert(!panel.querySelector(".preview-body .checker"), "click blanco: sin div.checker");

  blackChip.click();
  await tick();
  assert(panel.querySelector(".preview-body").classList.contains("preview-bg-black"), "click negro: clase preview-bg-black");

  // simular elegir color personalizado
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeSetter.call(colorChip, "#ff5e63");
  colorChip.dispatchEvent(new Event("input", { bubbles: true }));
  colorChip.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
  const body = panel.querySelector(".preview-body");
  assert(body.classList.contains("preview-bg-color"), "click color: clase preview-bg-color");
  assert(body.style.background === "rgb(255, 94, 99)", `click color: background inline aplicado (${body.style.background})`);

  // cerrar
  panel.querySelector(".preview-close").click();
  await tick();
  assert(!root.querySelector(".preview-panel"), "cerrar: panel desmontado");
  assert(!!root.querySelector("#closed-marker"), "cerrar: marcador de cerrado presente");

  log("ALL_DONE");
}

function tick() {
  return new Promise((r) => setTimeout(r, 30));
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

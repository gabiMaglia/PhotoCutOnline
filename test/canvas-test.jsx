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
let setSizeExternal;
// BUG-11: cuántas veces el lienzo emitió una edición (con comparar activo debe ser 0)
const calls = { stroke: 0, rect: 0, wand: 0 };

function Harness() {
  const [compare, setCompare] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 600 });
  setCompareExternal = setCompare;
  setSizeExternal = setSize;
  return (
    <div className="workspace" style={{ ...size, display: "flex" }}>
      <CanvasEditor
        imageUrl={IMG}
        imageSize={{ width: 400, height: 300 }}
        resultUrl={RESULT}
        mode="fg"
        brushSize={20}
        onRect={() => calls.rect++}
        onStroke={() => calls.stroke++}
        onWand={() => calls.wand++}
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

  await bug11(wrap, stage, cmpBtn, zoomBtn);

  log("ALL_DONE");
}

// ---- BUG-11: comparar se puede cerrar y se lee en todos los estados ----
// Los chequeos no cortan al primer fallo: la corrida roja tiene que mostrar
// cada criterio que falla, no solo el primero.
async function bug11(wrap, stage, cmpBtn, zoomBtn) {
  const bad = [];
  const check = (c, n) => {
    log(`${c ? "PASS" : "FAIL"}: ${n}`);
    if (!c) bad.push(n);
  };
  const setCompare = async (v) => {
    setCompareExternal(v);
    await tick(450);
  };

  // C1: contraste con hover REAL del puntero (lo hace el runner)
  const hoverReal = async (sel) => {
    await new Promise((res) => {
      window.__hoverAck = res;
      document.body.dataset.hoverReq = sel;
    });
    await tick(250); // .hud-btn transiciona color/borde en 0.12s
  };
  const CMP = ".canvas-hud .hud-btn[aria-pressed]";
  for (const on of [false, true]) {
    await setCompare(on);
    for (const hover of [false, true]) {
      await hoverReal(hover ? CMP : "none");
      const btn = document.querySelector(CMP);
      const cs = getComputedStyle(btn);
      const ratio = contrast(cs.color, cs.backgroundColor);
      const state = `${on ? "encendido" : "apagado"}${hover ? " + hover" : ""}`;
      check(ratio >= 4.5, `C1 contraste ${state}: ${ratio.toFixed(2)}:1 ≥ 4,5 (${cs.color} sobre ${cs.backgroundColor})`);
      check(btn.textContent.trim().length > 0, `C1 texto visible ${state}`);
    }
  }
  await hoverReal("none");

  // C3: encendido, el botón es el cierre visible
  await setCompare(true);
  check(/Salir de comparar/.test(cmpBtn.textContent), `C3 encendido dice «Salir de comparar» («${cmpBtn.textContent}»)`);
  check(cmpBtn.getAttribute("aria-pressed") === "true", "C3 aria-pressed=true");
  check(/Esc/.test(cmpBtn.title), `C3 el tooltip menciona Esc («${cmpBtn.title}»)`);

  // zoom 400 % y pan a una esquina: el HUD sigue a la vista
  const r = wrap.getBoundingClientRect();
  wrap.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY: -Math.log(4) / 0.0022,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      bubbles: true,
      cancelable: true,
    })
  );
  await tick();
  const guide = stage.querySelector(".guide");
  const ptr = (type, x, y, extra = {}) =>
    guide.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, ...extra }));
  ptr("pointerdown", r.left + 300, r.top + 300, { button: 1 });
  ptr("pointermove", r.left + 3000, r.top + 3000, { button: 1 });
  ptr("pointerup", r.left + 3000, r.top + 3000, { button: 1 });
  await tick();
  const z = parseInt(zoomBtn.textContent);
  const b = cmpBtn.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  check(z >= 350, `C3 zoom aplicado (${zoomBtn.textContent})`);
  check(
    b.left >= w.left && b.right <= w.right && b.top >= w.top && b.bottom <= w.bottom,
    `C3 botón dentro del lienzo con zoom+pan (${Math.round(b.left)},${Math.round(b.top)} en ${Math.round(w.width)}×${Math.round(w.height)})`
  );
  check(b.width >= 24 && b.height >= 24, `C3 área de toque ${Math.round(b.width)}×${Math.round(b.height)} ≥ 24×24`);
  cmpBtn.click();
  await tick(450);
  check(!stage.classList.contains("comparing"), "C3 clic en el botón apaga comparar");
  zoomBtn.click();
  await tick(200);

  // C3 (móvil): a 390 px el botón encendido no se parte ni tapa «Después»
  setSizeExternal({ width: 390, height: 500 });
  await tick(100);
  window.dispatchEvent(new Event("resize"));
  await setCompare(true);
  const on = cmpBtn.getBoundingClientRect();
  const zb = zoomBtn.getBoundingClientRect();
  const tag = stage.querySelector(".compare-tag-right")?.getBoundingClientRect();
  check(Math.abs(on.height - zb.height) < 2, `C3 móvil: una sola línea (${Math.round(on.height)} vs ${Math.round(zb.height)} px)`);
  check(on.left >= wrap.getBoundingClientRect().left, "C3 móvil: el HUD entra en el ancho");
  const overlap = tag && !(on.right <= tag.left || on.left >= tag.right || on.bottom <= tag.top || on.top >= tag.bottom);
  check(!!tag && !overlap, "C3 móvil: no tapa la etiqueta «Después»");
  setSizeExternal({ width: 900, height: 600 });
  await tick(100);
  window.dispatchEvent(new Event("resize"));
  await tick(150);

  // C5: presionar la imagen mientras se compara no edita y lo explica
  await setCompare(true);
  const sr = stage.getBoundingClientRect();
  const stroke = (pid) => {
    const x = sr.left + sr.width * 0.12;
    const y = sr.top + sr.height * 0.5;
    const ev = (type, dx) =>
      guide.dispatchEvent(new PointerEvent(type, { clientX: x + dx, clientY: y + dx, pointerId: pid, button: 0, bubbles: true }));
    ev("pointerdown", 0);
    ev("pointermove", 12);
    ev("pointermove", 24);
    ev("pointerup", 24);
  };
  calls.stroke = calls.rect = calls.wand = 0;
  stroke(11);
  await tick();
  check(calls.stroke + calls.rect + calls.wand === 0, `C5 comparando: ningún trazo emitido (${calls.stroke})`);
  const hint = wrap.querySelector(".compare-hint");
  check(!!hint && hint.getAttribute("role") === "status", "C5 aparece el aviso role=status");
  check(/Estás comparando/.test(hint?.textContent || ""), `C5 aviso en español («${hint?.textContent || ""}»)`);
  if (hint) {
    const hr = hint.getBoundingClientRect();
    check(hr.width > 0 && hr.height > 0, "C5 el aviso se ve (tiene caja)");
  }
  await tick(3000);
  check(!wrap.querySelector(".compare-hint"), "C5 el aviso se va solo");

  // arrastrar el divisor no es intención de editar: sin aviso
  const divider = stage.querySelector(".compare-divider");
  divider.dispatchEvent(new PointerEvent("pointerdown", { clientX: sr.left + sr.width / 2, pointerId: 12, bubbles: true }));
  divider.dispatchEvent(new PointerEvent("pointermove", { clientX: sr.left + sr.width * 0.6, pointerId: 12, bubbles: true }));
  divider.dispatchEvent(new PointerEvent("pointerup", { pointerId: 12, bubbles: true }));
  await tick();
  check(!wrap.querySelector(".compare-hint"), "C5 arrastrar el divisor no muestra el aviso");

  // control: sin comparar, el mismo gesto sí pinta (el test no es vacuo)
  await setCompare(false);
  stroke(13);
  await tick();
  check(calls.stroke === 1, `C5 control: sin comparar el trazo se emite (${calls.stroke})`);
  check(!wrap.querySelector(".compare-hint"), "C5 control: sin aviso al pintar normal");

  if (bad.length) throw new Error(`BUG-11: ${bad.length} criterio(s) en rojo`);
}

// contraste WCAG; un fondo semitransparente se compone sobre negro (el HUD
// flota sobre el lienzo oscuro)
function contrast(fg, bg) {
  const over = (c, base) => ({
    r: c.r * c.a + base.r * (1 - c.a),
    g: c.g * c.a + base.g * (1 - c.a),
    b: c.b * c.a + base.b * (1 - c.a),
    a: 1,
  });
  const b = over(rgba(bg), { r: 0, g: 0, b: 0 });
  const f = over(rgba(fg), b);
  const L = (c) => {
    const ch = [c.r, c.g, c.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [L(f), L(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgba(s) {
  const p = s.match(/rgba?\(([^)]+)\)/)[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

main()
  .catch((e) => log(`ERROR: ${e.message}`))
  .finally(() => {
    document.getElementById("out").textContent = out.join("\n");
  });

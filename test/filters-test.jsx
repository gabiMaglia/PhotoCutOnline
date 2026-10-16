// BUG-09 / BUG-10: Filtros, desenfoque de caras, fondo desenfocado y pixelado,
// medidos en píxeles. Corre en Chrome y en WebKit (el motor de Safari no tiene
// ctx.filter: ahí es donde estos tres andaban "sin hacer nada").
//
// F1, F2, F3 y F6 usan solo APIs que ya existían antes del arreglo (la página
// real, censorBoxes y backend): así la corrida contra el árbol viejo falla por
// comportamiento y no por un import. F4/F5/P* importan los módulos nuevos de
// forma dinámica y, si no están, fallan como FAIL.
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { CutoutProvider, useCutoutContext } from "../src/features/cutout/CutoutContext.jsx";
import FiltersPage from "../src/features/filters/FiltersPage.jsx";
import FaceCensorPage from "../src/features/faceCensor/FaceCensorPage.jsx";
import { censorBoxes } from "../src/lib/faceDetect.js";
import { backend } from "../src/lib/backend.js";
import { t } from "../src/lib/i18n.js";
import { syntheticPixels, pixelFiltersHash, GOLDEN_HASH, fnv1a as fnvOf } from "./fixtures/pixelFixture.js";

const out = [];
const flush = () => (document.getElementById("out").textContent = out.join("\n"));
const log = (s) => {
  out.push(s);
  console.log("[filters]", s);
  flush();
};
const check = (c, n) => log(`${c ? "PASS" : "FAIL"}: ${n}`);
const isChrome = /Chrome\//.test(navigator.userAgent);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms = 4000) {
  const t0 = performance.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (performance.now() - t0 > ms) return null;
    await sleep(25);
  }
}

function canvasOf(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  return c;
}
const solid = (w, h, css) => canvasOf(w, h, (ctx) => { ctx.fillStyle = css; ctx.fillRect(0, 0, w, h); });
const toPngFile = (c, name) =>
  new Promise((r) => c.toBlob((b) => r(new File([b], name, { type: "image/png" })), "image/png"));

async function decodeToImageData(src) {
  const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
  const bmp = await createImageBitmap(blob);
  const c = canvasOf(bmp.width, bmp.height, (ctx) => ctx.drawImage(bmp, 0, 0));
  return c.getContext("2d").getImageData(0, 0, bmp.width, bmp.height);
}
const pixelAt = (img, x, y) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const near = (got, want, tol = 1) => want.every((v, i) => Math.abs(got[i] - v) <= tol);
const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
function std(vals) {
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length);
}

// ---------------------------------------------------------------- F1
// La página real de Filtros: la imagen entra por shareFile como en la app.
function Bridge({ file }) {
  const { shareFile } = useCutoutContext();
  useEffect(() => {
    if (file) shareFile(file);
  }, [file, shareFile]);
  return null;
}

function setRange(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
const buttonByText = (text) => [...document.querySelectorAll("#root button")].find((b) => b.textContent.trim() === text);

// Captura la descarga del <a download> (sin navegar) y devuelve su ImageData.
async function captureDownload(click) {
  const origClick = HTMLAnchorElement.prototype.click;
  const origRevoke = URL.revokeObjectURL;
  let href = null;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) href = this.href;
    else origClick.call(this);
  };
  URL.revokeObjectURL = () => {};
  try {
    click();
    await waitFor(() => href, 8000);
  } finally {
    HTMLAnchorElement.prototype.click = origClick;
    URL.revokeObjectURL = origRevoke;
  }
  return href ? decodeToImageData(href) : null;
}

async function testF1() {
  const toasts = [];
  const root = createRoot(document.getElementById("root"));
  const preview = () => document.querySelector("#root .icon-preview canvas");
  const centerOfPreview = () => {
    const c = preview();
    if (!c || !c.width || c.style.display === "none") return null;
    return pixelAt(c.getContext("2d").getImageData(0, 0, c.width, c.height), c.width >> 1, c.height >> 1);
  };
  const render = (file) =>
    root.render(
      <CutoutProvider toast={(m) => toasts.push(m)}>
        <Bridge file={file} />
        <FiltersPage active subTool="filters" onSubTool={() => {}} onToast={(m) => toasts.push(m)} onOpenDownload={() => {}} />
      </CutoutProvider>
    );

  // gris 128 + brillo 150 % ⇒ 192
  render(await toPngFile(solid(64, 48, "rgb(128,128,128)"), "gris.png"));
  const loaded = await waitFor(() => { const p = centerOfPreview(); return p && near(p, [128, 128, 128, 255]) && p; });
  check(!!loaded, "F1: la vista previa de Filtros muestra la foto (gris 128)");
  setRange(document.getElementById("f-bright"), 150);
  const bright = await waitFor(() => { const p = centerOfPreview(); return p && near(p, [192, 192, 192, 255]) && p; });
  check(!!bright, `F1: brillo 150 % en la vista previa ⇒ 192 ±1 (${JSON.stringify(centerOfPreview())})`);
  const dl = await captureDownload(() => buttonByText(t("filters.download"))?.click());
  check(
    !!dl && dl.width === 64 && dl.height === 48 && near(pixelAt(dl, 32, 24), [192, 192, 192, 255]),
    `F1: el PNG descargado tiene brillo 150 % y el tamaño original (${dl ? `${dl.width}×${dl.height} ${pixelAt(dl, 32, 24)}` : "sin descarga"})`
  );

  // preset B/N sobre rojo puro ⇒ (54,54,54)
  buttonByText(t("filters.reset"))?.click();
  render(await toPngFile(solid(64, 48, "rgb(255,0,0)"), "rojo.png"));
  await waitFor(() => { const p = centerOfPreview(); return p && near(p, [255, 0, 0, 255]) && p; });
  buttonByText(t("filters.bw"))?.click();
  const bw = await waitFor(() => { const p = centerOfPreview(); return p && near(p, [54, 54, 54, 255]) && p; });
  check(!!bw, `F1: preset B/N sobre rojo ⇒ (54,54,54) ±1 (${JSON.stringify(centerOfPreview())})`);
  const dl2 = await captureDownload(() => buttonByText(t("filters.download"))?.click());
  check(!!dl2 && near(pixelAt(dl2, 10, 10), [54, 54, 54, 255]), `F1: el PNG B/N descargado también (${dl2 ? pixelAt(dl2, 10, 10) : "sin descarga"})`);
  check(toasts.length === 0, `F1: sin avisos de error (${toasts.join(" | ")})`);
  root.unmount();
}

// ---------------------------------------------------------------- F2
function ellipseStats(before, after, box, pad = 0.14) {
  const bx = box.x - box.w * pad, by = box.y - box.h * pad;
  const rx = (box.w * (1 + 2 * pad)) / 2, ry = (box.h * (1 + 2 * pad)) / 2;
  const cx = bx + rx, cy = by + ry;
  const inB = [], inA = [], ringB = [], ringA = [];
  let minAlpha = 255;
  for (let y = 0; y < after.height; y++) {
    for (let x = 0; x < after.width; x++) {
      const r = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (r >= 0.97) continue;
      const i = (y * after.width + x) * 4;
      inB.push(lum(before.data, i));
      inA.push(lum(after.data, i));
      minAlpha = Math.min(minAlpha, after.data[i + 3]);
      if (r >= 0.8) {
        ringB.push(lum(before.data, i));
        ringA.push(lum(after.data, i));
      }
    }
  }
  return { drop: 1 - std(inA) / std(inB), ringDrop: 1 - std(ringA) / std(ringB), minAlpha };
}

function checker(w, h, cell, a = "#000", b = "#fff") {
  return canvasOf(w, h, (ctx) => {
    for (let y = 0; y < h; y += cell)
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = ((x / cell + y / cell) & 1) ? b : a;
        ctx.fillRect(x, y, cell, cell);
      }
  });
}

function testF2() {
  const src = checker(400, 400, 8);
  const box = { x: 100, y: 80, w: 200, h: 240 };
  const before = src.getContext("2d").getImageData(0, 0, 400, 400);
  const res = censorBoxes(src, [box], { mode: "blur", strength: 60 });
  const after = res.getContext("2d").getImageData(0, 0, 400, 400);
  const s = ellipseStats(before, after, box);
  check(s.drop >= 0.8, `F2: blur de cara: el desvío de luminancia en la elipse baja ${(s.drop * 100).toFixed(1)} % (≥ 80 %)`);
  check(s.ringDrop >= 0.8, `F2: también en el borde de la elipse, sin orla (${(s.ringDrop * 100).toFixed(1)} % ≥ 80 %)`);
  check(s.minAlpha === 255, `F2: alfa 255 en toda la elipse (mín ${s.minAlpha})`);
}

// ---------------------------------------------------------------- F3
// Fondo: tablero arriba a la izquierda, negro abajo a la izquierda, blanco a la
// derecha de x = 300. Sujeto (recuadro) lejos de las zonas que se miden.
function blurScene(W, H) {
  return canvasOf(W, H, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < 140; y += 8)
      for (let x = 0; x < 280; x += 8) if ((x / 8 + y / 8) & 1) { ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 8, 8); }
    ctx.fillStyle = "#fff";
    ctx.fillRect(300, 0, W - 300, H);
    ctx.fillStyle = "#d6f64b";
    ctx.fillRect(40, 180, 100, 120);
    ctx.fillStyle = "#ff5e63";
    ctx.fillRect(60, 200, 30, 30);
  });
}

async function testF3() {
  const W = 480, H = 320;
  const scene = blurScene(W, H);
  const orig = scene.getContext("2d").getImageData(0, 0, W, H);
  await backend.loadImage(scene.toDataURL("image/png"));
  await backend.cutRect({ x: 40, y: 180, w: 100, h: 120 });
  const got = await decodeToImageData(await backend.exportBlurBg(16, { format: "png" }));
  check(got.width === W && got.height === H, `F3: mismas dimensiones (${got.width}×${got.height})`);

  const zone = (img) => {
    const v = [];
    for (let y = 48; y < 92; y++) for (let x = 60; x < 232; x++) v.push(lum(img.data, (y * W + x) * 4));
    return std(v);
  };
  const drop = 1 - zone(got) / zone(orig);
  check(drop >= 0.8, `F3: el fondo lejos del sujeto se desenfoca (desvío −${(drop * 100).toFixed(1)} %)`);

  const corners = [[0, 0, 1, 1], [W - 1, 0, -1, 1], [0, H - 1, 1, -1], [W - 1, H - 1, -1, -1]];
  const cornerOk = corners.every(([x, y, dx, dy]) => {
    const c = pixelAt(got, x, y), n = pixelAt(got, x + dx * 12, y + dy * 12);
    return c[3] === 255 && lum(c, 0) <= lum(n, 0) + 6;
  });
  check(cornerOk, `F3: esquinas opacas y sin orla clara (${corners.map(([x, y]) => pixelAt(got, x, y).join(",")).join(" | ")})`);

  let identical = true;
  for (let y = 184; y < 296 && identical; y++)
    for (let x = 44; x < 136; x++) {
      const i = (y * W + x) * 4;
      if (got.data[i] !== orig.data[i] || got.data[i + 1] !== orig.data[i + 1] || got.data[i + 2] !== orig.data[i + 2]) {
        identical = false;
        break;
      }
    }
  check(identical, "F3: el sujeto queda bit-idéntico al original");

  // un fondo desenfocado alineado cruza el 50 % justo en el borde (x = 300)
  const row = 250;
  let cross = -1;
  for (let x = 200; x < W; x++) if (got.data[(row * W + x) * 4] >= 127.5) { cross = x; break; }
  check(Math.abs(cross - 300) <= 1, `F3: el fondo no se estira ni se corre (borde en x = ${cross}, esperado 300 ±1)`);
}

// ---------------------------------------------------------------- F4 / F5
async function loadNew() {
  try {
    // rutas en variables: Vite no las resuelve al transformar, así la página
    // carga igual contra el árbol viejo (donde no existen) y el fallo es un FAIL
    const PF = "../src/lib/pixelFilters.js";
    const FO = "../src/features/filters/filterOps.js";
    const pf = await import(/* @vite-ignore */ PF);
    const fo = await import(/* @vite-ignore */ FO);
    return { ...pf, ...fo };
  } catch (e) {
    log(`FAIL: no cargan los módulos de filtros propios (${e.message.split("\n")[0]})`);
    return null;
  }
}

const cssOf = (ops) => ops.map((o) => `${o.op}(${o.amount})`).join(" ") || "none";

function testF4(m) {
  if (!isChrome) {
    log("SKIP: F4 compara contra ctx.filter nativo: solo en Chrome");
    return;
  }
  const W = 512, H = 512;
  const base = syntheticPixels(W, H, 11);
  for (let i = 3; i < base.data.length; i += 4) base.data[i] = 255; // opaca
  const srcCanvas = canvasOf(W, H, (ctx) => ctx.putImageData(new ImageData(new Uint8ClampedArray(base.data), W, H), 0, 0));
  const dst = canvasOf(W, H, () => {});
  const dctx = dst.getContext("2d");
  const native = (f) => {
    dctx.clearRect(0, 0, W, H);
    dctx.filter = f;
    dctx.drawImage(srcCanvas, 0, 0);
    dctx.filter = "none";
    return dctx.getImageData(0, 0, W, H).data;
  };
  const ours = (fn) => {
    const im = { data: new Uint8ClampedArray(base.data), width: W, height: H };
    fn(im);
    return im.data;
  };
  const diff = (a, b, margin = 0) => {
    let max = 0, sum = 0, n = 0;
    for (let y = margin; y < H - margin; y++)
      for (let x = margin; x < W - margin; x++)
        for (let c = 0; c < 3; c++) {
          const i = (y * W + x) * 4 + c;
          const e = Math.abs(a[i] - b[i]);
          if (e > max) max = e;
          sum += e;
          n++;
        }
    return { max, mean: sum / n };
  };

  const colorCases = [
    ["B/N", m.buildOps("bw", 100, 100, 100)],
    ["Sepia", m.buildOps("sepia", 100, 100, 100)],
    ["Vívido", m.buildOps("vivid", 100, 100, 100)],
    ["Suave", m.buildOps("soft", 100, 100, 100)],
    ["brillo 50", m.buildOps("none", 50, 100, 100)],
    ["brillo 150", m.buildOps("none", 150, 100, 100)],
    ["contraste 50", m.buildOps("none", 100, 50, 100)],
    ["contraste 150", m.buildOps("none", 100, 150, 100)],
    ["saturación 0", m.buildOps("none", 100, 100, 0)],
    ["saturación 200", m.buildOps("none", 100, 100, 200)],
    ["Sepia + brillo 150 + contraste 50 + saturación 200", m.buildOps("sepia", 150, 50, 200)],
  ];
  for (const [name, ops] of colorCases) {
    const d = diff(native(cssOf(ops)), ours((im) => m.applyColorOps(im, ops)));
    check(d.max <= 2, `F4: ${name} ≈ ctx.filter nativo (máx |Δ| ${d.max} ≤ 2, media ${d.mean.toFixed(3)})`);
  }
  // registro sin umbral (Paso 0 del §CÓMO): la cadena más larga de la UI
  const vivid = m.buildOps("vivid", 130, 140, 150);
  const dv = diff(native(cssOf(vivid)), ours((im) => m.applyColorOps(im, vivid)));
  log(`INFO: F4 Vívido + 130/140/150 (5 etapas): máx |Δ| ${dv.max}, media ${dv.mean.toFixed(3)} (sin umbral, ver §CÓMO)`);

  blurSweep(m);
}

// Barrido de σ (QA BUG-09 H-1): incluye los bordes de cada camino del algoritmo
// (kernel < 3, cajas, escala reducida desde 16) y σ 33, que el slider de fondo
// permite. 768 px para que σ 80 tenga interior a más de 3σ del borde.
function blurSweep(m) {
  const W = 768, H = 768;
  const base = syntheticPixels(W, H, 13);
  for (let i = 3; i < base.data.length; i += 4) base.data[i] = 255;
  const src = canvasOf(W, H, (ctx) => ctx.putImageData(new ImageData(new Uint8ClampedArray(base.data), W, H), 0, 0));
  const dctx = canvasOf(W, H, () => {}).getContext("2d");
  for (const s of [1, 2, 3, 8, 15, 16, 24, 33, 48, 64, 80]) {
    dctx.clearRect(0, 0, W, H);
    dctx.filter = `blur(${s}px)`;
    dctx.drawImage(src, 0, 0);
    dctx.filter = "none";
    const n = dctx.getImageData(0, 0, W, H).data;
    const im = m.gaussianBlur({ data: new Uint8ClampedArray(base.data), width: W, height: H }, s).data;
    const mg = Math.ceil(3 * s) + 1;
    let max = 0, sum = 0, cnt = 0;
    for (let y = mg; y < H - mg; y++)
      for (let x = mg; x < W - mg; x++)
        for (let c = 0; c < 3; c++) {
          const i = (y * W + x) * 4 + c;
          const e = Math.abs(n[i] - im[i]);
          if (e > max) max = e;
          sum += e;
          cnt++;
        }
    const mean = sum / cnt;
    check(mean <= 1.5 && max <= 10, `F4: blur σ ${s} ≈ nativo en el interior (media ${mean.toFixed(3)} ≤ 1,5, máx ${max} ≤ 10)`);
  }
}

// ---------------------------------------------------------------- F7
// QA BUG-09 H-2: con una selfie de 12 MP la vista previa de Censurar caras no
// puede recalcular la censura a resolución completa en cada evento.
const settle = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const mouse = (el, type, x, y) =>
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));

async function testF7() {
  const W = 4000, H = 3000;
  const photo = photo12mp();
  const blob = await new Promise((r) => photo.toBlob(r, "image/jpeg", 0.9));
  const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(blob);
  });

  const root = createRoot(document.getElementById("root"));
  root.render(
    <CutoutProvider toast={() => {}}>
      <Bridge file={file} />
      <FaceCensorPage active subTool="faces" onSubTool={() => {}} onToast={() => {}} onOpenDownload={() => {}} />
    </CutoutProvider>
  );
  const canvas = () => document.querySelector("#root .icon-preview canvas");
  const shown = await waitFor(() => { const c = canvas(); return c && c.width > 0 && c.getBoundingClientRect().width > 0 && c; }, 20000);
  if (!shown) {
    check(false, "F7: la vista previa de Censurar caras no apareció");
    root.unmount();
    return;
  }
  await settle();
  const cv = canvas();
  const rect = cv.getBoundingClientRect();
  // misma conversión que la página: coordenadas de la imagen completa
  const toImg = (cx, cy) => ({ x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H });

  // región a mano de ~1100 px de ancho (una cara de selfie)
  // MouseEventInit.clientX es entero: se redondea acá para que el test y la
  // página conviertan exactamente el mismo punto
  const sx = Math.round(rect.left + rect.width * 0.3), sy = Math.round(rect.top + rect.height * 0.2);
  const ex = Math.round(sx + (1100 / W) * rect.width), ey = Math.round(sy + (1300 / H) * rect.height);
  mouse(cv, "mousedown", sx, sy);
  mouse(cv, "mousemove", ex, ey);
  mouse(cv, "mouseup", ex, ey);
  const a = toImg(sx, sy), b = toImg(ex, ey);
  const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), score: 1, on: true, manual: true };
  const slider = await waitFor(() => document.getElementById("faces-strength"), 10000);
  await settle();

  // muestra de la región en coordenadas del canvas (sirve con cualquier escala)
  const sample = () => {
    const k = canvas().width / W;
    const x = Math.round((box.x + box.w / 2) * k), y = Math.round((box.y + box.h / 2) * k);
    const r = Math.max(4, Math.round(60 * k));
    return fnvOf(canvas().getContext("2d").getImageData(x - r, y - r, 2 * r, 2 * r).data);
  };

  const sliderTimes = [];
  let changed = false;
  for (const v of [20, 90, 30, 80, 40]) {
    const before = sample();
    const t0 = performance.now();
    setRange(slider, v);
    await settle();
    sliderTimes.push(performance.now() - t0);
    if (sample() !== before) changed = true;
  }
  check(changed, "F7: el slider de intensidad repinta la vista previa");
  const ms = median(sliderTimes);
  check(ms <= 100, `F7: slider de intensidad con 12 MP y región de 1100 px: ${ms.toFixed(0)} ms por actualización (≤ 100; ${sliderTimes.map((t) => t.toFixed(0)).join("/")})`);

  // segundo arrastre fuera de la región: cada mousemove solo redibuja el recuadro
  const qx = Math.round(rect.left + rect.width * 0.75), qy = Math.round(rect.top + rect.height * 0.7);
  mouse(cv, "mousedown", qx, qy);
  const moveTimes = [];
  for (let k = 1; k <= 5; k++) {
    const t0 = performance.now();
    mouse(cv, "mousemove", qx + k * 8, qy + k * 6);
    await settle();
    moveTimes.push(performance.now() - t0);
  }
  mouse(cv, "mousemove", qx, qy);
  mouse(cv, "mouseup", qx, qy); // vuelve al punto de partida: clic fuera de la región, no cambia nada
  await settle();
  const mm = median(moveTimes);
  check(mm <= 100, `F7: arrastre a mano con 12 MP: ${mm.toFixed(0)} ms por mousemove (≤ 100; ${moveTimes.map((t) => t.toFixed(0)).join("/")})`);

  // la descarga sigue a resolución completa y bit-idéntica a censorBoxes
  const dl = await captureDownload(() => [...document.querySelectorAll("#root button")].find((x) => x.textContent.trim() === t("faces.download"))?.click());
  const want = censorBoxes(img, [box], { mode: "blur", strength: 40 }).getContext("2d").getImageData(0, 0, W, H);
  check(
    !!dl && dl.width === W && dl.height === H && fnvOf(dl.data) === fnvOf(want.data),
    `F7: la descarga es la censura a resolución completa, bit-idéntica (${dl ? `${dl.width}×${dl.height} ${fnvOf(dl.data)} vs ${fnvOf(want.data)}` : "sin descarga"})`
  );
  root.unmount();
}

function testF5(m) {
  const h = pixelFiltersHash(m);
  check(h === GOLDEN_HASH, `F5: hash de applyColorOps + gaussianBlur = dorado (${h} vs ${GOLDEN_HASH})`);
}

// ---------------------------------------------------------------- F6
// Cara sintética de 260 px con franjas de 1 px: R cambia con x y B con y, así
// cada bloque del pixelado tiene un color propio y se pueden contar.
function stripes(W, H, face) {
  const c = canvasOf(W, H, () => {});
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const fx = Math.min(Math.max(x - face.x, 0), face.w - 1);
      const fy = Math.min(Math.max(y - face.y, 0), face.h - 1);
      img.data[i] = Math.round((fx * 255) / (face.w - 1));
      img.data[i + 1] = 128;
      img.data[i + 2] = Math.round((fy * 255) / (face.h - 1));
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
function runs(values) {
  const out = [];
  let len = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) len++;
    else {
      out.push(len);
      len = 1;
    }
  }
  out.push(len);
  return out;
}
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];

function testF6() {
  const W = 600, H = 600;
  const face = { x: 170, y: 150, w: 260, h: 300 };
  const src = stripes(W, H, face);
  for (const [strength, want] of [[10, 18], [65, 13], [100, 10]]) {
    const res = censorBoxes(src, [face], { mode: "pixelate", strength });
    const d = res.getContext("2d").getImageData(0, 0, W, H).data;
    const cy = face.y + (face.h >> 1), cx = face.x + (face.w >> 1);
    const row = [], col = [];
    for (let x = face.x; x < face.x + face.w; x++) { const i = (cy * W + x) * 4; row.push(`${d[i]},${d[i + 1]},${d[i + 2]}`); }
    for (let y = face.y; y < face.y + face.h; y++) { const i = (y * W + cx) * 4; col.push(`${d[i]},${d[i + 1]},${d[i + 2]}`); }
    const rr = runs(row), cr = runs(col);
    check(Math.abs(rr.length - want) <= 1, `F6: strength ${strength} ⇒ ${rr.length} bloques sobre el ancho de la cara (esperado ${want} ±1)`);
    const bw = median(rr.slice(1, -1).length ? rr.slice(1, -1) : rr);
    const bh = median(cr.slice(1, -1).length ? cr.slice(1, -1) : cr);
    check(Math.abs(bw - bh) <= 1, `F6: strength ${strength} ⇒ bloques cuadrados (${bw}×${bh} px)`);
  }
}

// ---------------------------------------------------------------- P1–P3
function photo12mp() {
  return canvasOf(4000, 3000, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#335");
    g.addColorStop(0.5, "#c84");
    g.addColorStop(1, "#4a8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsl(${(i * 37) % 360},60%,50%)`;
      ctx.beginPath();
      ctx.arc((i * 997) % W, (i * 613) % H, 40 + (i % 7) * 20, 0, 7);
      ctx.fill();
    }
  });
}

async function testPerf(m) {
  const tag = isChrome ? "" : " (WebKit: se registra, sin umbral)";
  const gate = (ok, msg) => (isChrome ? check(ok, msg) : log(`INFO: ${msg}`));
  const photo = photo12mp();
  const ops = m.buildOps("vivid", 120, 110, 130);

  const base = m.toImageData(photo, m.PREVIEW_MAX_SIDE);
  const view = canvasOf(1, 1, () => {});
  const times = [];
  for (let k = 0; k < 5; k++) {
    const t0 = performance.now();
    m.paintFiltered(view, base, k % 2 ? ops : m.buildOps("sepia", 130, 90, 110));
    times.push(performance.now() - t0);
  }
  const p1 = median(times);
  gate(p1 <= 100, `P1: vista previa de Filtros ${base.width}×${base.height}: ${p1.toFixed(0)} ms por actualización (≤ 100)${tag}`);

  let t0 = performance.now();
  const full = m.renderFiltered(photo, ops);
  const blob = await new Promise((r) => full.toBlob(r, "image/png"));
  const p2 = performance.now() - t0;
  gate(!!blob && full.width === 4000 && p2 <= 2500, `P2: descarga de Filtros a 12 MP: ${(p2 / 1000).toFixed(2)} s (≤ 2,5)${tag}`);

  await backend.loadImage(photo.toDataURL("image/jpeg", 0.9));
  await backend.cutRect({ x: 1200, y: 800, w: 1600, h: 1400 });
  t0 = performance.now();
  const url = await backend.exportBlurBg(48, { format: "png" });
  const p3 = performance.now() - t0;
  gate(!!url && p3 <= 3000, `P3: fondo desenfocado (σ 48) a 12 MP: ${(p3 / 1000).toFixed(2)} s (≤ 3)${tag}`);
}

// ---------------------------------------------------------------- main
async function main() {
  log(`motor: ${isChrome ? "Chrome" : "WebKit"} · ctx.filter ${"filter" in document.createElement("canvas").getContext("2d") ? "existe" : "NO existe"}`);
  for (const [name, fn] of [["F1", testF1], ["F2", testF2], ["F3", testF3], ["F6", testF6], ["F7", testF7]]) {
    try {
      await fn();
    } catch (e) {
      log(`FAIL: ${name} lanzó ${e.message}`);
    }
  }
  const m = await loadNew();
  if (m) {
    for (const [name, fn] of [["F4", testF4], ["F5", testF5], ["P", testPerf]]) {
      try {
        await fn(m);
      } catch (e) {
        log(`FAIL: ${name} lanzó ${e.message}`);
      }
    }
  }
  log("ALL_DONE");
}

main().catch((e) => log(`ERROR: ${e.message}`));

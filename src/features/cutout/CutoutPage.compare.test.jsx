// BUG-11: salir de comparar. Escape lo cierra y elegir una herramienta (botón
// del rail o atajo) también; los cambios de modo internos del motor no.
// Provider real con el motor mockeado: se prueba el cableado página↔sesión.
import { render, act, fireEvent } from "@testing-library/react";

jest.mock("../../lib/backend.js", () => ({
  backend: {
    isDesktop: false,
    features: { ai: true, auto: true, wand: true, feather: true, undo: true, finish: true, formats: true, clipboard: true },
    canUndo: () => false,
    canRedo: () => false,
    // sin tamaño: el lienzo no monta sus canvas (jsdom no tiene 2d context)
    loadImage: jest.fn().mockRejectedValue(new Error("sin decode en jsdom")),
    cutRect: jest.fn().mockResolvedValue("blob:rect"),
    exportTransparent: jest.fn(),
  },
}));
jest.mock("../../services/ads.js", () => ({
  ADS: { provider: "house" },
  DONATE_URL: "https://ko-fi.com/gabrielmaglia",
  loadSlot: jest.fn(),
  initAds: jest.fn(),
}));
jest.mock("../../services/analytics.js", () => ({ initAnalytics: jest.fn(), trackEvent: jest.fn() }));
jest.mock("../../utils/aiWarmup.js", () => ({ warmupAiWithToast: jest.fn() }));

import { CutoutProvider, useCutoutContext } from "./CutoutContext.jsx";
import CutoutPage from "./CutoutPage.jsx";

let ctx;
function Probe() {
  ctx = useCutoutContext();
  return null;
}

async function setupComparing() {
  render(
    <CutoutProvider toast={jest.fn()} onImageLoad={jest.fn()}>
      <Probe />
      <CutoutPage active onGoIcons={jest.fn()} onOpenDownload={jest.fn()} onHelp={jest.fn()} onCloseModals={jest.fn()} />
    </CutoutProvider>
  );
  await act(() => ctx.loader.loadDataUrl("data:image/png;base64,AAAA"));
  await act(() => ctx.session.handleRect({ x: 0, y: 0, w: 10, h: 10 }));
  act(() => ctx.session.setCompare(true));
  expect(ctx.session.hasCut).toBe(true);
  expect(ctx.session.compare).toBe(true);
}

const key = (k, target = window) => act(() => fireEvent.keyDown(target, { key: k }));
// los botones de herramienta se identifican por su tecla, no por el texto traducido
const toolByKey = (k) =>
  [...document.querySelectorAll("button.tool")].find((b) => b.querySelector(".tool-key")?.textContent === k);

describe("BUG-11 · Escape sale de comparar (C2)", () => {
  it("Escape apaga comparar", async () => {
    await setupComparing();
    key("Escape");
    expect(ctx.session.compare).toBe(false);
  });

  it("Escape con el foco en un input no lo toca", async () => {
    await setupComparing();
    const input = document.createElement("input");
    document.body.appendChild(input);
    key("Escape", input);
    expect(ctx.session.compare).toBe(true);
    input.remove();
  });
});

describe("BUG-11 · elegir herramienta sale de comparar (C4)", () => {
  it.each([
    ["1", "rect"],
    ["W", "wand"],
    ["2", "fg"],
    ["3", "bg"],
  ])("botón del rail con tecla %s ⇒ modo %s y sin comparar", async (k, mode) => {
    await setupComparing();
    act(() => toolByKey(k).click());
    expect(ctx.session.compare).toBe(false);
    expect(ctx.session.mode).toBe(mode);
  });

  it.each([
    ["1", "rect"],
    ["w", "wand"],
    ["2", "fg"],
    ["3", "bg"],
  ])("atajo %s ⇒ modo %s y sin comparar", async (k, mode) => {
    await setupComparing();
    key(k);
    expect(ctx.session.compare).toBe(false);
    expect(ctx.session.mode).toBe(mode);
  });

  it("un cambio de modo interno (fin de un recorte) deja comparar activo", async () => {
    await setupComparing();
    act(() => ctx.session.setMode("rect"));
    await act(() => ctx.session.handleRect({ x: 0, y: 0, w: 20, h: 20 }));
    expect(ctx.session.mode).toBe("fg");
    expect(ctx.session.compare).toBe(true);
  });
});

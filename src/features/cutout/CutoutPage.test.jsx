import { render, screen } from "@testing-library/react";

// motor mockeado: la page es de integración (provider + paneles), no toca WASM
jest.mock("../../lib/backend.js", () => ({
  backend: {
    isDesktop: false,
    features: { ai: true, auto: true, feather: true, undo: true, finish: true, formats: true, clipboard: true },
    canUndo: () => false,
    canRedo: () => false,
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

import { CutoutProvider } from "./CutoutContext.jsx";
import CutoutPage from "./CutoutPage.jsx";

function renderPage() {
  return render(
    <CutoutProvider toast={jest.fn()} onImageLoad={jest.fn()}>
      <CutoutPage
        active
        onGoIcons={jest.fn()}
        onOpenDownload={jest.fn()}
        onHelp={jest.fn()}
        onCloseModals={jest.fn()}
      />
    </CutoutProvider>
  );
}

describe("CutoutPage (integración)", () => {
  it("renderiza el rail con marcar / acabado / exportar", () => {
    renderPage();
    // los tres títulos de sección del rail
    expect(document.querySelectorAll(".rail-group").length).toBeGreaterThanOrEqual(3);
    // herramientas de marcado (recuadro/mantener/quitar)
    expect(document.querySelectorAll(".tool").length).toBe(3);
  });

  it("deshabilita la descarga mientras no hay recorte", () => {
    renderPage();
    // el botón principal de exportación (no el de "fondo desenfocado")
    const download = document.querySelector("button.export-download");
    expect(download).toBeDisabled();
  });

  it("muestra el lienzo vacío invitando a soltar una imagen", () => {
    renderPage();
    expect(document.querySelector(".canvas-empty")).toBeInTheDocument();
  });
});

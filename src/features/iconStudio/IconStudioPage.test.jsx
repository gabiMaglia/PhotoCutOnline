import { render, screen } from "@testing-library/react";

jest.mock("../../lib/backend.js", () => ({
  backend: {
    isDesktop: false,
    features: { ai: true },
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

import { CutoutProvider } from "../cutout/CutoutContext.jsx";
import IconStudioPage from "./IconStudioPage.jsx";

function renderPage() {
  return render(
    <CutoutProvider toast={jest.fn()} onImageLoad={jest.fn()}>
      <IconStudioPage active onToast={jest.fn()} onOpenDownload={jest.fn()} />
    </CutoutProvider>
  );
}

describe("IconStudioPage (integración)", () => {
  it("muestra el estado vacío inicial", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Icon Studio" })).toBeInTheDocument();
    expect(document.querySelector(".canvas-empty")).toBeInTheDocument();
  });

  it("deshabilita 'usar recorte actual' cuando no hay recorte", () => {
    renderPage();
    const useCurrent = screen.getByRole("button", {
      name: /recorte actual|current cutout|recorte atual/i,
    });
    expect(useCurrent).toBeDisabled();
  });

  it("lista las plataformas seleccionables", () => {
    renderPage();
    expect(document.querySelectorAll(".platform").length).toBeGreaterThanOrEqual(5);
  });
});

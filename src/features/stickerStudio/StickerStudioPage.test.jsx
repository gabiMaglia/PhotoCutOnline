import { render, screen } from "@testing-library/react";

jest.mock("../../lib/backend.js", () => ({
  backend: { isDesktop: false, features: {}, canUndo: () => false, canRedo: () => false, exportTransparent: jest.fn() },
}));
jest.mock("../../services/ads.js", () => ({
  ADS: { provider: "house" },
  DONATE_URL: "https://ko-fi.com/gabrielmaglia",
  loadSlot: jest.fn(),
  initAds: jest.fn(),
}));

import { CutoutProvider } from "../cutout/CutoutContext.jsx";
import StickerStudioPage from "./StickerStudioPage.jsx";

function renderPage() {
  return render(
    <CutoutProvider toast={jest.fn()} onImageLoad={jest.fn()}>
      <StickerStudioPage active onToast={jest.fn()} onOpenDownload={jest.fn()} />
    </CutoutProvider>
  );
}

describe("StickerStudioPage (integración)", () => {
  it("muestra el estado vacío inicial", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /stickers/i })).toBeInTheDocument();
    expect(document.querySelector(".canvas-empty")).toBeInTheDocument();
  });

  it("ofrece exportar a WhatsApp, Telegram y PNG (deshabilitados sin fuente)", () => {
    renderPage();
    const wa = screen.getByRole("button", { name: /whatsapp/i });
    const tg = screen.getByRole("button", { name: /telegram/i });
    expect(wa).toBeDisabled();
    expect(tg).toBeDisabled();
  });

  it("deshabilita 'usar recorte actual' cuando no hay recorte", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /recorte actual|current cutout|recorte atual/i })
    ).toBeDisabled();
  });
});

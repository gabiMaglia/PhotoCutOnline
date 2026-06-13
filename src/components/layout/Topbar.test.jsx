import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// aislamos del motor: Topbar solo lee isDesktop/features
jest.mock("../../lib/backend.js", () => ({
  backend: { isDesktop: false, features: { clipboard: true } },
}));
// ads.js depende de import.meta.env (Vite); en Jest lo stubeamos
jest.mock("../../services/ads.js", () => ({
  ADS: { provider: "house" },
  DONATE_URL: "https://ko-fi.com/gabrielmaglia",
  loadSlot: jest.fn(),
  initAds: jest.fn(),
}));

import Topbar from "./Topbar.jsx";

function setup(props = {}) {
  const base = {
    tab: "cut",
    onTab: jest.fn(),
    onFileInput: jest.fn(),
    onOpenAbout: jest.fn(),
    onOpenDownload: jest.fn(),
  };
  render(<Topbar {...base} {...props} />);
  return { ...base, ...props };
}

describe("Topbar", () => {
  it("renderiza las pestañas visibles con la activa marcada", () => {
    setup({ tab: "cut" });
    // Stickers está oculto por flag (STICKERS_ENABLED=false): quedan Recorte + Icon Studio
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("cambia de pestaña al hacer click", async () => {
    const { onTab } = setup({ tab: "cut" });
    await userEvent.click(screen.getByRole("tab", { name: "Icon Studio" }));
    expect(onTab).toHaveBeenCalledWith("icons");
  });

  it("abre Acerca de y Descargar desde los íconos", async () => {
    const { onOpenAbout, onOpenDownload } = setup();
    await userEvent.click(screen.getByRole("button", { name: /about|acerca|sobre/i }));
    expect(onOpenAbout).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /download|descargar|baixar|app/i }));
    expect(onOpenDownload).toHaveBeenCalled();
  });

  it("incluye el enlace de donación (Ko-fi)", () => {
    setup();
    const donate = screen.getByRole("link");
    expect(donate).toHaveAttribute("href", expect.stringContaining("ko-fi.com"));
  });
});

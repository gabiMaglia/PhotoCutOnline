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
    // Stickers oculto por flag (STICKERS_ENABLED=false): Recorte + Icon Studio +
    // Lote + Color Studio + Texto + Datos
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    tabs.slice(1).forEach((tab) => expect(tab).toHaveAttribute("aria-selected", "false"));
  });

  it("cambia de pestaña al hacer click", async () => {
    const { onTab } = setup({ tab: "cut" });
    await userEvent.click(screen.getByRole("tab", { name: "Icon Studio" }));
    expect(onTab).toHaveBeenCalledWith("icons");
  });

  it("abre Acerca de desde los íconos", async () => {
    // El botón "Descargar app" está oculto por el momento (T-012: definir
    // desktop de pago antes de empujar descargas del desktop gratis).
    const { onOpenAbout } = setup();
    await userEvent.click(screen.getByRole("button", { name: /about|acerca|sobre/i }));
    expect(onOpenAbout).toHaveBeenCalled();
  });

  it("incluye el enlace de donación (Ko-fi)", () => {
    setup();
    // hay varios links (logo→/, Guías, donación); tomamos el de Ko-fi por su aria-label
    const donate = screen.getByRole("link", { name: /ko-fi/i });
    expect(donate).toHaveAttribute("href", expect.stringContaining("ko-fi.com"));
  });

  it("el logo enlaza al inicio (landing)", () => {
    setup();
    const brand = screen.getByRole("link", { name: /ir al inicio/i });
    expect(brand).toHaveAttribute("href", "/");
  });
});

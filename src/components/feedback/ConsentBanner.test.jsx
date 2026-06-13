import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// analytics mockeado: controlamos "configurado" y espiamos initAnalytics
// (jest exige el prefijo `mock` para variables usadas en el factory)
const mockInitAnalytics = jest.fn();
jest.mock("../../services/analytics.js", () => ({
  analyticsConfigured: () => true,
  initAnalytics: (...a) => mockInitAnalytics(...a),
}));

import ConsentBanner from "./ConsentBanner.jsx";
import { getConsent, setConsent } from "../../services/consent.js";

describe("ConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    mockInitAnalytics.mockClear();
  });

  it("se muestra sin decisión previa y enlaza la privacidad", () => {
    render(<ConsentBanner />);
    expect(screen.getByRole("region", { name: /cookie|cookies/i })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/legal/privacidad.html");
  });

  it("Aceptar guarda granted e inicializa analytics", async () => {
    render(<ConsentBanner />);
    await userEvent.click(screen.getByRole("button", { name: /aceptar|accept|aceitar/i }));
    expect(getConsent()).toBe("granted");
    expect(mockInitAnalytics).toHaveBeenCalled();
    expect(screen.queryByRole("region")).toBeNull(); // se oculta tras decidir
  });

  it("Rechazar guarda denied y NO inicializa analytics", async () => {
    render(<ConsentBanner />);
    await userEvent.click(screen.getByRole("button", { name: /rechazar|reject|recusar/i }));
    expect(getConsent()).toBe("denied");
    expect(mockInitAnalytics).not.toHaveBeenCalled();
  });

  it("no se muestra si ya hay una decisión", () => {
    setConsent("denied");
    render(<ConsentBanner />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});

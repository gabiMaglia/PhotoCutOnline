import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LangSwitch from "./LangSwitch.jsx";
import { getLang, setLang } from "../../lib/i18n.js";

describe("LangSwitch", () => {
  // reset antes de cada test (sin componente montado: no dispara updates en act)
  beforeEach(() => setLang("es"));

  it("ofrece los tres idiomas y refleja el actual", () => {
    render(<LangSwitch />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("es");
    expect(screen.getByRole("option", { name: "ES" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "EN" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PT" })).toBeInTheDocument();
  });

  it("cambia el idioma global al seleccionar", async () => {
    render(<LangSwitch />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "en");
    expect(getLang()).toBe("en");
  });
});

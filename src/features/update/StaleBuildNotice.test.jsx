import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaleBuildNotice from "./StaleBuildNotice.jsx";
import { setLang } from "../../lib/i18n.js";

// BUG-08 C8 (parte jsdom): el aviso aparece ante cualquiera de las dos señales,
// en los tres idiomas, y solo recarga cuando el usuario toca el botón.
describe("StaleBuildNotice", () => {
  afterEach(() => act(() => setLang("es")));

  const fire = (type) => act(() => window.dispatchEvent(new Event(type)));

  test("no se muestra mientras no haya señal", () => {
    render(<StaleBuildNotice onReload={jest.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("aparece con vite:preloadError y recarga solo al tocar Recargar", async () => {
    const onReload = jest.fn();
    act(() => setLang("es"));
    render(<StaleBuildNotice onReload={onReload} />);
    fire("vite:preloadError");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hay una versión nueva de PhotoCut. Recargá la página para seguir."
    );
    expect(onReload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Recargar" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["en", "There's a new version of PhotoCut. Reload the page to continue.", "Reload"],
    ["pt", "Há uma versão nova do PhotoCut. Recarregue a página para continuar.", "Recarregar"],
  ])("aparece con photocut:stale-build en %s", (lang, body, action) => {
    act(() => setLang(lang));
    render(<StaleBuildNotice onReload={jest.fn()} />);
    fire("photocut:stale-build");
    expect(screen.getByRole("alert")).toHaveTextContent(body);
    expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dropdown from "./Dropdown.jsx";

const OPTIONS = [
  { value: "original", label: "Original" },
  { value: "amazon", label: "Amazon" },
  { value: "etsy", label: "Etsy" },
];

describe("Dropdown", () => {
  it("muestra la opción seleccionada y abre el listado al click", async () => {
    const user = userEvent.setup();
    render(<Dropdown value="amazon" onChange={() => {}} options={OPTIONS} ariaLabel="Preset" />);
    const trigger = screen.getByRole("button", { name: "Preset" });
    expect(trigger).toHaveTextContent("Amazon");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("elige una opción y cierra el listado", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Dropdown value="original" onChange={onChange} options={OPTIONS} ariaLabel="Preset" />);
    await user.click(screen.getByRole("button", { name: "Preset" }));
    await user.click(await screen.findByRole("option", { name: "Etsy" }));
    expect(onChange).toHaveBeenCalledWith("etsy");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navega y selecciona con el teclado", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Dropdown value="original" onChange={onChange} options={OPTIONS} ariaLabel="Preset" />);
    const trigger = screen.getByRole("button", { name: "Preset" });
    trigger.focus();
    await user.keyboard("{ArrowDown}"); // abre
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}"); // baja a "amazon" y elige
    expect(onChange).toHaveBeenCalledWith("amazon");
  });

  it("cierra con Escape", async () => {
    const user = userEvent.setup();
    render(<Dropdown value="original" onChange={() => {}} options={OPTIONS} ariaLabel="Preset" />);
    await user.click(screen.getByRole("button", { name: "Preset" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

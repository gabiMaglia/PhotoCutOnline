import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChipGroup from "./ChipGroup.jsx";

const OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "jpeg", label: "JPEG", disabled: true },
];

describe("ChipGroup", () => {
  it("marca la opción activa con aria-checked y clase chip-on", () => {
    render(<ChipGroup ariaLabel="Formato" value="png" onChange={() => {}} options={OPTIONS} />);
    const png = screen.getByRole("radio", { name: "PNG" });
    expect(png).toHaveAttribute("aria-checked", "true");
    expect(png).toHaveClass("chip-on");
    expect(screen.getByRole("radio", { name: "WEBP" })).toHaveAttribute("aria-checked", "false");
  });

  it("llama onChange con el value elegido", async () => {
    const onChange = jest.fn();
    render(<ChipGroup ariaLabel="Formato" value="png" onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole("radio", { name: "WEBP" }));
    expect(onChange).toHaveBeenCalledWith("webp");
  });

  it("respeta opciones deshabilitadas", async () => {
    const onChange = jest.fn();
    render(<ChipGroup ariaLabel="Formato" value="png" onChange={onChange} options={OPTIONS} />);
    const jpeg = screen.getByRole("radio", { name: "JPEG" });
    expect(jpeg).toBeDisabled();
    await userEvent.click(jpeg);
    expect(onChange).not.toHaveBeenCalled();
  });
});

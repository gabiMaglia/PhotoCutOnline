import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileButton from "./FileButton.jsx";

describe("FileButton", () => {
  it("renderiza un label con la clase btn y un input file oculto", () => {
    const { container } = render(<FileButton>Abrir</FileButton>);
    expect(screen.getByText("Abrir").closest("label")).toHaveClass("btn");
    const input = container.querySelector("input[type=file]");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", "image/*");
  });

  it("marca btn-disabled y desactiva el input cuando disabled", () => {
    const { container } = render(<FileButton disabled>Abrir</FileButton>);
    expect(screen.getByText("Abrir").closest("label")).toHaveClass("btn-disabled");
    expect(container.querySelector("input")).toBeDisabled();
  });

  it("(GROW-27 c) el input es alcanzable con Tab (sin atributo hidden)", async () => {
    const { container } = render(<FileButton>Abrir foto</FileButton>);
    const input = container.querySelector("input[type=file]");
    expect(input).not.toHaveAttribute("hidden");
    await userEvent.tab();
    expect(input).toHaveFocus();
  });

  it("(GROW-27 c) expone nombre accesible desde el texto del label", () => {
    render(<FileButton>Abrir foto</FileButton>);
    expect(screen.getByLabelText("Abrir foto")).toHaveAttribute("type", "file");
  });

  it("(GROW-27 c) deshabilitado no recibe foco", async () => {
    const { container } = render(<FileButton disabled>Abrir foto</FileButton>);
    await userEvent.tab();
    expect(container.querySelector("input")).not.toHaveFocus();
  });

  it("dispara onChange al elegir un archivo", async () => {
    const onChange = jest.fn();
    const { container } = render(<FileButton onChange={onChange}>Abrir</FileButton>);
    const file = new File(["x"], "x.png", { type: "image/png" });
    await userEvent.upload(container.querySelector("input"), file);
    expect(onChange).toHaveBeenCalled();
  });
});

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

  it("dispara onChange al elegir un archivo", async () => {
    const onChange = jest.fn();
    const { container } = render(<FileButton onChange={onChange}>Abrir</FileButton>);
    const file = new File(["x"], "x.png", { type: "image/png" });
    await userEvent.upload(container.querySelector("input"), file);
    expect(onChange).toHaveBeenCalled();
  });
});

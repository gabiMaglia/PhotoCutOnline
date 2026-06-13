import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "./Button.jsx";

describe("Button", () => {
  it("renderiza el contenido y la clase base", () => {
    render(<Button>Hola</Button>);
    const btn = screen.getByRole("button", { name: "Hola" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("btn");
  });

  it("aplica la clase de variante y de tamaño", () => {
    render(
      <Button variant="primary" size="small">
        X
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("btn-primary");
    expect(btn).toHaveClass("btn-small");
  });

  it("muestra el atajo de teclado", () => {
    render(<Button kbd="E">Exportar</Button>);
    expect(screen.getByText("E").tagName).toBe("KBD");
  });

  it("dispara onClick y respeta disabled", async () => {
    const onClick = jest.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1); // sigue en 1: disabled no dispara
  });
});

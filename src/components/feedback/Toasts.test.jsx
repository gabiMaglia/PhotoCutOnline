import { render, screen } from "@testing-library/react";
import Toasts from "./Toasts.jsx";

describe("Toasts", () => {
  it("renderiza cada toast con su clase de tipo", () => {
    const toasts = [
      { id: 1, text: "Listo", kind: "ok" },
      { id: 2, text: "Falló", kind: "error" },
    ];
    const { container } = render(<Toasts toasts={toasts} />);
    expect(screen.getByText("Listo")).toHaveClass("toast-ok");
    expect(screen.getByText("Falló")).toHaveClass("toast-error");
    expect(container.querySelector(".toasts")).toHaveAttribute("aria-live", "polite");
  });

  it("no renderiza toasts cuando la lista está vacía", () => {
    const { container } = render(<Toasts toasts={[]} />);
    expect(container.querySelectorAll(".toast")).toHaveLength(0);
  });
});

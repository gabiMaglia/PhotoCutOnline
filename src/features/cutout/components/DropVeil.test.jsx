import { render, screen } from "@testing-library/react";
import DropVeil from "./DropVeil.jsx";

describe("DropVeil", () => {
  it("no renderiza nada cuando show=false", () => {
    const { container } = render(<DropVeil show={false} />);
    expect(container.querySelector(".drop-veil")).toBeNull();
  });

  it("renderiza el velo cuando show=true", () => {
    render(<DropVeil show />);
    expect(document.querySelector(".drop-veil")).toBeInTheDocument();
  });
});

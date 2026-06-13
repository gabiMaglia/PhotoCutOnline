import { render } from "@testing-library/react";
import CutGhost from "./CutGhost.jsx";

describe("CutGhost", () => {
  it("no renderiza nada sin posición o sin imagen", () => {
    const { container: c1 } = render(<CutGhost pos={null} src="x.png" />);
    expect(c1.querySelector("img")).toBeNull();
    const { container: c2 } = render(<CutGhost pos={{ x: 1, y: 2 }} src={null} />);
    expect(c2.querySelector("img")).toBeNull();
  });

  it("renderiza el fantasma posicionado cuando hay pos y src", () => {
    const { container } = render(<CutGhost pos={{ x: 12, y: 34 }} src="cut.png" />);
    const img = container.querySelector("img.cut-ghost");
    expect(img).toBeInTheDocument();
    expect(img).toHaveStyle({ left: "12px", top: "34px" });
  });
});

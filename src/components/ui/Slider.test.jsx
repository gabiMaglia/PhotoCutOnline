import { render, screen, fireEvent } from "@testing-library/react";
import Slider from "./Slider.jsx";

describe("Slider", () => {
  it("vincula label y range, y entrega un número en onChange", () => {
    const onChange = jest.fn();
    render(<Slider id="brush" label="Pincel" min={0} max={100} value={20} onChange={onChange} />);
    const input = screen.getByLabelText(/Pincel/);
    expect(input).toHaveValue("20");
    // el slider entrega el valor convertido a número (no string)
    fireEvent.change(input, { target: { value: "37" } });
    expect(onChange).toHaveBeenCalledWith(37);
  });

  it("aplica slider-off y disabled cuando off", () => {
    const { container } = render(
      <Slider id="f" label="F" min={0} max={10} value={2} onChange={() => {}} off disabled />
    );
    expect(container.querySelector(".slider")).toHaveClass("slider-off");
    expect(screen.getByLabelText("F")).toBeDisabled();
  });
});

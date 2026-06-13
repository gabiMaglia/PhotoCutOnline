import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Checkbox from "./Checkbox.jsx";

describe("Checkbox", () => {
  it("refleja checked y entrega el booleano en onChange", async () => {
    const onChange = jest.fn();
    render(
      <Checkbox checked={false} onChange={onChange}>
        Sticker
      </Checkbox>
    );
    const box = screen.getByRole("checkbox", { name: "Sticker" });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("se desactiva con disabled", () => {
    render(
      <Checkbox checked onChange={() => {}} disabled>
        X
      </Checkbox>
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});

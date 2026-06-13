import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinishPanel from "./FinishPanel.jsx";

function setup(props = {}) {
  const base = {
    hasCut: true,
    stickerOn: false,
    stickerWidth: 14,
    shadowOn: false,
    shadowSize: 40,
    onSticker: jest.fn(),
    onStickerWidth: jest.fn(),
    onShadow: jest.fn(),
    onShadowSize: jest.fn(),
  };
  render(<FinishPanel {...base} {...props} />);
  return { ...base, ...props };
}

describe("FinishPanel", () => {
  it("alterna sticker y sombra vía checkboxes", async () => {
    const { onSticker, onShadow } = setup();
    const checks = screen.getAllByRole("checkbox");
    await userEvent.click(checks[0]);
    expect(onSticker).toHaveBeenCalledWith(true);
    await userEvent.click(checks[1]);
    expect(onShadow).toHaveBeenCalledWith(true);
  });

  it("deshabilita los checkboxes sin recorte", () => {
    setup({ hasCut: false });
    screen.getAllByRole("checkbox").forEach((c) => expect(c).toBeDisabled());
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LargeImageModal from "./LargeImageModal.jsx";

describe("LargeImageModal", () => {
  it("no renderiza nada sin pending", () => {
    render(<LargeImageModal pending={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("muestra el diálogo y dispara confirmar/cancelar", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <LargeImageModal
        pending={{ width: 8000, height: 6000 }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]); // reducir (primario)
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(buttons[1]); // cancelar
    expect(onCancel).toHaveBeenCalled();
  });
});

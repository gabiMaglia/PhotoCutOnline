import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal.jsx";

describe("Modal", () => {
  it("expone role=dialog con aria-labelledby y renderiza acciones", () => {
    render(
      <Modal labelledBy="t" onClose={() => {}} actions={<button>OK</button>}>
        <h3 id="t">Título</h3>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "t");
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("cierra al clic en el velo pero no al clic en el contenido", async () => {
    const onClose = jest.fn();
    render(
      <Modal labelledBy="t" onClose={onClose}>
        <h3 id="t">Título</h3>
      </Modal>
    );
    await userEvent.click(screen.getByText("Título"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("dialog")); // el velo
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

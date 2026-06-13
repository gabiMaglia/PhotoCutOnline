import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../lib/backend.js", () => ({
  backend: { features: { ai: true, auto: true, feather: true, undo: true } },
}));

import MarkPanel from "./MarkPanel.jsx";

function setup(props = {}) {
  const base = {
    imageUrl: "img",
    hasCut: true,
    busy: false,
    mode: "rect",
    setMode: jest.fn(),
    brushSize: 28,
    setBrushSize: jest.fn(),
    feather: 2,
    onFeather: jest.fn(),
    canUndo: true,
    canRedo: false,
    onAi: jest.fn(),
    onAuto: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
  };
  render(<MarkPanel {...base} {...props} />);
  return { ...base, ...props };
}

describe("MarkPanel", () => {
  it("dispara IA y automático", async () => {
    const { onAi, onAuto } = setup();
    await userEvent.click(screen.getByText(/IA|AI/).closest("button"));
    expect(onAi).toHaveBeenCalled();
    await userEvent.click(screen.getByText(/autom|auto/i).closest("button"));
    expect(onAuto).toHaveBeenCalled();
  });

  it("cambia de modo con las herramientas", async () => {
    const { setMode } = setup({ mode: "rect" });
    // hay 3 tool-buttons (recuadro/mantener/quitar); el 2º cambia a fg
    const tools = document.querySelectorAll(".tool");
    await userEvent.click(tools[1]);
    expect(setMode).toHaveBeenCalledWith("fg");
  });

  it("respeta el estado de undo/redo", () => {
    setup({ canUndo: true, canRedo: false });
    // deshacer habilitado, rehacer deshabilitado
    const undo = screen.getByText(/Deshacer|Undo|Desfazer/).closest("button");
    const redo = screen.getByText(/Rehacer|Redo|Refazer/).closest("button");
    expect(undo).not.toBeDisabled();
    expect(redo).toBeDisabled();
  });
});

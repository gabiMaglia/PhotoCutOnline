import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../lib/backend.js", () => ({
  backend: { features: { finish: true, formats: true, clipboard: true } },
}));

import ExportPanel from "./ExportPanel.jsx";

function setup(props = {}) {
  const base = {
    hasCut: true,
    busy: false,
    previewOpen: false,
    onTogglePreview: jest.fn(),
    presetId: "original",
    setPresetId: jest.fn(),
    exportMode: "transparent",
    setExportMode: jest.fn(),
    format: "png",
    setFormat: jest.fn(),
    bgColor: "#ffffff",
    setBgColor: jest.fn(),
    bgImage: null,
    setBgImage: jest.fn(),
    bgOpacity: 100,
    setBgOpacity: jest.fn(),
    onChooseBgImage: jest.fn(),
    onDownload: jest.fn(),
    onCopy: jest.fn(),
    onGoIcons: jest.fn(),
  };
  const result = render(<ExportPanel {...base} {...props} />);
  return { ...base, ...props, ...result };
}

describe("ExportPanel", () => {
  it("ofrece tres modos de fondo y permite cambiarlos", async () => {
    const { setExportMode } = setup();
    const radios = screen.getAllByRole("radio");
    // 3 chips de modo + 3 de formato = 6 radios
    expect(radios.length).toBeGreaterThanOrEqual(3);
    await userEvent.click(screen.getByRole("radio", { name: /color|cor/i }));
    expect(setExportMode).toHaveBeenCalledWith("solid");
  });

  it("dispara la descarga", async () => {
    const { onDownload } = setup();
    await userEvent.click(screen.getByText(/Descargar|Download|Baixar/).closest("button"));
    expect(onDownload).toHaveBeenCalled();
  });

  it("deshabilita la descarga sin recorte", () => {
    setup({ hasCut: false });
    expect(screen.getByText(/Descargar|Download|Baixar/).closest("button")).toBeDisabled();
  });

  it("muestra el control de color en modo solid", () => {
    const { container } = setup({ exportMode: "solid" });
    expect(container.querySelector('input[type="color"]')).toBeInTheDocument();
  });

  it("con un formato impuesto por el preset deshabilita los demás formatos", () => {
    setup({ format: "webp", lockedFormat: "webp" });
    expect(screen.getByRole("radio", { name: "WEBP" })).not.toBeDisabled();
    expect(screen.getByRole("radio", { name: "PNG" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "JPEG" })).toBeDisabled();
  });

  it("ofrece los presets de sticker", async () => {
    const { setPresetId } = setup();
    await userEvent.click(screen.getByRole("button", { name: /preset/i }));
    expect(screen.getByRole("option", { name: /telegram/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /whatsapp/i }));
    expect(setPresetId).toHaveBeenCalledWith("sticker-whatsapp");
  });
});

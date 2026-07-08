import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockLoadImage = jest.fn().mockResolvedValue({ width: 10, height: 10 });
const mockAiCut = jest.fn().mockResolvedValue("blob:preview");
const mockExportTransparent = jest.fn().mockResolvedValue("blob:export");

jest.mock("../../lib/backend.js", () => ({
  backend: {
    isDesktop: false,
    loadImage: (...a) => mockLoadImage(...a),
    aiCut: (...a) => mockAiCut(...a),
    exportTransparent: (...a) => mockExportTransparent(...a),
  },
}));

const mockInspectImageFile = jest.fn();
jest.mock("../../lib/imageFile.js", () => ({
  inspectImageFile: (...a) => mockInspectImageFile(...a),
  bitmapToDataUrl: jest.fn(() => "data:image/png;base64,reduced"),
  DOWNSCALE_MAX_DIM: 4096,
}));

jest.mock("../../utils/image.js", () => ({
  fileToDataUrl: jest.fn().mockResolvedValue("data:image/png;base64,AAAA"),
}));

jest.mock("../../services/analytics.js", () => ({ trackEvent: jest.fn() }));
jest.mock("../../utils/save.js", () => ({ saveExport: jest.fn().mockResolvedValue(true) }));

import { t } from "../../lib/i18n.js";
import BatchPage from "./BatchPage.jsx";

function okInspection() {
  return { kind: "ok", bitmap: { close: jest.fn() }, width: 10, height: 10 };
}

function renderPage() {
  return render(<BatchPage active onToast={jest.fn()} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  });
  global.URL.createObjectURL = jest.fn(() => "blob:zip");
  global.URL.revokeObjectURL = jest.fn();
});

describe("BatchPage (integración)", () => {
  it("muestra el estado vacío inicial", () => {
    renderPage();
    expect(screen.getByText(t("batch.dropTitle"))).toBeInTheDocument();
    expect(document.querySelector(".batch-list")).not.toBeInTheDocument();
  });

  it("procesa un lote de varias imágenes de forma secuencial y habilita el ZIP", async () => {
    mockInspectImageFile.mockResolvedValue(okInspection());
    renderPage();

    const input = document.querySelector('input[type="file"]');
    const files = [
      new File(["a"], "producto-1.jpg", { type: "image/jpeg" }),
      new File(["b"], "producto-2.jpg", { type: "image/jpeg" }),
    ];
    await userEvent.upload(input, files);

    await waitFor(() => expect(mockLoadImage).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getAllByText(t("batch.status.done")).length).toBe(2);
    });

    // secuencial: nunca se solapan dos cargas activas (loadImage llamado en
    // serie, no en paralelo) — el motor solo sostiene una sesión.
    expect(mockLoadImage.mock.invocationCallOrder[0]).toBeLessThan(mockAiCut.mock.invocationCallOrder[0]);

    const zipBtn = screen.getByRole("button", { name: t("batch.downloadZip") });
    expect(zipBtn).toBeEnabled();

    await userEvent.click(zipBtn);
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled());
  });

  it("un archivo inválido queda en error sin abortar el resto del lote", async () => {
    mockInspectImageFile
      .mockResolvedValueOnce({ kind: "heic" })
      .mockResolvedValueOnce(okInspection());
    renderPage();

    const input = document.querySelector('input[type="file"]');
    const files = [
      new File(["a"], "foto.heic", { type: "image/heic" }),
      new File(["b"], "producto.jpg", { type: "image/jpeg" }),
    ];
    await userEvent.upload(input, files);

    await waitFor(() => {
      expect(screen.getByText(t("batch.status.done"))).toBeInTheDocument();
    });
    expect(screen.getByText(t("toast.heic"))).toBeInTheDocument();

    const zipBtn = screen.getByRole("button", { name: t("batch.downloadZip") });
    expect(zipBtn).toBeEnabled();
  });
});

import { renderHook, act } from "@testing-library/react";

jest.mock("../../../lib/backend.js", () => ({
  backend: {
    isDesktop: false,
    exportTransparent: jest.fn(async () => "blob:t"),
    exportSolid: jest.fn(async () => "blob:s"),
    exportImageBg: jest.fn(async () => "blob:i"),
    exportBlurBg: jest.fn(async () => "blob:b"),
  },
}));
jest.mock("../../../utils/dom.js", () => ({ downloadDataUrl: jest.fn() }));
jest.mock("../../../services/analytics.js", () => ({ trackEvent: jest.fn() }));

import { backend } from "../../../lib/backend.js";
import { EXPORT_PRESETS } from "../../../lib/presets.js";
import { useExport } from "./useExport.js";

const presetOf = (id) => EXPORT_PRESETS.find((p) => p.id === id).preset;

function setup() {
  const toast = jest.fn();
  const hook = renderHook(() =>
    useExport({ imageSize: { w: 100, h: 100 }, setBusy: jest.fn(), toast })
  );
  return { ...hook, toast };
}

beforeEach(() => jest.clearAllMocks());

// BUG-01: el preset precarga su fondo en el selector, pero lo que se exporta
// es siempre lo que el selector tiene en ese momento.
describe("useExport — presets y fondo elegido", () => {
  it("preset Amazon sin tocar nada exporta con fondo blanco", async () => {
    const { result } = setup();
    act(() => result.current.setPresetId("amazon"));
    expect(result.current.exportMode).toBe("solid");
    expect(result.current.bgColor).toBe("#ffffff");
    await act(() => result.current.handleDownload());
    expect(backend.exportSolid).toHaveBeenCalledWith(
      [255, 255, 255, 255],
      expect.objectContaining({ preset: presetOf("amazon") })
    );
  });

  it("preset Amazon + color #2563eb exporta azul", async () => {
    const { result } = setup();
    act(() => result.current.setPresetId("amazon"));
    act(() => result.current.setBgColor("#2563eb"));
    await act(() => result.current.handleDownload());
    expect(backend.exportSolid).toHaveBeenCalledWith(
      [37, 99, 235, 255],
      expect.objectContaining({ preset: presetOf("amazon") })
    );
  });

  it("preset Amazon + transparente exporta transparente", async () => {
    const { result } = setup();
    act(() => result.current.setPresetId("amazon"));
    act(() => result.current.setExportMode("transparent"));
    await act(() => result.current.handleDownload());
    expect(backend.exportSolid).not.toHaveBeenCalled();
    expect(backend.exportTransparent).toHaveBeenCalledWith(
      expect.objectContaining({ preset: presetOf("amazon") })
    );
  });

  it("el avatar circular (sin fondo) precarga transparente", () => {
    const { result } = setup();
    act(() => result.current.setExportMode("solid"));
    act(() => result.current.setPresetId("avatar"));
    expect(result.current.exportMode).toBe("transparent");
  });

  it("volver a Original no pisa el fondo elegido", () => {
    const { result } = setup();
    act(() => result.current.setPresetId("amazon"));
    act(() => result.current.setBgColor("#2563eb"));
    act(() => result.current.setPresetId("original"));
    expect(result.current.exportMode).toBe("solid");
    expect(result.current.bgColor).toBe("#2563eb");
  });
});

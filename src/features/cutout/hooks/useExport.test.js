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

// el hook mide el peso de lo exportado leyendo la URL: en jsdom no hay fetch
const sizes = {};
global.fetch = jest.fn(async (url) => ({ blob: async () => ({ size: sizes[url] ?? 1000 }) }));
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

// BUG-06: presets de sticker con formato impuesto y tope de peso (WhatsApp)
describe("useExport — presets de sticker", () => {
  beforeEach(() => {
    for (const k of Object.keys(sizes)) delete sizes[k];
  });

  it("Sticker WhatsApp impone WebP y transparente aunque el formato elegido sea PNG", async () => {
    const { result } = setup();
    act(() => result.current.setFormat("png"));
    act(() => result.current.setExportMode("solid"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    expect(result.current.format).toBe("webp");
    expect(result.current.lockedFormat).toBe("webp");
    expect(result.current.exportMode).toBe("transparent");
    act(() => result.current.setFormat("png")); // aunque alguien lo cambie, sale WebP
    await act(() => result.current.handleDownload());
    expect(backend.exportTransparent).toHaveBeenCalledWith(
      expect.objectContaining({ format: "webp", preset: presetOf("sticker-whatsapp") })
    );
  });

  it("Sticker Telegram impone PNG", async () => {
    const { result } = setup();
    act(() => result.current.setFormat("webp"));
    act(() => result.current.setPresetId("sticker-telegram"));
    expect(result.current.format).toBe("png");
    await act(() => result.current.handleDownload());
    expect(backend.exportTransparent).toHaveBeenCalledWith(
      expect.objectContaining({ format: "png", preset: presetOf("sticker-telegram") })
    );
  });

  it("si el WebP pasa de 100 KB baja la calidad, descarga lo que entra y avisa", async () => {
    // cada calidad devuelve una URL distinta; solo 0.72 entra en 100 KB
    backend.exportTransparent.mockImplementation(async (o) => `blob:q${o.quality.toFixed(2)}`);
    sizes["blob:q0.92"] = 140 * 1024;
    sizes["blob:q0.82"] = 120 * 1024;
    sizes["blob:q0.72"] = 95 * 1024;
    const { result, toast } = setup();
    act(() => result.current.setPresetId("sticker-whatsapp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).toHaveBeenCalledWith("blob:q0.72", expect.stringMatching(/\.webp$/));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/72/), "ok");
  });

  it("al salir del preset de sticker se libera el formato", () => {
    const { result } = setup();
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("original"));
    expect(result.current.lockedFormat).toBeNull();
  });
});

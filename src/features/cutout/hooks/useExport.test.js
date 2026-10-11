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
jest.mock("../../../utils/save.js", () => ({ saveExport: jest.fn(async () => true) }));

import { backend } from "../../../lib/backend.js";

// el hook mide el peso y el tipo real de lo exportado leyendo la URL: en jsdom no hay fetch
const sizes = {};
const types = {};
global.fetch = jest.fn(async (url) => ({
  blob: async () => ({ size: sizes[url] ?? 1000, type: types[url] ?? "" }),
}));
import { t, setLang } from "../../../lib/i18n.js";
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

  // los dos casos parten de un fondo distinto al del preset: sin la precarga
  // el estado quedaría igual y el test lo detecta (el default ya es #ffffff)
  it("con #2563eb elegido, elegir Amazon precarga Color #ffffff", () => {
    const { result } = setup();
    act(() => result.current.setExportMode("solid"));
    act(() => result.current.setBgColor("#2563eb"));
    act(() => result.current.setPresetId("amazon"));
    expect(result.current.exportMode).toBe("solid");
    expect(result.current.bgColor).toBe("#ffffff");
  });

  it("con rojo elegido, elegir el avatar precarga transparente", () => {
    const { result } = setup();
    act(() => result.current.setExportMode("solid"));
    act(() => result.current.setBgColor("#ff0000"));
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

// QA O3: si el preset cambió el fondo que había, se avisa (y solo entonces)
describe("useExport — aviso cuando el preset cambia el fondo", () => {
  it("avisa al pasar de un color a Amazon (fondo blanco)", () => {
    const { result, toast } = setup();
    act(() => result.current.setExportMode("solid"));
    act(() => result.current.setBgColor("#2563eb"));
    act(() => result.current.setPresetId("amazon"));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatch(/white|blanco|branco/i);
  });

  it("avisa al pasar de un color al avatar (transparente)", () => {
    const { result, toast } = setup();
    act(() => result.current.setExportMode("solid"));
    act(() => result.current.setPresetId("avatar"));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatch(/transparen/i);
  });

  it("no avisa si el fondo ya era el del preset", () => {
    const { result, toast } = setup();
    act(() => result.current.setPresetId("avatar")); // ya estaba en transparente
    act(() => result.current.setPresetId("amazon")); // transparente → blanco: avisa una vez
    act(() => result.current.setPresetId("shopify")); // blanco → blanco: no avisa
    act(() => result.current.setPresetId("original")); // no trae fondo
    expect(toast).toHaveBeenCalledTimes(1);
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

describe("useExport — el archivo se nombra por lo que ES (GROW-35)", () => {
  const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
  const EXT = { png: "png", jpeg: "jpg", webp: "webp" };
  beforeEach(() => {
    for (const k of Object.keys(types)) delete types[k];
    for (const k of Object.keys(sizes)) delete sizes[k];
  });
  afterEach(() => backend.exportTransparent.mockImplementation(async () => "blob:t"));

  it("el nombre siempre coincide con el contenido, pida lo que pida", async () => {
    const { downloadDataUrl } = require("../../../utils/dom.js");
    const { result } = setup();
    act(() => result.current.setExportMode("solid"));
    for (const asked of ["png", "jpeg", "webp"])
      for (const got of ["png", "jpeg", "webp"]) {
        types["blob:s"] = MIME[got];
        act(() => result.current.setFormat(asked));
        await act(() => result.current.handleDownload());
        expect(downloadDataUrl).toHaveBeenLastCalledWith("blob:s", `photocut-solid.${EXT[got]}`);
      }
  });

  it("pedí WebP y el navegador dio PNG: baja .png, avisa y la analítica cuenta PNG", async () => {
    types["blob:t"] = "image/png";
    const { result, toast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    const { trackEvent } = require("../../../services/analytics.js");
    expect(downloadDataUrl).toHaveBeenCalledWith("blob:t", "photocut-transparent.png");
    expect(toast).toHaveBeenCalledWith(t("export.formatFallback", { want: "WEBP", got: "PNG" }), "error");
    expect(trackEvent).toHaveBeenCalledWith("export", { kind: "transparent", format: "png" });
  });

  it("sticker WhatsApp en un motor que da PNG: .png y aviso de formato, no de peso", async () => {
    backend.exportTransparent.mockImplementation(async (o) => `blob:q${o.quality.toFixed(2)}`);
    for (const q of ["0.92", "0.82", "0.72", "0.62", "0.52", "0.42", "0.32"]) {
      sizes[`blob:q${q}`] = 164 * 1024;
      types[`blob:q${q}`] = "image/png";
    }
    const { result, toast } = setup();
    act(() => result.current.setPresetId("sticker-whatsapp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), "photocut-transparent.png");
    expect(toast).toHaveBeenCalledWith(t("export.formatFallback", { want: "WEBP", got: "PNG" }), "error");
    expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/164 KB/), "error");
  });

  it("en escritorio el nombre (y con él el filtro del diálogo) sale del tipo real", async () => {
    const { saveExport } = require("../../../utils/save.js");
    backend.isDesktop = true;
    try {
      types["blob:t"] = "image/png";
      const { result } = setup();
      act(() => result.current.setFormat("webp"));
      await act(() => result.current.handleDownload());
      expect(saveExport).toHaveBeenCalledWith("blob:t", "photocut-transparent.png");
    } finally {
      backend.isDesktop = false;
    }
  });
});

describe("useExport — si el encoder WebP falla (GROW-35, A4)", () => {
  afterEach(() => {
    backend.exportTransparent.mockImplementation(async () => "blob:t");
    setLang("es");
  });

  it("no descarga nada, avisa en el idioma de la UI y el panel queda igual", async () => {
    backend.exportTransparent.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: load: Failed to fetch"));
    const { result, toast } = setup();
    act(() => setLang("en"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith("Couldn't prepare the WebP. Try again with a connection or choose PNG", "error");
    expect(result.current.presetId).toBe("sticker-whatsapp");
    expect(result.current.format).toBe("webp");
    expect(result.current.exportMode).toBe("transparent");
  });

  it("una imagen de más de 16383 px tampoco cae a PNG: mismo aviso, sin archivo", async () => {
    backend.exportTransparent.mockRejectedValue(new Error("WEBP_ENCODE_FAILED: 16384×900 supera 16383 px"));
    const { result, toast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.handleDownload());
    const { downloadDataUrl } = require("../../../utils/dom.js");
    expect(downloadDataUrl).not.toHaveBeenCalled();
    expect(toast).toHaveBeenLastCalledWith(t("export.webpFailed"), "error");
  });
});

describe("useExport — D2: el formato que impone un sticker no queda pegado", () => {
  it("Sticker WhatsApp → Original vuelve al formato previo y avisa en los dos cambios", () => {
    const { result, toast } = setup();
    act(() => result.current.setFormat("jpeg"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    expect(result.current.format).toBe("webp");
    expect(toast).toHaveBeenCalledWith(t("export.presetFormat", { fmt: "WEBP" }), "ok");
    act(() => result.current.setPresetId("original"));
    expect(result.current.format).toBe("jpeg");
    expect(toast).toHaveBeenLastCalledWith(t("export.formatRestored", { fmt: "JPEG" }), "ok");
  });

  it("WhatsApp → Telegram → Original vuelve al formato de ANTES del primer sticker", () => {
    const { result } = setup();
    act(() => result.current.setFormat("jpeg"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("sticker-telegram"));
    expect(result.current.format).toBe("png");
    act(() => result.current.setPresetId("original"));
    expect(result.current.format).toBe("jpeg");
  });

  it("pasar de un sticker a un preset sin formato (Amazon) también lo devuelve", () => {
    const { result } = setup();
    act(() => result.current.setFormat("jpeg"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("amazon"));
    expect(result.current.format).toBe("jpeg");
  });

  it("si el formato previo ya era el del preset, no hay aviso de formato", () => {
    const { result, toast } = setup();
    act(() => result.current.setFormat("webp"));
    act(() => result.current.setPresetId("sticker-whatsapp"));
    act(() => result.current.setPresetId("original"));
    expect(toast).not.toHaveBeenCalledWith(t("export.presetFormat", { fmt: "WEBP" }), "ok");
    expect(toast).not.toHaveBeenCalledWith(t("export.formatRestored", { fmt: "WEBP" }), "ok");
    expect(result.current.format).toBe("webp");
  });
});

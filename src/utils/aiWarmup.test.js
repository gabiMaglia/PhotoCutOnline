import { setLang, t } from "../lib/i18n.js";
import { formatAiProgress, warmupAiWithToast } from "./aiWarmup.js";

describe("formatAiProgress (GROW-27 e)", () => {
  afterAll(() => setLang("es"));

  it.each([
    ["es", "Descargando modelo… 42%", "Iniciando…"],
    ["en", "Downloading model… 42%", "Starting…"],
    ["pt", "Baixando modelo… 42%", "Iniciando…"],
  ])("etapas en %s", (lang, dl, init) => {
    setLang(lang);
    expect(formatAiProgress({ stage: "model", loaded: 420, total: 1000 })).toBe(dl);
    expect(formatAiProgress({ stage: "init" })).toBe(init);
  });

  it("sin total conocido muestra la descarga indeterminada (sin %) y nunca pasa de 99%", () => {
    setLang("es");
    expect(formatAiProgress({ stage: "model", loaded: 10, total: 0 })).toBe("Descargando modelo…");
    expect(formatAiProgress({ stage: "model", loaded: 1000, total: 1000 })).toBe("Descargando modelo… 99%");
  });

  it("el aviso inicial dice el peso real (~7 MB) en los 3 idiomas", () => {
    for (const lang of ["es", "en", "pt"]) {
      setLang(lang);
      expect(t("toast.aiDownloading")).toContain("7 MB");
      expect(t("toast.aiDownloading")).not.toContain("18");
    }
  });
});

describe("warmupAiWithToast", () => {
  it("muestra un toast fijo, lo actualiza con el progreso y lo retira al terminar", async () => {
    setLang("es");
    const toast = jest.fn(() => 7);
    toast.update = jest.fn();
    toast.dismiss = jest.fn();
    const warmup = jest.fn(async (onProgress) => {
      onProgress({ stage: "model", loaded: 50, total: 100 });
      onProgress({ stage: "init" });
    });
    await warmupAiWithToast(toast, warmup);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("7 MB"), "ok", { sticky: true });
    expect(toast.update).toHaveBeenNthCalledWith(1, 7, "Descargando modelo… 50%");
    expect(toast.update).toHaveBeenNthCalledWith(2, 7, "Iniciando…");
    expect(toast.dismiss).toHaveBeenCalledWith(7);
  });

  it("retira el toast aunque la descarga falle", async () => {
    const toast = jest.fn(() => 3);
    toast.update = jest.fn();
    toast.dismiss = jest.fn();
    await expect(
      warmupAiWithToast(toast, async () => {
        throw new Error("sin red");
      })
    ).rejects.toThrow("sin red");
    expect(toast.dismiss).toHaveBeenCalledWith(3);
  });
});

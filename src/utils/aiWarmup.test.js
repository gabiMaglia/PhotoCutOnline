import { setLang, t } from "../lib/i18n.js";
import { aiNoticeHandler, formatAiProgress, warmupAiWithToast } from "./aiWarmup.js";

describe("formatAiProgress (GROW-27 e)", () => {
  afterAll(() => setLang("es"));

  it.each([
    ["es", "Descargando modelo… 42% de 115 MB", "Iniciando…"],
    ["en", "Downloading model… 42% of 115 MB", "Starting…"],
    ["pt", "Baixando modelo… 42% de 115 MB", "Iniciando…"],
  ])("etapas en %s (GROW-36: con el peso real del camino elegido)", (lang, dl, init) => {
    setLang(lang);
    expect(formatAiProgress({ stage: "model", loaded: 48_300_000, total: 114_834_127 })).toBe(dl);
    expect(formatAiProgress({ stage: "init" })).toBe(init);
  });

  it("sin total conocido muestra la descarga indeterminada (sin %) y nunca pasa de 99%", () => {
    setLang("es");
    expect(formatAiProgress({ stage: "model", loaded: 10, total: 0 })).toBe("Descargando modelo…");
    expect(formatAiProgress({ stage: "model", loaded: 4_574_861, total: 4_574_861 })).toBe("Descargando modelo… 99% de 4,6 MB");
  });

  it("el aviso inicial no promete un peso: depende de si hay GPU (GROW-36); el % dice el real", () => {
    for (const lang of ["es", "en", "pt"]) {
      setLang(lang);
      expect(t("toast.aiDownloading")).not.toMatch(/MB/);
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
      onProgress({ stage: "model", loaded: 2_287_431, total: 4_574_861 });
      onProgress({ stage: "init" });
    });
    await warmupAiWithToast(toast, warmup);
    expect(toast).toHaveBeenCalledWith(t("toast.aiDownloading"), "ok", { sticky: true });
    expect(toast.update).toHaveBeenNthCalledWith(1, 7, "Descargando modelo… 50% de 4,6 MB");
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

describe("aviso de respaldo al modelo liviano (GROW-36)", () => {
  afterAll(() => setLang("es"));

  it.each([
    ["es", /modelo liviano/],
    ["en", /lighter model/],
    ["pt", /modelo leve/],
  ])("%s: el aviso existe y es honesto (dice que se usó el liviano y que los bordes son menos finos)", (lang, re) => {
    setLang(lang);
    const txt = t("toast.aiFallback");
    expect(txt).not.toBe("toast.aiFallback");
    expect(txt).toMatch(re);
  });

  it("aiNoticeHandler muestra el aviso solo para la etapa fallback", () => {
    setLang("es");
    const toast = jest.fn();
    const on = aiNoticeHandler(toast);
    on({ stage: "model", loaded: 1, total: 2 });
    on({ stage: "init" });
    expect(toast).not.toHaveBeenCalled();
    on({ stage: "fallback", model: "u2netp" });
    expect(toast).toHaveBeenCalledWith(t("toast.aiFallback"), "ok");
  });

  it("warmupAiWithToast avisa el respaldo sin pisar el toast de progreso con ese texto", async () => {
    setLang("es");
    const toast = jest.fn(() => 9);
    toast.update = jest.fn();
    toast.dismiss = jest.fn();
    await warmupAiWithToast(toast, async (onProgress) => {
      onProgress({ stage: "fallback", model: "u2netp" });
      onProgress({ stage: "init" });
    });
    expect(toast).toHaveBeenCalledWith(t("toast.aiFallback"), "ok");
    expect(toast.update).toHaveBeenCalledTimes(1);
    expect(toast.update).toHaveBeenCalledWith(9, "Iniciando…");
  });
});

import { renderHook, act } from "@testing-library/react";

jest.mock("../../../lib/backend.js", () => ({
  backend: {
    canUndo: () => false,
    canRedo: () => false,
    wand: jest.fn().mockResolvedValue("blob:wand"),
    cutRect: jest.fn().mockResolvedValue("blob:rect"),
    aiCut: jest.fn(async (onProgress) => {
      onProgress?.({ stage: "fallback", model: "u2netp" });
      return "blob:ai";
    }),
  },
}));
jest.mock("../../../services/analytics.js", () => ({ trackEvent: jest.fn() }));
jest.mock("../../../utils/aiWarmup.js", () => ({
  warmupAiWithToast: jest.fn(),
  aiNoticeHandler: (toast) => (p) => p?.stage === "fallback" && toast("AVISO_RESPALDO", "ok"),
}));

import { useCutoutSession } from "./useCutoutSession.js";

const setup = () => renderHook(() => useCutoutSession({ imageUrl: "blob:img", toast: jest.fn() }));

describe("useCutoutSession: modo activo tras cada operación", () => {
  it("tras la varita sigue activa la varita (shift+clic debe quitar otra zona, no pintar)", async () => {
    const { result } = setup();
    act(() => result.current.setMode("wand"));
    await act(() => result.current.handleWand({ x: 5, y: 5 }, false));
    expect(result.current.hasCut).toBe(true);
    expect(result.current.mode).toBe("wand");
  });

  it("tras Recortar área pasa al pincel mantener (comportamiento previo)", async () => {
    const { result } = setup();
    await act(() => result.current.handleRect({ x: 0, y: 0, w: 10, h: 10 }));
    expect(result.current.mode).toBe("fg");
  });
});

describe("useCutoutSession: Recorte IA avisa si se usó el modelo liviano (GROW-36)", () => {
  it("el aviso que manda aiCut llega al toast", async () => {
    const toast = jest.fn();
    const { result } = renderHook(() => useCutoutSession({ imageUrl: "blob:img", toast }));
    await act(() => result.current.handleAi());
    expect(toast).toHaveBeenCalledWith("AVISO_RESPALDO", "ok");
    expect(result.current.hasCut).toBe(true);
  });
});

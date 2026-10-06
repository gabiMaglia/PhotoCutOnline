import { renderHook, act } from "@testing-library/react";

jest.mock("../../../lib/backend.js", () => ({
  backend: {
    canUndo: () => false,
    canRedo: () => false,
    wand: jest.fn().mockResolvedValue("blob:wand"),
    cutRect: jest.fn().mockResolvedValue("blob:rect"),
  },
}));
jest.mock("../../../services/analytics.js", () => ({ trackEvent: jest.fn() }));
jest.mock("../../../utils/aiWarmup.js", () => ({ warmupAiWithToast: jest.fn() }));

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

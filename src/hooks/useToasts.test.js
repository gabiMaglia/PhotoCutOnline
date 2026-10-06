import { renderHook, act } from "@testing-library/react";
import { useToasts } from "./useToasts.js";

describe("useToasts", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("autodescarta a los 3.4 s", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.toast("hola");
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => jest.advanceTimersByTime(3400));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("un toast sticky no se autodescarta; update cambia el texto y dismiss lo retira", () => {
    const { result } = renderHook(() => useToasts());
    let id;
    act(() => {
      id = result.current.toast("Descargando…", "ok", { sticky: true });
    });
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.toasts).toHaveLength(1);

    act(() => result.current.toast.update(id, "Descargando… 50%"));
    expect(result.current.toasts[0].text).toBe("Descargando… 50%");

    act(() => result.current.toast.dismiss(id));
    expect(result.current.toasts).toHaveLength(0);
  });
});

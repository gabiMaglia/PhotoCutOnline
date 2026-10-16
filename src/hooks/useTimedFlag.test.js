import { renderHook, act } from "@testing-library/react";
import { useTimedFlag } from "./useTimedFlag.js";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useTimedFlag", () => {
  it("trigger enciende y se apaga solo al cumplirse el plazo", () => {
    const { result } = renderHook(() => useTimedFlag(2500));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => jest.advanceTimersByTime(2499));
    expect(result.current[0]).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current[0]).toBe(false);
  });

  it("un trigger nuevo reinicia el plazo", () => {
    const { result } = renderHook(() => useTimedFlag(1000));
    act(() => result.current[1]());
    act(() => jest.advanceTimersByTime(800));
    act(() => result.current[1]());
    act(() => jest.advanceTimersByTime(800));
    expect(result.current[0]).toBe(true);
    act(() => jest.advanceTimersByTime(200));
    expect(result.current[0]).toBe(false);
  });

  it("clear lo apaga antes de tiempo y al desmontar no queda timer vivo", () => {
    const { result, unmount } = renderHook(() => useTimedFlag(1000));
    act(() => result.current[1]());
    act(() => result.current[2]());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

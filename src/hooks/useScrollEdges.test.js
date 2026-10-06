import { renderHook, act } from "@testing-library/react";
import { computeEdges, useScrollEdges } from "./useScrollEdges.js";

describe("computeEdges", () => {
  it("al inicio: solo hay más a la derecha", () => {
    expect(computeEdges({ scrollLeft: 0, clientWidth: 100, scrollWidth: 400 })).toEqual({ left: false, right: true });
  });
  it("en el medio: más a ambos lados", () => {
    expect(computeEdges({ scrollLeft: 100, clientWidth: 100, scrollWidth: 400 })).toEqual({ left: true, right: true });
  });
  it("al final: solo hay más a la izquierda (tolera fracciones)", () => {
    expect(computeEdges({ scrollLeft: 299.6, clientWidth: 100, scrollWidth: 400 })).toEqual({ left: true, right: false });
  });
  it("si todo entra, no hay pistas", () => {
    expect(computeEdges({ scrollLeft: 0, clientWidth: 400, scrollWidth: 400 })).toEqual({ left: false, right: false });
  });
});

describe("useScrollEdges", () => {
  it("se actualiza con el evento scroll", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 100 });
    Object.defineProperty(el, "scrollWidth", { value: 400 });
    el.scrollLeft = 0;
    const { result } = renderHook(() => useScrollEdges(el));
    expect(result.current).toEqual({ left: false, right: true });
    act(() => {
      el.scrollLeft = 300;
      el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toEqual({ left: true, right: false });
  });
});

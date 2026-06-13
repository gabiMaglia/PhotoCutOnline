import { clampNum } from "./math.js";

describe("clampNum", () => {
  it("acota dentro del rango", () => {
    expect(clampNum(5, 0, 10)).toBe(5);
    expect(clampNum(-3, 0, 10)).toBe(0);
    expect(clampNum(99, 0, 10)).toBe(10);
  });
});

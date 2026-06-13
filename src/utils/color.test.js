import { hexToRgba } from "./color.js";

describe("hexToRgba", () => {
  it("convierte hex de 6 dígitos a [r,g,b,255]", () => {
    expect(hexToRgba("#ffffff")).toEqual([255, 255, 255, 255]);
    expect(hexToRgba("#000000")).toEqual([0, 0, 0, 255]);
    expect(hexToRgba("#ff5e63")).toEqual([255, 94, 99, 255]);
  });

  it("tolera hex sin almohadilla", () => {
    expect(hexToRgba("0a141e")).toEqual([10, 20, 30, 255]);
  });
});

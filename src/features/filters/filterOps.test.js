import { buildOps, PRESET_OPS } from "./filterOps.js";

// BUG-09: la UI arma una lista de operaciones (no un string CSS) en el mismo
// orden en que hoy arma el string: preset, brillo, contraste, saturación.
describe("buildOps", () => {
  it("Vívido + los tres ajustes, en orden", () => {
    expect(buildOps("vivid", 130, 140, 150)).toEqual([
      { op: "saturate", amount: 1.4 },
      { op: "contrast", amount: 1.08 },
      { op: "brightness", amount: 1.3 },
      { op: "contrast", amount: 1.4 },
      { op: "saturate", amount: 1.5 },
    ]);
  });

  it("sin preset y sliders al 100 % no hay nada que aplicar", () => {
    expect(buildOps("none", 100, 100, 100)).toEqual([]);
  });

  it("omite solo los ajustes neutros", () => {
    expect(buildOps("bw", 100, 50, 100)).toEqual([
      { op: "grayscale", amount: 1 },
      { op: "contrast", amount: 0.5 },
    ]);
  });

  it("los presets de hoy conservan sus valores", () => {
    expect(PRESET_OPS).toEqual({
      none: [],
      bw: [{ op: "grayscale", amount: 1 }],
      sepia: [{ op: "sepia", amount: 0.75 }],
      vivid: [{ op: "saturate", amount: 1.4 }, { op: "contrast", amount: 1.08 }],
      soft: [{ op: "contrast", amount: 0.92 }, { op: "brightness", amount: 1.04 }],
    });
  });
});

/** @jest-environment node */
jest.mock("./webpWasm.js", () => ({
  ...jest.requireActual("./webpWasm.js"),
  encodeWebPDirect: jest.fn(async () => new Blob([new Uint8Array(3)], { type: "image/webp" })),
}));
const { encodeWebPDirect } = require("./webpWasm.js");
const { encodeWebP } = require("./webpEncoder.js");

it("dentro de un worker (sin document) codifica directo, sin crear otro worker", async () => {
  global.Worker = jest.fn();
  const im = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
  const b = await encodeWebP(im, 0.6);
  expect(encodeWebPDirect).toHaveBeenCalledWith(im, 0.6);
  expect(global.Worker).not.toHaveBeenCalled();
  expect(b.type).toBe("image/webp");
});

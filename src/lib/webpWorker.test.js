/** @jest-environment node */
jest.mock("./webpWasm.js", () => ({ ...jest.requireActual("./webpWasm.js"), encodeWebPDirect: jest.fn() }));
const { encodeWebPDirect, WebpEncodeError } = require("./webpWasm.js");
global.self = { postMessage: jest.fn() };
require("./webpWorker.js");

beforeEach(() => jest.clearAllMocks());

it("codifica los píxeles recibidos y devuelve los bytes transferidos", async () => {
  encodeWebPDirect.mockResolvedValue(new Blob([new Uint8Array([9, 9])], { type: "image/webp" }));
  await self.onmessage({ data: { id: 7, width: 1, height: 1, buffer: new ArrayBuffer(4), quality: 0.5 } });
  expect(encodeWebPDirect).toHaveBeenCalledWith(
    { data: expect.any(Uint8ClampedArray), width: 1, height: 1 },
    0.5
  );
  const [msg, transfer] = self.postMessage.mock.calls[0];
  expect(msg).toMatchObject({ id: 7, ok: true });
  expect(msg.buffer.byteLength).toBe(2);
  expect(transfer).toEqual([msg.buffer]);
});

it("un error del encoder vuelve como ok:false con la marca WebP", async () => {
  encodeWebPDirect.mockRejectedValue(new WebpEncodeError("encode: OOM"));
  await self.onmessage({ data: { id: 8, width: 1, height: 1, buffer: new ArrayBuffer(4), quality: 0.5 } });
  expect(self.postMessage).toHaveBeenCalledWith({
    id: 8,
    ok: false,
    error: expect.stringContaining("WEBP_ENCODE_FAILED"),
  });
});

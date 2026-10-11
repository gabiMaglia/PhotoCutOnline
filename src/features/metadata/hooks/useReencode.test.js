jest.mock("../../../lib/metadata.js", () => ({
  ...jest.requireActual("../../../lib/metadata.js"),
  reencodeToBlob: jest.fn(),
  hasTransparency: jest.fn(() => false),
}));
import { renderHook, act } from "@testing-library/react";
import { reencodeToBlob } from "../../../lib/metadata.js";
import { t } from "../../../lib/i18n.js";
import { useReencode } from "./useReencode.js";

const INFO = { name: "foto.png", type: "image/png", width: 40, height: 30, bytes: 5000 };
const blobOf = (type) => new Blob([new Uint8Array(10)], { type });
let clicked;

beforeEach(() => {
  jest.clearAllMocks();
  clicked = [];
  global.URL.createObjectURL = jest.fn(() => "blob:x");
  global.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    clicked.push(this.download);
  });
  reencodeToBlob.mockResolvedValue(blobOf("image/png"));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function setup() {
  const onToast = jest.fn();
  const imgRef = { current: { naturalWidth: 40, naturalHeight: 30 } };
  const hook = renderHook(() => useReencode({ imgRef, info: INFO, onToast }));
  return { ...hook, onToast };
}

describe("useReencode — la descarga se nombra por lo que ES (GROW-35)", () => {
  it("pedí WebP y vino PNG: baja foto.png y avisa", async () => {
    const { result, onToast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.download());
    expect(clicked).toEqual(["foto.png"]);
    expect(onToast).toHaveBeenCalledWith(t("export.formatFallback", { want: "WEBP", got: "PNG" }), "error");
  });

  it("WebP real: baja foto.webp sin aviso", async () => {
    reencodeToBlob.mockResolvedValue(blobOf("image/webp"));
    const { result, onToast } = setup();
    act(() => result.current.setFormat("webp"));
    await act(() => result.current.download());
    expect(clicked).toEqual(["foto.webp"]);
    expect(onToast).not.toHaveBeenCalled();
  });
});

describe("useReencode — estimación sin apilar codificaciones (A1)", () => {
  it("con una en vuelo, los cambios intermedios no lanzan otra: corre solo la última", async () => {
    jest.useFakeTimers();
    let release;
    reencodeToBlob.mockImplementationOnce(() => new Promise((r) => (release = r)));
    reencodeToBlob.mockResolvedValue(blobOf("image/webp"));
    const { result } = setup();
    await act(async () => jest.advanceTimersByTime(250)); // la 1ª queda en vuelo
    for (const q of [70, 60, 50]) {
      act(() => result.current.setQuality(q));
      await act(async () => jest.advanceTimersByTime(250));
    }
    expect(reencodeToBlob).toHaveBeenCalledTimes(1);
    await act(async () => release(blobOf("image/png")));
    expect(reencodeToBlob).toHaveBeenCalledTimes(2);
    expect(reencodeToBlob.mock.calls[1][1].quality).toBe(0.5);
  });
});

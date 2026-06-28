// CanvasEditor pinta el preview vía ImageBitmap (backend.previewBitmap()),
// nunca con `new Image()` (T-002b/D2 QA).
import { render } from "@testing-library/react";

const drawImageCalls = [];

jest.mock("../../lib/backend.js", () => ({
  backend: {
    previewBitmap: jest.fn(),
  },
}));

import { backend } from "../../lib/backend.js";
import CanvasEditor from "./CanvasEditor.jsx";

function fakeBitmap() {
  return { __isImageBitmap: true };
}

beforeAll(() => {
  // jsdom no implementa un 2d context real; se stubea lo que usa el efecto
  // de pintado de resultado (clearRect/drawImage) y se registra cada
  // drawImage para poder afirmar CON QUÉ se pintó.
  HTMLCanvasElement.prototype.getContext = function fakeGetContext() {
    return {
      clearRect() {},
      drawImage(img, ...rest) {
        drawImageCalls.push({ img, rest });
      },
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      putImageData() {},
      getImageData() {
        return { data: new Uint8ClampedArray(4) };
      },
    };
  };
});

beforeEach(() => {
  drawImageCalls.length = 0;
  backend.previewBitmap.mockReset();
});

// La capa base (imageUrl) legítimamente sigue usando `new Image()` (no es
// parte de T-002b, que solo cubre el preview de resultado). Lo que este test
// detecta es que el RESULTADO (resultUrl/bitmap) nunca pase por `new
// Image()` — por eso se registra el `src` con el que se construyó cada
// Image y se descarta el de la capa base.
function installImageSpy() {
  const calls = [];
  const RealImage = global.Image;
  function SpyImage(...args) {
    const inst = new RealImage(...args);
    calls.push(inst);
    return inst;
  }
  SpyImage.prototype = RealImage.prototype;
  global.Image = SpyImage;
  return {
    calls,
    restore() {
      global.Image = RealImage;
    },
  };
}

describe("CanvasEditor — pintado de resultado vía bitmap", () => {
  test("cuando backend.previewBitmap() devuelve un bitmap, lo pinta directo con drawImage sin pasar por new Image()", () => {
    const bitmap = fakeBitmap();
    backend.previewBitmap.mockReturnValue(bitmap);
    const imgSpy = installImageSpy();

    render(
      <CanvasEditor
        imageUrl="blob:fake/base-1"
        imageSize={{ width: 10, height: 10 }}
        resultUrl="blob:fake/result-1"
        mode="rect"
        brushSize={20}
        onRect={() => {}}
        onStroke={() => {}}
        onWand={() => {}}
        busy={false}
        compare={false}
        onCompareChange={() => {}}
      />
    );

    const resultDraws = drawImageCalls.filter((c) => c.img === bitmap);
    expect(resultDraws.length).toBeGreaterThanOrEqual(1);
    // ninguna de las Image() construidas (la capa base sí crea una, vía
    // imageUrl) terminó apuntando al resultUrl: el resultado no se decodificó
    // con new Image() en ningún momento.
    expect(imgSpy.calls.some((img) => img.src.includes("result-1"))).toBe(false);

    imgSpy.restore();
  });
});

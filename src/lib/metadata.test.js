import { basicInfo, orientationLabel, parseExif, reencodeToBlob, stripToBlob, OUTPUT_FORMATS } from "./metadata.js";

describe("basicInfo", () => {
  it("formatea peso en KB o MB según el tamaño", () => {
    const small = basicInfo({ name: "a.jpg", type: "image/jpeg", size: 500 * 1024, lastModified: 0 }, null);
    expect(small.size).toBe("500 KB");
    const big = basicInfo({ name: "b.jpg", type: "image/jpeg", size: 3 * 1024 * 1024, lastModified: 0 }, null);
    expect(big.size).toBe("3.00 MB");
  });

  it("toma las dimensiones de la imagen si está disponible", () => {
    const info = basicInfo({ name: "x.png", type: "image/png", size: 1024 }, { naturalWidth: 800, naturalHeight: 600 });
    expect(info.width).toBe(800);
    expect(info.height).toBe(600);
  });

  it("lastModified 0/ausente → modified null", () => {
    expect(basicInfo({ name: "x", type: "", size: 10, lastModified: 0 }, null).modified).toBeNull();
  });
});

describe("orientationLabel", () => {
  it("mapea los valores EXIF conocidos", () => {
    expect(orientationLabel(1)).toBe("Normal");
    expect(orientationLabel(6)).toBe("Rotada 90° CW");
  });
  it("devuelve el número como texto si no lo conoce, o undefined si falta", () => {
    expect(orientationLabel(99)).toBe("99");
    expect(orientationLabel(undefined)).toBeUndefined();
  });
});

describe("parseExif (defensivo)", () => {
  it("devuelve null si no es JPEG", () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG magic
    expect(parseExif(buf)).toBeNull();
  });

  it("devuelve null en un JPEG sin APP1/EXIF", () => {
    // SOI + EOI, sin segmentos EXIF
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
    expect(parseExif(buf)).toBeNull();
  });

  it("no rompe con bytes basura tras el SOI", () => {
    const buf = new Uint8Array([0xff, 0xd8, 0x12, 0x34, 0x56, 0x78]).buffer;
    expect(parseExif(buf)).toBeNull();
  });
});

// ── T-014: re-encode (comprimir/convertir) ────────────────────────────────────
// jsdom no trae un canvas 2d real (no hay paquete `canvas` en el proyecto), así
// que se stubea lo mínimo y se verifica la LÓGICA: qué mime/quality se le pide
// al canvas y si se rellena el fondo antes de dibujar. El resultado visual real
// lo cubre el harness de Chrome.
describe("reencodeToBlob / OUTPUT_FORMATS", () => {
  let calls;
  const img = { naturalWidth: 40, naturalHeight: 30 };

  beforeEach(() => {
    calls = { toBlob: [], ops: [], fillStyle: null };
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag !== "canvas") return {};
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          set fillStyle(v) {
            calls.fillStyle = v;
          },
          get fillStyle() {
            return calls.fillStyle;
          },
          fillRect: (...a) => calls.ops.push(["fillRect", ...a]),
          drawImage: (...a) => calls.ops.push(["drawImage", a.length]),
          getImageData: () => ({ data: new Uint8ClampedArray(40 * 30 * 4).fill(255) }),
        }),
        toBlob: (cb, mime, q) => {
          calls.toBlob.push({ mime, q });
          cb(new Blob([], { type: mime }));
        },
      };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it("png: sin pérdida → NO se le pasa quality al canvas", async () => {
    await reencodeToBlob(img, { format: "png", quality: 0.5 });
    expect(calls.toBlob[0]).toEqual({ mime: "image/png", q: undefined });
  });

  it("jpeg/webp: con pérdida → se le pasa quality", async () => {
    await reencodeToBlob(img, { format: "jpeg", quality: 0.6 });
    expect(calls.toBlob[0]).toEqual({ mime: "image/jpeg", q: 0.6 });
    await reencodeToBlob(img, { format: "webp", quality: 0.4 });
    expect(calls.toBlob[1]).toEqual({ mime: "image/webp", q: 0.4 });
  });

  // El gotcha: JPG no tiene alfa y el canvas compone lo transparente sobre
  // NEGRO. Sin este relleno, un logo transparente → JPG sale con fondo negro.
  it("jpeg: rellena el fondo ANTES de dibujar (si no, lo transparente sale negro)", async () => {
    await reencodeToBlob(img, { format: "jpeg" });
    const fill = calls.ops.findIndex((o) => o[0] === "fillRect");
    const draw = calls.ops.findIndex((o) => o[0] === "drawImage");
    expect(fill).toBeGreaterThanOrEqual(0);
    expect(fill).toBeLessThan(draw); // el relleno va primero o no sirve de nada
    expect(calls.fillStyle).toBe("#ffffff"); // blanco, no negro
  });

  it("jpeg: respeta un background explícito", async () => {
    await reencodeToBlob(img, { format: "jpeg", background: "#ff0000" });
    expect(calls.fillStyle).toBe("#ff0000");
  });

  it("png/webp: NO rellenan (conservan la transparencia)", async () => {
    await reencodeToBlob(img, { format: "png" });
    expect(calls.ops.some((o) => o[0] === "fillRect")).toBe(false);
    await reencodeToBlob(img, { format: "webp" });
    expect(calls.ops.some((o) => o[0] === "fillRect")).toBe(false);
  });

  it("stripToBlob sigue funcionando y delega en reencodeToBlob", async () => {
    const blob = await stripToBlob(img, "image/jpeg", 0.8);
    expect(blob.type).toBe("image/jpeg");
    expect(calls.toBlob[0]).toEqual({ mime: "image/jpeg", q: 0.8 });
  });

  it("OUTPUT_FORMATS declara bien pérdida y alfa por formato", () => {
    expect(OUTPUT_FORMATS.png).toMatchObject({ lossy: false, alpha: true });
    expect(OUTPUT_FORMATS.jpeg).toMatchObject({ lossy: true, alpha: false });
    expect(OUTPUT_FORMATS.webp).toMatchObject({ lossy: true, alpha: true });
  });
});

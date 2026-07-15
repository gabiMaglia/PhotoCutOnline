import { basicInfo, orientationLabel, parseExif } from "./metadata.js";

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

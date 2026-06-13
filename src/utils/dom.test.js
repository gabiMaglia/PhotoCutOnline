import { pointInRect, downloadDataUrl } from "./dom.js";

describe("pointInRect", () => {
  const rect = { left: 10, top: 10, right: 100, bottom: 50 };
  it("detecta puntos dentro y fuera", () => {
    expect(pointInRect(rect, 50, 30)).toBe(true);
    expect(pointInRect(rect, 5, 30)).toBe(false); // a la izquierda
    expect(pointInRect(rect, 50, 80)).toBe(false); // debajo
  });
  it("devuelve false si no hay rect", () => {
    expect(pointInRect(null, 50, 30)).toBe(false);
  });
});

describe("downloadDataUrl", () => {
  it("crea un <a download> y lo dispara", () => {
    const click = jest.fn();
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = click;
    downloadDataUrl("data:text/plain,hola", "f.txt");
    expect(click).toHaveBeenCalled();
    HTMLAnchorElement.prototype.click = orig;
  });
});

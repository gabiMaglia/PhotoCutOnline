import {
  WORKER_LOAD_FAILED,
  isChunkLoadError,
  workerLoadError,
  isStaleBuildError,
  errorText,
} from "./staleBuild.js";
import { setLang } from "./i18n.js";

describe("staleBuild — detección de «versión vieja» (BUG-08)", () => {
  test.each([
    "Failed to fetch dynamically imported module: https://x/assets/a-1.js", // Chrome
    "error loading dynamically imported module: https://x/assets/a-1.js", // Firefox
    "Importing a module script failed.", // Safari/WebKit
  ])("reconoce el fallo de import() de cada motor: %s", (msg) => {
    expect(isChunkLoadError(msg)).toBe(true);
  });

  test("no confunde errores comunes con un deploy nuevo", () => {
    expect(isChunkLoadError("imagen corrupta")).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  test("workerLoadError lleva el código y conserva la causa", () => {
    const e = workerLoadError("404");
    expect(e.code).toBe(WORKER_LOAD_FAILED);
    expect(isStaleBuildError(e)).toBe(true);
    expect(isStaleBuildError(new Error("x"))).toBe(false);
  });

  test("errorText traduce el error de versión y deja pasar el resto", () => {
    setLang("es");
    expect(errorText(workerLoadError("x"))).toBe(
      "Hay una versión nueva de PhotoCut. Recargá la página para seguir."
    );
    expect(errorText(workerLoadError("x"))).not.toMatch(/worker error/);
    expect(errorText(new Error("imagen corrupta"))).toBe("Error: imagen corrupta");
  });
});

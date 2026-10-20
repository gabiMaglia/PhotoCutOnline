// BUG-13: la regla «celular o tablet» decide si el Recorte IA puede abrir BiRefNet.
const { isMobileDevice } = require("./deviceClass.js");

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const WIN_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

describe("isMobileDevice", () => {
  test.each([
    ["iPhone", { userAgent: IPHONE }],
    ["Android teléfono", { userAgent: ANDROID_PHONE }],
    ["Android tablet (sin «Mobile»)", { userAgent: ANDROID_TABLET }],
    ["iPadOS que se presenta como Mac (UA + maxTouchPoints)", { userAgent: IPAD_AS_MAC, platform: "MacIntel", maxTouchPoints: 5 }],
    ["userAgentData.mobile", { userAgent: WIN_CHROME, userAgentData: { mobile: true } }],
  ])("%s ⇒ true", (_n, nav) => {
    expect(isMobileDevice(nav)).toBe(true);
  });

  test.each([
    ["Chrome en macOS", { userAgent: MAC_CHROME, platform: "MacIntel", maxTouchPoints: 0 }],
    ["Mac sin maxTouchPoints (como en un worker)", { userAgent: IPAD_AS_MAC, platform: "MacIntel" }],
    ["Chrome en Windows con pantalla táctil", { userAgent: WIN_CHROME, platform: "Win32", maxTouchPoints: 10 }],
    ["sin navigator", undefined],
  ])("%s ⇒ false", (_n, nav) => {
    expect(isMobileDevice(nav)).toBe(false);
  });

  // BUG-13 ampliación: Chrome Android en «Sitio de escritorio» se presenta como Linux sin «Android»
  const ANDROID_DESKTOP_SITE =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
  test.each([
    ["Linux sin Android + táctil", { userAgent: ANDROID_DESKTOP_SITE, platform: "Linux x86_64", maxTouchPoints: 5 }, undefined],
    ["táctil + lado corto de pantalla 412 px", { userAgent: WIN_CHROME, platform: "Win32", maxTouchPoints: 5 }, { width: 915, height: 412 }],
    ["táctil + lado corto exactamente 600 px", { userAgent: WIN_CHROME, platform: "Win32", maxTouchPoints: 5 }, { width: 960, height: 600 }],
  ])("%s ⇒ true", (_n, nav, scr) => {
    expect(isMobileDevice(nav, scr)).toBe(true);
  });

  test.each([
    ["laptop Windows táctil 1366×768", { userAgent: WIN_CHROME, platform: "Win32", maxTouchPoints: 10 }, { width: 1366, height: 768 }],
    ["laptop Windows táctil 1920×1080", { userAgent: WIN_CHROME, platform: "Win32", maxTouchPoints: 10 }, { width: 1920, height: 1080 }],
    ["pantalla chica pero sin táctil (ventana de escritorio)", { userAgent: WIN_CHROME, platform: "Win32", maxTouchPoints: 0 }, { width: 800, height: 500 }],
    ["Linux de escritorio sin táctil", { userAgent: ANDROID_DESKTOP_SITE, platform: "Linux x86_64", maxTouchPoints: 0 }, { width: 1920, height: 1080 }],
  ])("%s ⇒ false", (_n, nav, scr) => {
    expect(isMobileDevice(nav, scr)).toBe(false);
  });
});

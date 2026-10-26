import { MASKABLE_MIN_PADDING, maskablePadding } from "./icons";

// Spec W3C: la zona segura es un círculo centrado de radio 2/5 (40 %) del lado.
const SIZE = 512;
const SAFE_RADIUS = 0.4 * SIZE;
// radio del círculo que circunscribe al cuadrado de arte con ese padding
const cornerRadius = (pad) => (SIZE / 2 - pad * SIZE) * Math.SQRT2;

test("el arte del maskable entra entero en el círculo seguro", () => {
  expect(cornerRadius(maskablePadding(0))).toBeLessThanOrEqual(SAFE_RADIUS);
});

test("el padding mínimo es ≈ 0,22 (no 0,20)", () => {
  expect(MASKABLE_MIN_PADDING).toBeGreaterThanOrEqual(0.2172);
  expect(MASKABLE_MIN_PADDING).toBeLessThanOrEqual(0.22);
});

test("un padding mayor del usuario se respeta", () => {
  expect(maskablePadding(0.3)).toBe(0.3);
  expect(maskablePadding(0.08)).toBe(MASKABLE_MIN_PADDING);
});

/** Acota un número al rango [lo, hi]. */
export function clampNum(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

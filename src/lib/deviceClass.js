// ¿Celular o tablet? Decide si el Recorte IA puede abrir BiRefNet (BUG-13): iOS mata
// la pestaña por memoria con ese modelo aunque el equipo exponga WebGPU.
//
// `maxTouchPoints` no existe en WorkerNavigator, así que el iPad que se presenta
// como Mac solo se detecta en el hilo principal: backend.js calcula esto allá y se
// lo manda al worker. Dentro del worker rige lo que dé el UA.
const MOBILE_UA = /iPhone|iPad|iPod|Android|Mobile/i;

export function isMobileDevice(nav = globalThis.navigator) {
  if (!nav) return false;
  if (nav.userAgentData?.mobile === true) return true;
  const ua = nav.userAgent || "";
  if (MOBILE_UA.test(ua)) return true;
  // iPadOS 13+ manda un UA de Mac de escritorio; una Mac real no tiene pantalla táctil
  const macLike = /Macintosh/.test(ua) || nav.platform === "MacIntel";
  return macLike && (nav.maxTouchPoints ?? 0) > 1;
}

// ¿Celular o tablet? Decide si el Recorte IA puede abrir BiRefNet (BUG-13): iOS mata
// la pestaña por memoria con ese modelo aunque el equipo exponga WebGPU.
//
// `maxTouchPoints` no existe en WorkerNavigator, así que el iPad que se presenta
// como Mac solo se detecta en el hilo principal: backend.js calcula esto allá y se
// lo manda al worker. Dentro del worker rige lo que dé el UA.
const MOBILE_UA = /iPhone|iPad|iPod|Android|Mobile/i;

const MAX_PHONE_SHORT_SIDE = 600;

export function isMobileDevice(nav = globalThis.navigator, scr = globalThis.screen) {
  if (!nav) return false;
  if (nav.userAgentData?.mobile === true) return true;
  const ua = nav.userAgent || "";
  if (MOBILE_UA.test(ua)) return true;
  // iPadOS 13+ manda un UA de Mac de escritorio; una Mac real no tiene pantalla táctil
  const touch = (nav.maxTouchPoints ?? 0) > 1;
  if (!touch) return false;
  if (/Macintosh/.test(ua) || nav.platform === "MacIntel") return true;
  // Chrome Android en «Sitio de escritorio» se presenta como Linux sin «Android»
  if (/Linux/.test(ua) && !/Android/.test(ua)) return true;
  // táctil con pantalla de teléfono/tablet chica; una laptop táctil (≥ 768 px de lado corto) no
  const short = scr ? Math.min(scr.width, scr.height) : 0;
  // 0 o ausente = tamaño desconocido (jsdom, worker): no es señal de teléfono
  return short > 0 && short <= MAX_PHONE_SHORT_SIDE;
}

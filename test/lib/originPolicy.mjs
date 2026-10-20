// Política de «ninguna request fuera del origen con cuerpo» (BUG-15).
//
// El editor carga AdSense a propósito (docs/MONETIZACION.md) y, si el script
// llega a correr, hace POST de pings propios. Eso es del anunciante, no de la
// foto: se tolera solo hacia los hosts declarados y solo si el cuerpo es chico
// y no contiene la imagen. Cualquier otro host, o la foto adonde sea, es falla.

export const AD_HOSTS = [
  "pagead2.googlesyndication.com",
  "googleads.g.doubleclick.net",
  "tpc.googlesyndication.com",
  "fundingchoicesmessages.google.com",
];

const MAX_PING_BYTES = 16 * 1024; // un ping es de decenas de bytes; una foto, no

// Firmas de PNG, JPEG y WebP, en crudo y en base64 (data: URL o JSON)
const SIGNATURES = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from("WEBPVP8"),
  Buffer.from("iVBORw0KGgo"),
  Buffer.from("/9j/"),
  Buffer.from("UklGR"),
];
const carriesImage = (body) => SIGNATURES.some((s) => body.includes(s));

// Devuelve null si está bien, o el texto «METHOD url» de la violación.
export function foreignBodyViolation({ origin, method, url, body }) {
  if (url.startsWith(origin) || /^(blob|data):/.test(url)) return null;
  if (!body?.length) return null;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* URL ilegible: se trata como ajena */
  }
  const tolerated = AD_HOSTS.includes(host) && body.length <= MAX_PING_BYTES && !carriesImage(body);
  return tolerated ? null : `${method} ${url}`;
}

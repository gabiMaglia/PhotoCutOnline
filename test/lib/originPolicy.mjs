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

const PING_PATH = "/pagead/ping";
const MAX_PING_BYTES = 2 * 1024; // un ping es de decenas de bytes; una foto, no
const MAX_SESSION_BYTES = 8 * 1024; // suma de lo tolerado por sesión (objeto `budget`)

// Firmas de formatos de imagen y de gzip (que esconde cualquier otra firma).
const RAW = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
  Buffer.from([0xff, 0xd8, 0xff]), // JPEG
  Buffer.from("WEBPVP8"),
  Buffer.from("GIF8"),
  Buffer.from("ftypavif"),
  Buffer.from("ftypavis"),
  Buffer.from("ftypheic"),
  Buffer.from("ftypheix"),
  Buffer.from("ftypmif1"),
  Buffer.from([0x1f, 0x8b, 0x08]), // gzip
];
const STARTS = [Buffer.from("BM")]; // BMP: solo cuenta al inicio (dos letras son ruido en medio)

// En base64 la misma firma cambia según su alineación (0, 1 o 2 bytes antes):
// se guardan solo los caracteres que dependen únicamente de la firma.
function base64Needles(sig) {
  const out = [];
  for (let pad = 0; pad < 3; pad++) {
    const enc = Buffer.concat([Buffer.alloc(pad), sig]).toString("base64").replace(/=+$/, "");
    const from = Math.ceil((pad * 8) / 6);
    const to = Math.floor(((pad + sig.length) * 8) / 6);
    if (to - from < 3) continue; // menos de 3 caracteres sería ruido
    const part = enc.slice(from, to);
    out.push(Buffer.from(part), Buffer.from(part.replace(/\+/g, "-").replace(/\//g, "_")));
  }
  return out;
}
const SIGNATURES = [...RAW, ...RAW.flatMap(base64Needles)];
const carriesImage = (body) => SIGNATURES.some((s) => body.includes(s)) || STARTS.some((s) => body.subarray(0, s.length).equals(s));

// Devuelve null si está bien, o el texto «METHOD url» de la violación.
// `budget` ({ used: 0 }) acumula lo tolerado: pasar el mismo objeto en toda la sesión.
export function foreignBodyViolation({ origin, method, url, body, budget }) {
  if (/^(blob|data):/.test(url)) return null;
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    /* URL ilegible: se trata como ajena */
  }
  if (parsed && parsed.origin === origin) return null;
  if (!body?.length) return null;
  const tolerated =
    parsed !== null &&
    method === "POST" &&
    AD_HOSTS.includes(parsed.hostname) &&
    parsed.pathname === PING_PATH &&
    body.length <= MAX_PING_BYTES &&
    !carriesImage(body) &&
    (!budget || budget.used + body.length <= MAX_SESSION_BYTES);
  if (!tolerated) return `${method} ${url}`;
  if (budget) budget.used += body.length;
  return null;
}

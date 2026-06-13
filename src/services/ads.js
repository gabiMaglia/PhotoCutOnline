// Publicidad, OPT-IN por build (ver docs/MONETIZACION.md).
//
// Sin variables de entorno NO se carga absolutamente nada de terceros: la
// promesa "tus fotos nunca salen de tu navegador" se mantiene por defecto y
// el slot muestra un house-ad propio (donaciones / app de escritorio).
//
// Un proveedor a la vez, por orden de prioridad:
//   VITE_ETHICALADS_PUBLISHER=<publisher>   → EthicalAds (sin cookies/banner)
//   VITE_CARBON_SERVE=<id> VITE_CARBON_PLACEMENT=<dominio> → Carbon Ads
//   VITE_ADSENSE_CLIENT=ca-pub-XXXX [VITE_ADSENSE_SLOT=<id>] → Google AdSense
//     (requiere CMP: activar «Privacidad y mensajes» en la consola de AdSense;
//      el propio script adsbygoogle sirve el banner de consentimiento en EEA)

// import.meta.env siempre existe en Vite; el `?? {}` solo protege entornos de
// test (Jest) donde no está definido, para no romper al importar el módulo.
const ENV = import.meta.env ?? {};

export const ADS = (() => {
  if (!ENV.PROD && !ENV.VITE_ADS_DEV) return { provider: "house" };
  if (ENV.VITE_ETHICALADS_PUBLISHER)
    return { provider: "ethicalads", publisher: ENV.VITE_ETHICALADS_PUBLISHER };
  if (ENV.VITE_CARBON_SERVE && ENV.VITE_CARBON_PLACEMENT)
    return {
      provider: "carbon",
      serve: ENV.VITE_CARBON_SERVE,
      placement: ENV.VITE_CARBON_PLACEMENT,
    };
  if (ENV.VITE_ADSENSE_CLIENT)
    return {
      provider: "adsense",
      client: ENV.VITE_ADSENSE_CLIENT,
      slot: ENV.VITE_ADSENSE_SLOT || "",
    };
  return { provider: "house" };
})();

/** URL de donaciones. VITE_DONATE_URL la sobreescribe; "" la desactiva. */
export const DONATE_URL = ENV.VITE_DONATE_URL ?? "https://ko-fi.com/gabrielmaglia";

function addScript(src, attrs = {}) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  return s;
}

let initialized = false;

/** Carga el script global del proveedor (una sola vez). */
export function initAds() {
  if (initialized) return;
  initialized = true;
  if (ADS.provider === "ethicalads") {
    addScript("https://media.ethicalads.io/media/client/ethicalads.min.js");
  } else if (ADS.provider === "adsense") {
    addScript(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.client}`,
      { crossorigin: "anonymous" }
    );
  }
  // Carbon se inyecta dentro del propio slot (lo hace AdSlot.jsx)
}

/** Notifica al proveedor que hay un slot nuevo montado en el DOM. */
export function loadSlot(el) {
  if (ADS.provider === "ethicalads") {
    // el cliente escanea el DOM al cargar; si ya cargó, re-escanear
    window.ethicalads?.load?.();
  } else if (ADS.provider === "adsense") {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* el script aún no llegó: AdSense reintenta al cargar */
    }
  } else if (ADS.provider === "carbon" && el && !el.querySelector("#_carbonads_js")) {
    const s = document.createElement("script");
    s.async = true;
    s.id = "_carbonads_js";
    s.src = `https://cdn.carbonads.com/carbon.js?serve=${ADS.serve}&placement=${ADS.placement}`;
    el.appendChild(s);
  }
}

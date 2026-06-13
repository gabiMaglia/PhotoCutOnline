// Google Analytics 4 (gtag.js), OPT-IN por build.
//
// Sin VITE_GA_ID no carga absolutamente nada (cero terceros, igual que ads).
// Con la variable, mide tráfico y unos pocos eventos de conversión relevantes
// para monetizar (recorte hecho, exportación, ZIP de iconos).
//
//   VITE_GA_ID=G-XXXXXXXXXX npm run build
//
// Nota de privacidad: GA4 usa cookies; en la UE hace falta un banner de
// consentimiento (CMP). El que provee AdSense al activarse sirve también para
// GA. Hasta entonces va con anonimización de IP y sin señales de publicidad.

// import.meta.env siempre existe en Vite; el `?? {}` protege los tests (Jest).
const ENV = import.meta.env ?? {};
const GA_ID = ENV.VITE_GA_ID || "";

let ready = false;

export function initAnalytics() {
  if (!GA_ID || !ENV.PROD || typeof document === "undefined") return false;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID, { anonymize_ip: true });
  ready = true;
  return true;
}

/** Registra un evento de GA4 (no-op si analytics no está activo). */
export function trackEvent(name, params = {}) {
  if (!ready || typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

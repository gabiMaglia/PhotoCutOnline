import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { initTelemetry } from "./lib/telemetry.js";
import "./styles.css";

initTelemetry();

// PWA: solo en producción (en dev interferiría con el HMR de Vite)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// AdSense, OPT-IN por build (ver docs/MONETIZACION.md). Sin la variable no se
// carga absolutamente nada de terceros.
//   VITE_ADSENSE_CLIENT=ca-pub-XXXX npm run build
const ADS_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT;
if (ADS_CLIENT && import.meta.env.PROD) {
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
  document.head.appendChild(s);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

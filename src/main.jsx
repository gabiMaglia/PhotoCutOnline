import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/feedback/ErrorBoundary.jsx";
import StaleBuildNotice from "./features/update/StaleBuildNotice.jsx";
import { initTelemetry } from "./services/telemetry.js";
import { initAds } from "./services/ads.js";
import { initAnalytics } from "./services/analytics.js";
import "./styles.css";

initTelemetry();
initAds();
initAnalytics();

// PWA: solo en producción (en dev interferiría con el HMR de Vite). sw.js cambia
// en cada deploy (BUG-08), así que el navegador instala la versión nueva solo.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// El aviso de versión nueva va fuera del ErrorBoundary: si un chunk perezoso
// que ya no existe tira la app, el aviso con «Recargar» sigue a la vista.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <StaleBuildNotice />
  </React.StrictMode>
);

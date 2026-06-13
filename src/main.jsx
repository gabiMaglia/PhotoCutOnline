import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/feedback/ErrorBoundary.jsx";
import { initTelemetry } from "./services/telemetry.js";
import { initAds } from "./services/ads.js";
import "./styles.css";

initTelemetry();
initAds();

// PWA: solo en producción (en dev interferiría con el HMR de Vite)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

import { useState } from "react";
import { t } from "../../lib/i18n.js";
import { analyticsConfigured, initAnalytics } from "../../services/analytics.js";
import { getConsent, setConsent } from "../../services/consent.js";

// Banner de consentimiento de cookies. Solo aparece si hay analítica con
// cookies configurada y el usuario todavía no decidió. "Aceptar" activa GA;
// "Rechazar" lo deja apagado. La app funciona igual en ambos casos.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(() => analyticsConfigured() && !getConsent());
  if (!visible) return null;

  const decide = (value) => {
    setConsent(value);
    if (value === "granted") initAnalytics();
    setVisible(false);
  };

  return (
    <div className="consent-banner" role="region" aria-label={t("consent.aria")}>
      <p className="consent-text">
        {t("consent.text")}{" "}
        <a href="/legal/privacidad.html" target="_blank" rel="noopener">
          {t("about.privacyLink")}
        </a>
        .
      </p>
      <div className="consent-actions">
        <button className="btn btn-small" onClick={() => decide("denied")}>
          {t("consent.reject")}
        </button>
        <button className="btn btn-small btn-primary" onClick={() => decide("granted")}>
          {t("consent.accept")}
        </button>
      </div>
    </div>
  );
}

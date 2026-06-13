import { useEffect, useRef } from "react";
import { ADS, DONATE_URL, loadSlot } from "../../services/ads.js";
import { t } from "../../lib/i18n.js";

// Slot publicitario al pie del rail. Con un proveedor configurado renderiza
// su placement; sin proveedor muestra un house-ad propio (cero terceros) que
// empuja donaciones o la app de escritorio — así el hueco ya existe, se mide
// y no hay layout shift el día que se active una red.

export default function AdSlot({ placement, onDownload }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ADS.provider !== "house") loadSlot(ref.current);
  }, []);

  if (ADS.provider === "house") {
    return (
      <div className="ad-slot ad-slot-house" data-placement={placement}>
        <span className="ad-label">{t("house.label")}</span>
        <p className="house-body">{t("house.body")}</p>
        {DONATE_URL ? (
          <a
            className="btn btn-small btn-donate"
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("house.donate")}
          </a>
        ) : (
          <button className="btn btn-small" onClick={onDownload}>
            {t("house.desktop")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ad-slot" data-placement={placement} ref={ref}>
      <span className="ad-label">{t("ad.label")}</span>
      {ADS.provider === "ethicalads" && (
        <div
          data-ea-publisher={ADS.publisher}
          data-ea-type="image"
          data-ea-style="stickybox-disabled"
          className="ea-dark"
        />
      )}
      {ADS.provider === "adsense" && (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADS.client}
          data-ad-slot={ADS.slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
      {/* carbon: el script se inyecta en el contenedor (ver lib/ads.js) */}
    </div>
  );
}

import licenses from "../generated/licenses.json";
import { t } from "../lib/i18n.js";
import { DONATE_URL } from "../services/ads.js";

// "Acerca de / Licencias": versión, promesa de privacidad y atribución de
// dependencias open source (regenerar con `npm run licenses`).

export default function AboutModal({ version, onClose }) {
  return (
    <div
      className="modal-veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-about">
        <h3 id="about-title">
          PhotoCut <span className="about-light">Studio</span>{" "}
          <span className="about-version">v{version}</span>
        </h3>
        <p>
          {t("about.body")} <strong>{t("about.privacy")}</strong>
        </p>
        {DONATE_URL && (
          <a
            className="btn btn-donate about-donate"
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("about.donate")}
          </a>
        )}
        <nav className="about-links" aria-label={t("about.linksAria")}>
          <a href="/legal/privacidad.html" target="_blank" rel="noopener">
            {t("about.privacyLink")}
          </a>
          <a href="/legal/terminos.html" target="_blank" rel="noopener">
            {t("about.termsLink")}
          </a>
          <a href="/guias/" target="_blank" rel="noopener">
            {t("about.guides")}
          </a>
        </nav>
        <h4 className="about-subtitle">{t("about.thirdparty")}</h4>
        <ul className="license-list">
          {licenses.entries.map((d) => (
            <li key={`${d.source}-${d.name}`}>
              <span className="license-name">{d.name}</span>
              <span className="license-meta">
                {d.version} · {d.license} · {d.source}
              </span>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn btn-primary" autoFocus onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

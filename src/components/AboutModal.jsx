import licenses from "../generated/licenses.json";
import { t } from "../lib/i18n.js";

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

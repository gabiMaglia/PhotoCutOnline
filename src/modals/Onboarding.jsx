// Onboarding de primera visita: 3 pasos, una sola pantalla, sin fricción.
// Se muestra una vez (localStorage "pc-onboarded").
import { t } from "../lib/i18n.js";

const STEP_KEYS = ["1", "2", "3"];

export default function Onboarding({ onDismiss }) {
  return (
    <div
      className="modal-veil onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-card">
        <div className="brand" aria-hidden>
          <span className="brand-mark">◑</span>
          <span className="brand-name">PhotoCut</span>
          <span className="brand-sub">Studio</span>
        </div>
        <h2 id="onboarding-title">{t("ob.title")}</h2>
        <p className="onboarding-privacy">{t("ob.privacy")}</p>
        <ol className="onboarding-steps">
          {STEP_KEYS.map((n) => (
            <li key={n}>
              <span className="step-n" aria-hidden>{n}</span>
              <div>
                <strong>{t(`ob.${n}.title`)}</strong>
                <p>{t(`ob.${n}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <button className="btn btn-primary onboarding-go" autoFocus onClick={onDismiss}>
          {t("ob.go")}
        </button>
      </div>
    </div>
  );
}

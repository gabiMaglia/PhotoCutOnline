import licenses from "../generated/licenses.json";

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
          Recorte de fondo y generación de iconos, 100% en tu navegador.
          <strong> Tus imágenes nunca se suben a ningún servidor.</strong>
        </p>
        <h4 className="about-subtitle">Software de terceros</h4>
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
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

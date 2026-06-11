// Atajos de teclado, abrible con "?" (accesibilidad y descubribilidad).

const SHORTCUTS = [
  ["A", "Recorte automático"],
  ["1", "Recuadro"],
  ["2 / 3", "Pincel mantener / quitar"],
  ["[ ]", "Tamaño del pincel"],
  ["P", "Vista previa"],
  ["E", "Exportar PNG transparente"],
  ["⌘Z / ⇧⌘Z", "Deshacer / Rehacer"],
  ["⌘V", "Pegar imagen del portapapeles"],
  ["?", "Esta ayuda"],
  ["Esc", "Cerrar paneles"],
];

export default function HelpModal({ onClose }) {
  return (
    <div
      className="modal-veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-help">
        <h3 id="help-title">Atajos de teclado</h3>
        <ul className="shortcut-list">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={keys}>
              <span className="shortcut-keys">
                {keys.split(" / ").map((k, i) => (
                  <span key={k}>
                    {i > 0 && " / "}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </span>
              <span className="shortcut-label">{label}</span>
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

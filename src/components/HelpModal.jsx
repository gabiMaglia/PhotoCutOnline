// Atajos de teclado, abrible con "?" (accesibilidad y descubribilidad).
import { t } from "../lib/i18n.js";

const SHORTCUTS = [
  ["A", "sc.auto"],
  ["1", "sc.rect"],
  ["2 / 3", "sc.brushes"],
  ["[ ]", "sc.brushsize"],
  ["P", "sc.preview"],
  ["E", "sc.export"],
  ["⌘Z / ⇧⌘Z", "sc.undoredo"],
  ["⌘V", "sc.paste"],
  ["?", "sc.help"],
  ["Esc", "sc.close"],
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
        <h3 id="help-title">{t("help.title")}</h3>
        <ul className="shortcut-list">
          {SHORTCUTS.map(([keys, labelKey]) => (
            <li key={keys}>
              <span className="shortcut-keys">
                {keys.split(" / ").map((k, i) => (
                  <span key={k}>
                    {i > 0 && " / "}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </span>
              <span className="shortcut-label">{t(labelKey)}</span>
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

import { t } from "../../../lib/i18n.js";

// Velo a pantalla completa mientras se arrastra un archivo sobre la ventana.
export default function DropVeil({ show }) {
  if (!show) return null;
  return (
    <div className="drop-veil" aria-hidden>
      <div className="drop-veil-inner">{t("drop.here")}</div>
    </div>
  );
}

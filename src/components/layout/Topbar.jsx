import { backend } from "../../lib/backend.js";
import { t } from "../../lib/i18n.js";
import { DONATE_URL } from "../../services/ads.js";
import { STICKERS_ENABLED } from "../../config.js";
import FileButton from "../ui/FileButton.jsx";
import IconButton from "../ui/IconButton.jsx";
import LangSwitch from "./LangSwitch.jsx";

// Barra superior: marca, pestañas (Recorte / Icon Studio), abrir foto, idioma y
// el grupo de íconos (donación, descarga de la app, acerca de).
export default function Topbar({ tab, onTab, onFileInput, onOpenAbout, onOpenDownload }) {
  return (
    <header className="topbar">
      {backend.isDesktop ? (
        <div className="brand">
          <span className="brand-mark" aria-hidden>◑</span>
          <span className="brand-name">PhotoCut</span>
          <span className="brand-sub">Studio</span>
          <span className="brand-env">Desktop</span>
        </div>
      ) : (
        <a className="brand" href="/" aria-label="PhotoCut Studio — ir al inicio">
          <span className="brand-mark" aria-hidden>◑</span>
          <span className="brand-name">PhotoCut</span>
          <span className="brand-sub">Studio</span>
          <span className="brand-env">Web</span>
        </a>
      )}

      <nav className="tabs" role="tablist" aria-label="Espacios de trabajo">
        {[
          { id: "cut", label: t("tab.cut") },
          { id: "icons", label: "Icon Studio" },
          { id: "batch", label: t("tab.batch") },
          { id: "colors", label: t("tab.colors") },
          ...(STICKERS_ENABLED ? [{ id: "stickers", label: t("tab.stickers") }] : []),
        ].map((it) => (
          <button
            key={it.id}
            role="tab"
            aria-selected={tab === it.id}
            className={`tab ${tab === it.id ? "tab-active" : ""}`}
            onClick={() => onTab(it.id)}
          >
            {it.label}
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        <FileButton variant="primary" onChange={onFileInput}>
          {t("openPhoto")}
        </FileButton>
        <LangSwitch />
        <div className="topbar-icons">
          <a
            className="btn-icon btn-icon-guides"
            href="/guias/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("guides.aria")}
            title={t("guides.label")}
          >
            {t("guides.label")}
          </a>
          {DONATE_URL && (
            <IconButton className="btn-icon-donate" href={DONATE_URL} label={t("donate.aria")}>
              ☕
            </IconButton>
          )}
          {/* Botón "Descargar app" oculto por el momento (T-012: definir desktop de
              pago antes de empujar descargas del desktop gratis v0.1.4). Restaurar
              quitando el `false &&`. */}
          {false && !backend.isDesktop && (
            <IconButton label={t("dl.aria")} onClick={onOpenDownload}>
              ⬇
            </IconButton>
          )}
          <IconButton label={t("about.aria")} onClick={onOpenAbout}>
            ⓘ
          </IconButton>
        </div>
      </div>
    </header>
  );
}

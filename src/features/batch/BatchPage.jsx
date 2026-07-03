import { useCallback } from "react";
import { t } from "../../lib/i18n.js";
import FileButton from "../../components/ui/FileButton.jsx";
import Button from "../../components/ui/Button.jsx";
import { useBatch } from "./hooks/useBatch.js";

const STATUS_ICON = { pending: "○", processing: "◐", done: "✓", error: "✕" };

// Lote: soltar/seleccionar N imágenes, recorte IA secuencial (una sola sesión
// de motor, ver useBatch) y descarga de un ZIP con los PNG transparentes.
// Caso de uso: fotos de producto de e-commerce. La página se monta una vez
// (igual que Icon Studio) y queda oculta con display:none al cambiar de tab,
// así la cola sigue corriendo si el usuario mira otra pestaña.
export default function BatchPage({ active, onToast }) {
  const batch = useBatch({ toast: onToast });

  // Detiene la propagación al `window`: CutoutPage escucha drag/drop a nivel
  // window (para su propio overlay "soltá acá") aunque esté oculto por
  // display:none — sin stopPropagation, soltar acá también dispararía ese
  // overlay global y (peor) el loader de recorte single-image.
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (files?.length) batch.addFiles(files);
    },
    [batch]
  );
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const stopBubble = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className="body batch-body" style={active ? undefined : { display: "none" }}>
      <div
        className="batch-page"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={stopBubble}
        onDragLeave={stopBubble}
      >
        <div className="batch-dropzone">
          <div className="empty-glyph" aria-hidden>
            ⇩
          </div>
          <h2>{t("batch.dropTitle")}</h2>
          <p>{t("batch.dropBody")}</p>
          <FileButton
            variant="primary"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) batch.addFiles(e.target.files);
              e.target.value = "";
            }}
          >
            {t("batch.addMore")}
          </FileButton>
        </div>

        {batch.total > 0 && (
          <div className="batch-results">
            <ul className="batch-list">
              {batch.items.map((it) => (
                <li key={it.id} className={`batch-item batch-item-${it.status}`}>
                  <span className="batch-item-icon" aria-hidden>
                    {STATUS_ICON[it.status]}
                  </span>
                  <span className="batch-item-name">{it.name}</span>
                  <span className="batch-item-status">
                    {it.status === "error" ? it.error : t(`batch.status.${it.status}`)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="batch-footer">
              <div className="batch-progress">
                <div className="batch-progress-bar">
                  <div
                    className="batch-progress-fill"
                    style={{
                      width: `${batch.total ? (batch.settledCount / batch.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="batch-progress-label">
                  {t("batch.progress", { done: batch.settledCount, total: batch.total })}
                  {batch.doneCount > 0 ? ` · ${t("batch.okCount", { n: batch.doneCount })}` : ""}
                </span>
              </div>
              <div className="batch-actions">
                <Button onClick={batch.clear} disabled={batch.running}>
                  {t("batch.clear")}
                </Button>
                <Button
                  variant="primary"
                  disabled={batch.doneCount === 0 || batch.zipping}
                  onClick={batch.downloadZip}
                >
                  {batch.zipping ? t("batch.zipping") : t("batch.downloadZip")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

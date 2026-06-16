import { t } from "../../../lib/i18n.js";

// Panel flotante de vista previa: cabecera arrastrable, conmutador de fondo
// (solo en modo transparente), cuerpo con el recorte (arrastrable al lienzo) y
// handle de redimensionado. El estado y los handlers viven en usePreviewPanel.
export default function PreviewPanel({
  panelRef,
  size,
  pos,
  bg,
  setBg,
  color,
  setColor,
  exportMode,
  bgColor,
  bgImage,
  bgOpacity,
  resultUrl,
  resultScale = 100,
  resultRotation = 0,
  onClose,
  handlers,
}) {
  const bodyClass = `preview-body preview-bg-${exportMode === "transparent" ? bg : "none"}`;
  const bodyStyle =
    exportMode === "solid"
      ? { background: bgColor }
      : exportMode === "transparent" && bg === "color"
        ? { background: color }
        : undefined;

  return (
    <div
      className="preview-panel"
      ref={panelRef}
      style={{
        width: size.w,
        height: size.h,
        ...(pos ? { left: pos.x, top: pos.y, right: "auto" } : {}),
      }}
    >
      <div
        className="preview-panel-head"
        onPointerDown={handlers.dragDown}
        onPointerMove={handlers.dragMove}
        onPointerUp={handlers.dragUp}
        onPointerCancel={handlers.dragUp}
      >
        <span className="preview-panel-title">{t("previewPanel.title")}</span>
        {exportMode === "transparent" && (
          <div className="preview-bg-switch" role="radiogroup" aria-label={t("previewPanel.bgAria")}>
            <button
              className={`bg-chip bg-chip-checker ${bg === "checker" ? "bg-chip-on" : ""}`}
              onClick={() => setBg("checker")}
              aria-label={t("previewPanel.transparent")}
              aria-pressed={bg === "checker"}
            />
            <button
              className={`bg-chip bg-chip-white ${bg === "white" ? "bg-chip-on" : ""}`}
              onClick={() => setBg("white")}
              aria-label={t("previewPanel.white")}
              aria-pressed={bg === "white"}
            />
            <button
              className={`bg-chip bg-chip-black ${bg === "black" ? "bg-chip-on" : ""}`}
              onClick={() => setBg("black")}
              aria-label={t("previewPanel.black")}
              aria-pressed={bg === "black"}
            />
            <input
              type="color"
              className={`bg-chip bg-chip-color ${bg === "color" ? "bg-chip-on" : ""}`}
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setBg("color");
              }}
              aria-label={t("previewPanel.custom")}
            />
          </div>
        )}
        <button className="preview-close" onClick={onClose} aria-label={t("previewPanel.close")}>
          ×
        </button>
      </div>

      <div className={bodyClass} style={bodyStyle}>
        {((exportMode === "transparent" && bg === "checker") ||
          (exportMode === "image" && !bgImage)) && <div className="checker" />}
        {exportMode === "image" && bgImage && (
          <img
            className="preview-bgimg"
            src={bgImage}
            style={{ opacity: bgOpacity / 100 }}
            alt=""
            aria-hidden
          />
        )}
        <img
          className="preview-cutout"
          src={resultUrl}
          alt={t("previewPanel.alt")}
          title={t("preview.dropHint")}
          style={{
            touchAction: "none",
            transform:
              resultScale !== 100 || resultRotation !== 0
                ? `rotate(${resultRotation}deg) scale(${resultScale / 100})`
                : undefined,
          }}
          onPointerDown={handlers.cutDown}
          onPointerMove={handlers.cutMove}
          onPointerUp={handlers.cutUp}
          onPointerCancel={handlers.cutCancel}
        />
      </div>

      <div
        className="preview-resize"
        role="separator"
        aria-label={t("previewPanel.resize")}
        onPointerDown={handlers.resizeDown}
        onPointerMove={handlers.resizeMove}
        onPointerUp={handlers.resizeUp}
        onPointerCancel={handlers.resizeUp}
      />
    </div>
  );
}

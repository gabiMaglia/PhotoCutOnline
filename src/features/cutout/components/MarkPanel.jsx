import { backend } from "../../../lib/backend.js";
import { t } from "../../../lib/i18n.js";
import Button from "../../../components/ui/Button.jsx";
import Slider from "../../../components/ui/Slider.jsx";

// Grupo "Marcar": IA / automático / recuadro / pinceles + tamaño de pincel,
// suavizado y deshacer/rehacer. Presentacional: recibe estado y callbacks.
export default function MarkPanel({
  imageUrl,
  hasCut,
  busy,
  mode,
  setMode,
  brushSize,
  setBrushSize,
  feather,
  onFeather,
  canUndo,
  canRedo,
  onAi,
  onAuto,
  onUndo,
  onRedo,
}) {
  return (
    <section className="rail-group">
      <h2 className="rail-title">{t("rail.mark")}</h2>

      {backend.features.ai && (
        <Button variant="ai" disabled={!imageUrl || busy} onClick={onAi}>
          <span className="tool-key">I</span> {t("tool.ai")}
        </Button>
      )}
      {backend.features.auto && (
        <Button variant="auto" disabled={!imageUrl || busy} onClick={onAuto}>
          <span className="tool-key">A</span> {t("tool.auto")}
        </Button>
      )}

      <ToolButton active={mode === "rect"} onClick={() => setMode("rect")} disabled={!imageUrl}>
        <span className="tool-key">1</span> {t("tool.rect")}
      </ToolButton>
      <ToolButton active={mode === "fg"} onClick={() => setMode("fg")} disabled={!hasCut}>
        <span className="tool-key">2</span> {t("tool.keep")}
      </ToolButton>
      <ToolButton active={mode === "bg"} onClick={() => setMode("bg")} disabled={!hasCut}>
        <span className="tool-key">3</span> {t("tool.remove")}
      </ToolButton>

      <Slider
        id="brush"
        label={t("brush.label", { n: brushSize })}
        hint={
          <>
            <kbd>[</kbd>
            <kbd>]</kbd>
          </>
        }
        min={4}
        max={120}
        value={brushSize}
        onChange={setBrushSize}
        disabled={mode === "rect"}
        off={mode === "rect"}
      />

      {backend.features.feather && (
        <Slider
          id="feather"
          label={t("feather.label", { n: feather })}
          min={0}
          max={20}
          value={feather}
          onChange={onFeather}
          disabled={!hasCut}
          off={!hasCut}
        />
      )}

      {backend.features.undo && (
        <div className="row-2">
          <Button size="small" disabled={!canUndo || busy} onClick={onUndo} kbd="⌘Z">
            {t("undo")}
          </Button>
          <Button size="small" disabled={!canRedo || busy} onClick={onRedo}>
            {t("redo")}
          </Button>
        </div>
      )}
    </section>
  );
}

function ToolButton({ active, children, ...rest }) {
  return (
    <button className={`tool ${active ? "tool-active" : ""}`} {...rest}>
      {children}
    </button>
  );
}

import { backend } from "../../../lib/backend.js";
import { EXPORT_PRESETS } from "../../../lib/presets.js";
import { t } from "../../../lib/i18n.js";
import Button from "../../../components/ui/Button.jsx";
import FileButton from "../../../components/ui/FileButton.jsx";
import ChipGroup from "../../../components/ui/ChipGroup.jsx";
import Slider from "../../../components/ui/Slider.jsx";
import Field from "../../../components/ui/Field.jsx";
import Dropdown from "../../../components/ui/Dropdown.jsx";

// Grupo "Exportar": vista previa, preset de tamaño, modo de fondo
// (transparente/color/imagen) con sus controles, formato y descarga.
export default function ExportPanel({
  hasCut,
  busy,
  previewOpen,
  onTogglePreview,
  presetId,
  setPresetId,
  exportMode,
  setExportMode,
  format,
  setFormat,
  bgColor,
  setBgColor,
  bgImage,
  setBgImage,
  bgOpacity,
  setBgOpacity,
  resultScale,
  setResultScale,
  resultRotation,
  setResultRotation,
  rotateBy,
  onChooseBgImage,
  onDownload,
  onCopy,
  onGoIcons,
}) {
  return (
    <section className="rail-group export-panel">
      <h2 className="rail-title">{t("rail.export")}</h2>

      <Button active={previewOpen} disabled={!hasCut} aria-pressed={previewOpen} onClick={onTogglePreview} kbd="P">
        {previewOpen ? t("preview.hide") : t("preview.show")}
      </Button>

      {backend.features.finish && (
        <Field id="export-preset" label={t("preset.label")}>
          <Dropdown
            id="export-preset"
            ariaLabel={t("preset.label")}
            value={presetId}
            onChange={setPresetId}
            options={EXPORT_PRESETS.map((p) => ({ value: p.id, label: t(p.labelKey) }))}
          />
        </Field>
      )}

      {/* encuadre del resultado: agranda/rota lo recortado (solo afecta al export) */}
      <Slider
        id="result-scale"
        label={t("frame.scale", { n: resultScale })}
        min={100}
        max={300}
        value={resultScale}
        onChange={setResultScale}
        disabled={!hasCut}
        off={!hasCut}
      />
      <Slider
        id="result-rotation"
        label={t("frame.rotate", { n: resultRotation })}
        min={-180}
        max={180}
        value={resultRotation}
        onChange={setResultRotation}
        disabled={!hasCut}
        off={!hasCut}
      />
      <div className="format-row" role="group" aria-label={t("frame.rotateAria")}>
        <button className="chip" onClick={() => rotateBy(-90)} disabled={!hasCut}>
          ⟲ 90°
        </button>
        <button className="chip" onClick={() => rotateBy(90)} disabled={!hasCut}>
          ⟳ 90°
        </button>
      </div>

      <ChipGroup
        ariaLabel={t("export.modeAria")}
        value={exportMode}
        onChange={setExportMode}
        options={["transparent", "solid", "image"].map((m) => ({
          value: m,
          label: t(`export.mode.${m}`),
          disabled: !hasCut,
        }))}
      />

      {exportMode === "solid" && (
        <div className="color-export">
          <input
            type="color"
            value={bgColor}
            disabled={!hasCut}
            onChange={(e) => setBgColor(e.target.value)}
            aria-label={t("export.bgcolor.aria")}
          />
          <span className="color-export-hex">{bgColor}</span>
        </div>
      )}

      {exportMode === "image" && (
        <>
          {!bgImage ? (
            <FileButton size="small" disabled={!hasCut} onChange={onChooseBgImage}>
              {t("export.bgChoose")}
            </FileButton>
          ) : (
            <Button size="small" onClick={() => setBgImage(null)}>
              {t("export.bgRemove")}
            </Button>
          )}
          <Slider
            id="bg-opacity"
            label={t("export.bgOpacity", { n: bgOpacity })}
            min={10}
            max={100}
            value={bgOpacity}
            onChange={setBgOpacity}
            disabled={!bgImage}
            off={!bgImage}
          />
        </>
      )}

      {backend.features.formats && (
        <ChipGroup
          ariaLabel="Formato"
          value={format}
          onChange={setFormat}
          options={["png", "webp", "jpeg"].map((f) => ({
            value: f,
            label: f.toUpperCase(),
            disabled: f === "jpeg" && exportMode === "transparent",
          }))}
        />
      )}

      <Button
        variant="primary"
        className="export-download"
        disabled={!hasCut || busy || (exportMode === "image" && !bgImage)}
        onClick={onDownload}
        kbd="E"
      >
        {t(backend.isDesktop ? "export.save" : "export.download")}
      </Button>

      {backend.features.clipboard && (
        <Button disabled={!hasCut || busy} onClick={onCopy}>
          {t("export.clipboard")}
        </Button>
      )}

      <Button disabled={!hasCut || busy} onClick={onGoIcons}>
        {t("export.icons")}
      </Button>
    </section>
  );
}

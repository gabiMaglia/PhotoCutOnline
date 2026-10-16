import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import EditTabs from "../textTool/EditTabs.jsx";
import EditSource from "../textTool/EditSource.jsx";
import { buildOps, toImageData, renderFiltered, PREVIEW_MAX_SIDE } from "./filterOps.js";
import { useFilterPreview } from "./useFilterPreview.js";
import { decodedSource } from "../../utils/image.js";

// Filtros y ajustes de una foto (GROW-23), sub-herramienta del hub "Editar".
// Los píxeles los calcula pixelFilters (no ctx.filter, que Safari no tiene:
// BUG-09): 100% en el navegador, la foto no se sube.

export default function FiltersPage({ active, subTool, onSubTool, onToast, onOpenDownload }) {
  const { editSourceUrl, editSourceMode, setEditSourceMode, session } = useCutoutContext();
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState(null); // copia reducida para la vista previa
  const [sourceName, setSourceName] = useState("");
  const [preset, setPreset] = useState("none");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  useEffect(() => {
    if (!(active && editSourceUrl && editSourceUrl !== loadedUrlRef.current)) return;
    loadedUrlRef.current = editSourceUrl;
    const img = new Image();
    img.onload = async () => {
      const src = await decodedSource(editSourceUrl, img);
      if (loadedUrlRef.current !== editSourceUrl) return; // cambió la fuente mientras tanto
      imgRef.current = src;
      try {
        setBase(toImageData(src, PREVIEW_MAX_SIDE));
      } catch {
        onToast?.(t("filters.error"));
        return;
      }
      setSourceName(t("img.currentName"));
      setReady(true);
    };
    img.onerror = () => onToast?.("No se pudo cargar la imagen");
    img.src = editSourceUrl;
  }, [active, editSourceUrl, onToast]);

  const ops = useMemo(() => buildOps(preset, brightness, contrast, saturation), [preset, brightness, contrast, saturation]);
  const previewError = useCallback(() => onToast?.(t("filters.error")), [onToast]);
  useFilterPreview(canvasRef, base, ops, previewError);

  const reset = () => { setPreset("none"); setBrightness(100); setContrast(100); setSaturation(100); };

  // la descarga se recalcula a resolución completa (la vista previa está reducida)
  const download = () => {
    const img = imgRef.current;
    if (!img) return;
    let cv;
    try {
      cv = renderFiltered(img, ops);
    } catch {
      onToast?.(t("filters.error"));
      return;
    }
    cv.toBlob((blob) => {
      if (!blob) {
        onToast?.(t("filters.error"));
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (sourceName?.replace(/\.[^.]+$/, "") || "imagen") + "-filtro.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

  return (
    <div className="body" style={active ? undefined : { display: "none" }}>
      <div className="icon-studio">
        <aside className="rail">
          <EditTabs value={subTool} onChange={onSubTool} />
          <EditSource mode={editSourceMode} onChange={setEditSourceMode} hasCut={session?.hasCut} />

          <section className="rail-group">
            <h2 className="rail-title">{t("color.source")}</h2>
            {sourceName ? (
              <div className="source-tag">{sourceName}</div>
            ) : (
              <div className="rail-help"><p>{t("img.openHint")}</p></div>
            )}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("filters.title")}</h2>
            <ChipGroup
              ariaLabel={t("filters.preset")}
              value={preset}
              onChange={setPreset}
              options={[
                { value: "none", label: t("filters.none") },
                { value: "bw", label: t("filters.bw") },
                { value: "sepia", label: t("filters.sepia") },
                { value: "vivid", label: t("filters.vivid") },
                { value: "soft", label: t("filters.soft") },
              ]}
            />
            <Slider id="f-bright" label={t("filters.brightness", { n: brightness })} min={50} max={150} value={brightness} onChange={setBrightness} disabled={!ready} off={!ready} />
            <Slider id="f-contrast" label={t("filters.contrast", { n: contrast })} min={50} max={150} value={contrast} onChange={setContrast} disabled={!ready} off={!ready} />
            <Slider id="f-sat" label={t("filters.saturation", { n: saturation })} min={0} max={200} value={saturation} onChange={setSaturation} disabled={!ready} off={!ready} />
            <Button disabled={!ready} onClick={reset}>{t("filters.reset")}</Button>
            <Button variant="primary" disabled={!ready} onClick={download}>{t("filters.download")}</Button>
            <div className="rail-help"><p>{t("filters.help")}</p></div>
          </section>

          {active && <AdSlot placement="filters-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>◐</div>
              <h2>{t("filters.title")}</h2>
              <p>{t("filters.emptyBody")}</p>
              <p className="canvas-empty-hint">{t("empty.drag")}</p>
            </div>
          )}
          <canvas ref={canvasRef} className="faces-canvas" style={ready ? undefined : { display: "none" }} />
        </main>
      </div>
    </div>
  );
}

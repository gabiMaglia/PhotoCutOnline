import { useRef, useState, useEffect, useCallback } from "react";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import EditTabs from "../textTool/EditTabs.jsx";
import EditSource from "../textTool/EditSource.jsx";

// Filtros y ajustes de una foto (GROW-23), sub-herramienta del hub "Editar".
// Todo con ctx.filter (grayscale/sepia/brightness/contrast/saturate): 100% en
// el navegador, la foto no se sube.
const PRESETS = {
  none: "",
  bw: "grayscale(1)",
  sepia: "sepia(0.75)",
  vivid: "saturate(1.4) contrast(1.08)",
  soft: "contrast(0.92) brightness(1.04)",
};

export default function FiltersPage({ active, subTool, onSubTool, onToast, onOpenDownload }) {
  const { editSourceUrl, editSourceMode, setEditSourceMode, session } = useCutoutContext();
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [imgTick, setImgTick] = useState(0); // fuerza el redraw al cambiar de fuente
  const [sourceName, setSourceName] = useState("");
  const [preset, setPreset] = useState("none");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  useEffect(() => {
    if (!(active && editSourceUrl && editSourceUrl !== loadedUrlRef.current)) return;
    loadedUrlRef.current = editSourceUrl;
    const img = new Image();
    img.onload = () => { imgRef.current = img; setSourceName(t("img.currentName")); setReady(true); setImgTick((n) => n + 1); };
    img.onerror = () => onToast?.("No se pudo cargar la imagen");
    img.src = editSourceUrl;
  }, [active, editSourceUrl, onToast]);

  const filterString = useCallback(
    () => `${PRESETS[preset]} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`.trim(),
    [preset, brightness, contrast, saturation]
  );

  const redraw = useCallback(() => {
    const img = imgRef.current, cv = canvasRef.current;
    if (!img || !cv) return;
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.filter = filterString();
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";
  }, [filterString]);

  useEffect(() => { if (ready) redraw(); }, [ready, redraw, imgTick]);

  const reset = () => { setPreset("none"); setBrightness(100); setContrast(100); setSaturation(100); };

  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
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
            </div>
          )}
          {ready && <canvas ref={canvasRef} className="faces-canvas" />}
        </main>
      </div>
    </div>
  );
}

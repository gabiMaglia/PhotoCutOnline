import { useRef, useState, useEffect, useCallback } from "react";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import Slider from "../../components/ui/Slider.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import EditTabs from "../textTool/EditTabs.jsx";
import EditSource from "../textTool/EditSource.jsx";

// Marca de agua repetida (GROW-21), sub-herramienta del hub "Editar". Repite un
// texto en diagonal sobre toda la foto (protección de autoría). 100% local.
export default function WatermarkPage({ active, subTool, onSubTool, onToast, onOpenDownload }) {
  const { editSourceUrl, editSourceMode, setEditSourceMode, session } = useCutoutContext();
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [imgTick, setImgTick] = useState(0);
  const [sourceName, setSourceName] = useState("");
  const [text, setText] = useState("© Tu marca");
  const [opacity, setOpacity] = useState(28); // %
  const [size, setSize] = useState(4); // % del lado menor
  const [angle, setAngle] = useState(-30); // grados
  const [density, setDensity] = useState(50); // separación relativa
  const [color, setColor] = useState("#ffffff");

  useEffect(() => {
    if (!(active && editSourceUrl && editSourceUrl !== loadedUrlRef.current)) return;
    loadedUrlRef.current = editSourceUrl;
    const img = new Image();
    img.onload = () => { imgRef.current = img; setSourceName(t("img.currentName")); setReady(true); setImgTick((n) => n + 1); };
    img.onerror = () => onToast?.("No se pudo cargar la imagen");
    img.src = editSourceUrl;
  }, [active, editSourceUrl, onToast]);

  const redraw = useCallback(() => {
    const img = imgRef.current, cv = canvasRef.current;
    if (!img || !cv) return;
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    if (!text) return;
    const fontPx = Math.max(10, Math.round((Math.min(W, H) * size) / 100));
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.font = `600 ${fontPx}px ${"'Bricolage Grotesque', system-ui, Arial, sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // sombra sutil para que se lea sobre fondos claros y oscuros
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = fontPx * 0.08;
    const tw = ctx.measureText(text).width;
    // densidad: 0 = muy junto, 100 = muy separado
    const stepX = tw + fontPx * (1 + density / 25);
    const stepY = fontPx * (1.6 + density / 20);
    ctx.translate(W / 2, H / 2);
    ctx.rotate((angle * Math.PI) / 180);
    const diag = Math.hypot(W, H);
    for (let y = -diag; y <= diag; y += stepY) {
      // desfase alterno de filas para que no queden columnas alineadas
      const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
      for (let x = -diag; x <= diag; x += stepX) ctx.fillText(text, x + offset, y);
    }
    ctx.restore();
  }, [text, opacity, size, angle, density, color]);

  useEffect(() => { if (ready) redraw(); }, [ready, redraw, imgTick]);

  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (sourceName?.replace(/\.[^.]+$/, "") || "imagen") + "-marca.png";
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
            <h2 className="rail-title">{t("wm.title")}</h2>
            <textarea className="cs-css-input" rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("wm.placeholder")} disabled={!ready} />
            <Slider id="wm-op" label={t("wm.opacity", { n: opacity })} min={5} max={80} value={opacity} onChange={setOpacity} disabled={!ready} off={!ready} />
            <Slider id="wm-size" label={t("wm.size", { n: size })} min={2} max={12} value={size} onChange={setSize} disabled={!ready} off={!ready} />
            <Slider id="wm-ang" label={t("wm.angle", { n: angle })} min={-90} max={90} value={angle} onChange={setAngle} disabled={!ready} off={!ready} />
            <Slider id="wm-dens" label={t("wm.density", { n: density })} min={0} max={100} value={density} onChange={setDensity} disabled={!ready} off={!ready} />
            <label className="contrast-field"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t("wm.color")} /><span>{t("wm.color")}</span></label>
            <Button variant="primary" disabled={!ready} onClick={download}>{t("wm.download")}</Button>
            <div className="rail-help"><p>{t("wm.help")}</p></div>
          </section>

          {active && <AdSlot placement="wm-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>©</div>
              <h2>{t("wm.title")}</h2>
              <p>{t("wm.emptyBody")}</p>
              <p className="canvas-empty-hint">{t("empty.drag")}</p>
            </div>
          )}
          {ready && <canvas ref={canvasRef} className="faces-canvas" />}
        </main>
      </div>
    </div>
  );
}

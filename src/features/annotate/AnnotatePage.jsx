import { useRef, useState, useEffect, useCallback } from "react";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import EditTabs from "../textTool/EditTabs.jsx";
import EditSource from "../textTool/EditSource.jsx";

// Anotar (GROW-24): dibujar formas y flechas sobre la foto (recuadros, elipses,
// flechas, líneas) para señalar cosas en una captura. 100% local.
function drawShape(ctx, sh) {
  const { type, x0, y0, x1, y1, color, w } = sh;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (type === "rect") {
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  } else if (type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "line" || type === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (type === "arrow") {
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(w * 3.5, 12);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 6), y1 - head * Math.sin(ang - Math.PI / 6));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 6), y1 - head * Math.sin(ang + Math.PI / 6));
      ctx.stroke();
    }
  }
}

export default function AnnotatePage({ active, subTool, onSubTool, onToast, onOpenDownload }) {
  const { editSourceUrl, editSourceMode, setEditSourceMode, session } = useCutoutContext();
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const dragRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [imgTick, setImgTick] = useState(0);
  const [sourceName, setSourceName] = useState("");
  const [tool, setTool] = useState("arrow"); // arrow | rect | ellipse | line
  const [color, setColor] = useState("#ff3b30");
  const [width, setWidth] = useState(8); // 2..24 relativo
  const [shapes, setShapes] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!(active && editSourceUrl && editSourceUrl !== loadedUrlRef.current)) return;
    loadedUrlRef.current = editSourceUrl;
    const img = new Image();
    img.onload = () => { imgRef.current = img; setSourceName(t("img.currentName")); setShapes([]); setReady(true); setImgTick((n) => n + 1); };
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
    for (const sh of shapes) drawShape(ctx, sh);
    if (preview) drawShape(ctx, preview);
  }, [shapes, preview]);

  useEffect(() => { if (ready) redraw(); }, [ready, redraw, imgTick]);

  // grosor en px escalado al tamaño de la imagen (para que se vea consistente)
  const lineW = useCallback(() => {
    const img = imgRef.current;
    const base = img ? Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height) : 500;
    return Math.max(2, Math.round((base * width) / 600));
  }, [width]);

  const toImg = (e) => {
    const cv = canvasRef.current, r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height };
  };
  const onDown = (e) => { if (ready) dragRef.current = toImg(e); };
  const onMove = (e) => {
    if (!dragRef.current) return;
    const p = toImg(e), s = dragRef.current;
    setPreview({ type: tool, x0: s.x, y0: s.y, x1: p.x, y1: p.y, color, w: lineW() });
  };
  const onUp = (e) => {
    const s = dragRef.current;
    dragRef.current = null;
    if (!s) return;
    const p = toImg(e);
    setPreview(null);
    const moved = Math.hypot(p.x - s.x, p.y - s.y);
    if (moved < 4) return; // clic sin arrastre: nada
    setShapes((prev) => [...prev, { type: tool, x0: s.x, y0: s.y, x1: p.x, y1: p.y, color, w: lineW() }]);
  };

  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (sourceName?.replace(/\.[^.]+$/, "") || "imagen") + "-anotada.png";
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
            <h2 className="rail-title">{t("annot.title")}</h2>
            <ChipGroup
              ariaLabel={t("annot.shape")}
              value={tool}
              onChange={setTool}
              options={[
                { value: "arrow", label: t("annot.arrow") },
                { value: "rect", label: t("annot.rect") },
                { value: "ellipse", label: t("annot.ellipse") },
                { value: "line", label: t("annot.line") },
              ]}
            />
            <Slider id="an-w" label={t("annot.width", { n: width })} min={2} max={24} value={width} onChange={setWidth} disabled={!ready} off={!ready} />
            <label className="contrast-field"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t("annot.color")} /><span>{t("annot.color")}</span></label>
            <div className="an-actions">
              <Button size="small" disabled={!shapes.length} onClick={() => setShapes((p) => p.slice(0, -1))}>{t("annot.undo")}</Button>
              <Button size="small" disabled={!shapes.length} onClick={() => setShapes([])}>{t("annot.clear")}</Button>
            </div>
            <Button variant="primary" disabled={!ready} onClick={download}>{t("annot.download")}</Button>
            <div className="rail-help"><p>{t("annot.help")}</p></div>
          </section>

          {active && <AdSlot placement="annot-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>➘</div>
              <h2>{t("annot.title")}</h2>
              <p>{t("annot.emptyBody")}</p>
            </div>
          )}
          {ready && (
            <canvas
              ref={canvasRef}
              className="faces-canvas"
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={() => { dragRef.current = null; setPreview(null); }}
              style={{ cursor: "crosshair" }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

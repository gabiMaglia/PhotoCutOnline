import { useRef, useState, useEffect, useCallback } from "react";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import { detectFaces, censorBoxes, warmupFaces } from "../../lib/faceDetect.js";
import EditTabs from "../textTool/EditTabs.jsx";

// Censurar caras: detección 100% local (YuNet) + blur/pixelado sobre cada cara,
// recortado a una elipse. La foto no se sube. Vive en el hub "Editar".
export default function FaceCensorPage({ active, subTool, onSubTool, onToast, onOpenDownload }) {
  const { sharedImageUrl } = useCutoutContext();
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedUrlRef = useRef(null);

  const [sourceName, setSourceName] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [boxes, setBoxes] = useState([]); // {x,y,w,h,score,on}
  const [mode, setMode] = useState("blur"); // blur | pixelate
  const [strength, setStrength] = useState(65);
  const [detected, setDetected] = useState(false);

  // auto-carga la imagen compartida (navbar «Abrir foto»)
  useEffect(() => {
    if (!(active && sharedImageUrl && sharedImageUrl !== loadedUrlRef.current)) return;
    loadedUrlRef.current = sharedImageUrl;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setSourceName(t("img.currentName"));
      setBoxes([]);
      setDetected(false);
      setReady(true);
    };
    img.onerror = () => onToast?.("No se pudo cargar la imagen");
    img.src = sharedImageUrl;
  }, [active, sharedImageUrl, onToast]);

  // (re)dibuja el preview: imagen censurada (sólo las caras activas) + contornos
  const redraw = useCallback(() => {
    const img = imgRef.current, cv = canvasRef.current;
    if (!img || !cv) return;
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const on = boxes.filter((b) => b.on);
    if (on.length) {
      ctx.drawImage(censorBoxes(img, on, { mode, strength }), 0, 0);
    } else {
      ctx.drawImage(img, 0, 0);
    }
    // contornos: sólida = se censura, punteada = desactivada
    const line = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    for (const b of boxes) {
      ctx.lineWidth = line;
      ctx.strokeStyle = b.on ? "#d6f64b" : "rgba(255,255,255,0.5)";
      ctx.setLineDash(b.on ? [] : [line * 3, line * 2]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.setLineDash([]);
  }, [boxes, mode, strength]);

  useEffect(() => { redraw(); }, [redraw]);

  const detect = useCallback(async () => {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    try {
      if (!loadedWarm.current) { onToast?.(t("faces.detecting")); await warmupFaces(); loadedWarm.current = true; }
      const found = await detectFaces(img);
      setBoxes(found.map((b) => ({ ...b, on: true })));
      setDetected(true);
      onToast?.(found.length ? t("faces.found", { n: found.length }) : t("faces.none"), found.length ? "ok" : "error");
    } catch (e) {
      onToast?.(String(e), "error");
    } finally {
      setBusy(false);
    }
  }, [busy, onToast]);
  const loadedWarm = useRef(false);

  // clic sobre una cara → activa/desactiva su censura
  const onCanvasClick = (e) => {
    const cv = canvasRef.current;
    if (!cv || !boxes.length) return;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * cv.width;
    const y = (e.clientY - rect.top) / rect.height * cv.height;
    setBoxes((prev) => prev.map((b) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h ? { ...b, on: !b.on } : b
    ));
  };

  const download = () => {
    const img = imgRef.current;
    if (!img) return;
    const on = boxes.filter((b) => b.on);
    const out = censorBoxes(img, on, { mode, strength });
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (sourceName?.replace(/\.[^.]+$/, "") || "imagen") + "-caras.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

  const onCount = boxes.filter((b) => b.on).length;

  return (
    <div className="body" style={active ? undefined : { display: "none" }}>
      <div className="icon-studio">
        <aside className="rail">
          <EditTabs value={subTool} onChange={onSubTool} />

          <section className="rail-group">
            <h2 className="rail-title">{t("color.source")}</h2>
            {sourceName ? (
              <div className="source-tag">{sourceName}</div>
            ) : (
              <div className="rail-help"><p>{t("img.openHint")}</p></div>
            )}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("faces.title")}</h2>
            <Button variant="primary" disabled={!ready || busy} onClick={detect}>
              {busy ? t("faces.detecting") : t("faces.detect")}
            </Button>
            {detected && (
              <>
                <ChipGroup
                  ariaLabel={t("faces.mode")}
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "blur", label: t("faces.blur") },
                    { value: "pixelate", label: t("faces.pixelate") },
                  ]}
                />
                <Slider id="faces-strength" label={t("faces.strength", { n: strength })} min={10} max={100} value={strength} onChange={setStrength} />
                <div className="rail-help"><p>{boxes.length ? t("faces.tapHint", { on: onCount, total: boxes.length }) : t("faces.none")}</p></div>
                <Button disabled={!onCount} onClick={download}>{t("faces.download")}</Button>
              </>
            )}
            <div className="rail-help"><p>{t("faces.help")}</p></div>
          </section>

          {active && <AdSlot placement="faces-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>◔</div>
              <h2>{t("faces.title")}</h2>
              <p>{t("faces.emptyBody")}</p>
            </div>
          )}
          {ready && (
            <canvas
              ref={canvasRef}
              className="faces-canvas"
              onClick={onCanvasClick}
              style={{ cursor: boxes.length ? "pointer" : "default" }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

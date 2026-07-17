import { useRef, useState, useEffect, useCallback } from "react";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import FileButton from "../../components/ui/FileButton.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import Checkbox from "../../components/ui/Checkbox.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";

const MAX_DIM = 1600;
const FONTS = {
  sans: "'Bricolage Grotesque', system-ui, -apple-system, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Spline Sans Mono', ui-monospace, monospace",
  impact: "Impact, 'Arial Black', sans-serif",
};

// Añadir texto a una foto: preview en vivo, arrastrar para posicionar, estilos y
// exportación. Todo 100% local; la imagen no se sube.
export default function TextToolPage({ active, onToast, onOpenDownload }) {
  const { sharedImageUrl } = useCutoutContext();
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragging = useRef(false);
  const fontSeq = useRef(0);
  const loadedUrlRef = useRef(null); // auto-carga la imagen compartida (navbar)
  const [ready, setReady] = useState(false);
  const [sourceName, setSourceName] = useState("");

  const [text, setText] = useState("Tu texto aquí");
  const [pos, setPos] = useState({ x: 0.5, y: 0.85 });
  const [size, setSize] = useState(64);
  const [color, setColor] = useState("#ffffff");
  const [font, setFont] = useState("sans");
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [effect, setEffect] = useState("shadow"); // none | outline | shadow
  const [format, setFormat] = useState("png");
  const [customFont, setCustomFont] = useState(null); // {family, label} de una fuente subida

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const img = imgRef.current;
    if (!cv || !img) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    if (!text) return;

    const px = size;
    const fam = font === "custom" && customFont ? `'${customFont.family}', sans-serif` : FONTS[font];
    ctx.font = `${italic ? "italic " : ""}${bold ? "700" : "400"} ${px}px ${fam}`;
    // El texto se posiciona arrastrando un punto: se ancla centrado en él (no hay
    // marco de referencia para justificar a izquierda/derecha).
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = pos.x * W;
    const lines = text.split("\n");
    const lh = px * 1.2;
    const startY = pos.y * H - (lh * (lines.length - 1)) / 2;

    lines.forEach((line, i) => {
      const y = startY + i * lh;
      if (effect === "shadow") {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = px * 0.16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = px * 0.04;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
      if (effect === "outline") {
        ctx.lineWidth = Math.max(1, px * 0.12);
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line, x, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(line, x, y);
    });
    ctx.shadowColor = "transparent";
  }, [text, pos, size, color, font, bold, italic, effect, customFont]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  const loadImage = useCallback((src, name) => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = Math.max(1, Math.round(img.width * scale));
      cv.height = Math.max(1, Math.round(img.height * scale));
      imgRef.current = img;
      setSourceName(name || "");
      setReady(true);
    };
    img.onerror = () => onToast?.("No se pudo cargar la imagen");
    img.src = src;
  }, [onToast]);

  // Auto-carga la imagen compartida (la del navbar «Abrir foto») al entrar a la
  // pestaña o al cambiar de imagen. Sin botón de carga propio.
  useEffect(() => {
    if (active && sharedImageUrl && sharedImageUrl !== loadedUrlRef.current) {
      loadedUrlRef.current = sharedImageUrl;
      loadImage(sharedImageUrl, t("img.currentName"));
    }
  }, [active, sharedImageUrl, loadImage]);

  // Sube una fuente propia (.ttf/.otf/.woff/.woff2) vía FontFace API, con familia
  // única por carga para no colisionar con una anterior.
  const loadFont = useCallback(async (file) => {
    if (!file || typeof FontFace === "undefined") return;
    try {
      const buf = await file.arrayBuffer();
      const family = `pcUserFont${++fontSeq.current}`;
      const face = new FontFace(family, buf);
      await face.load();
      document.fonts.add(face);
      setCustomFont({ family, label: file.name.replace(/\.[^.]+$/, "") });
      setFont("custom");
    } catch {
      onToast?.("No se pudo cargar la fuente (probá .ttf, .otf, .woff o .woff2)");
    }
  }, [onToast]);

  const posFromEvent = (e) => {
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };
  const onDown = (e) => { dragging.current = true; setPos(posFromEvent(e)); };
  const onMove = (e) => { if (dragging.current) setPos(posFromEvent(e)); };
  const onUp = () => { dragging.current = false; };

  const download = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (sourceName?.replace(/\.[^.]+$/, "") || "imagen") + "-texto." + (format === "jpeg" ? "jpg" : "png");
      a.click();
      URL.revokeObjectURL(a.href);
    }, mime, 0.92);
  };

  return (
    <div className="body" style={active ? undefined : { display: "none" }}>
      <div className="icon-studio">
        <aside className="rail">
          <section className="rail-group">
            <h2 className="rail-title">{t("color.source")}</h2>
            {sourceName ? (
              <div className="source-tag">{sourceName}</div>
            ) : (
              <div className="rail-help"><p>{t("img.openHint")}</p></div>
            )}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("txt.title")}</h2>
            <textarea className="cs-css-input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("txt.placeholder")} disabled={!ready} />
            <ChipGroup
              ariaLabel={t("txt.font")}
              value={font}
              onChange={setFont}
              options={[
                ...["sans", "serif", "mono", "impact"].map((f) => ({ value: f, label: t(`txt.font.${f}`) })),
                ...(customFont ? [{ value: "custom", label: t("txt.font.custom") }] : []),
              ]}
            />
            <FileButton size="small" accept=".ttf,.otf,.woff,.woff2,font/*" onChange={(e) => e.target.files?.[0] && loadFont(e.target.files[0])}>
              {t("txt.uploadFont")}
            </FileButton>
            {customFont && <div className="source-tag">{customFont.label}</div>}
            <Slider id="txt-size" label={t("txt.size", { n: size })} min={16} max={280} value={size} onChange={setSize} disabled={!ready} off={!ready} />
            <div className="contrast-inputs">
              <label className="contrast-field"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t("txt.color")} /><span>{t("txt.color")}</span></label>
              <Checkbox checked={bold} onChange={setBold}>{t("txt.bold")}</Checkbox>
              <Checkbox checked={italic} onChange={setItalic}>{t("txt.italic")}</Checkbox>
            </div>
            <ChipGroup ariaLabel={t("txt.effect")} value={effect} onChange={setEffect} options={[{ value: "none", label: t("txt.effect.none") }, { value: "shadow", label: t("txt.effect.shadow") }, { value: "outline", label: t("txt.effect.outline") }]} />
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("rail.export")}</h2>
            <ChipGroup ariaLabel="Formato" value={format} onChange={setFormat} options={["png", "jpeg"].map((f) => ({ value: f, label: f.toUpperCase() }))} />
            <Button variant="primary" disabled={!ready} onClick={download}>{t("cs.download")}</Button>
          </section>

          {active && <AdSlot placement="text-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>T</div>
              <h2>{t("tab.text")}</h2>
              <p>{t("txt.emptyBody")}</p>
            </div>
          )}
          {/* El canvas se mantiene SIEMPRE montado (oculto hasta que hay imagen):
              loadImage necesita canvasRef.current para dibujar y marcar ready. */}
          <div className="txt-workspace" style={ready ? undefined : { display: "none" }}>
            <canvas
              ref={canvasRef}
              className="txt-canvas"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            />
            <p className="txt-hint">{t("txt.dragHint")}</p>
          </div>
        </main>
      </div>
    </div>
  );
}

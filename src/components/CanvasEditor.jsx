import { useRef, useEffect, useState, useCallback } from "react";
import { t } from "../lib/i18n.js";

// Lienzo interactivo. Tres modos de entrada:
//  - "rect": arrastrar un recuadro alrededor del sujeto (marching ants)
//  - "fg":   pincel mantener (pinta restricciones de primer plano)
//  - "bg":   pincel quitar  (pinta restricciones de fondo)
//
// Capas (de abajo a arriba): checker → base → result → guide.
// La base queda como "fantasma" tenue cuando hay resultado, para poder
// recuperar zonas con el pincel mantener viendo el original.

export default function CanvasEditor({
  imageUrl,
  imageSize,
  resultUrl,
  mode,
  brushSize,
  onRect,
  onStroke,
  busy,
}) {
  const wrapRef = useRef(null);
  const baseRef = useRef(null);
  const resultRef = useRef(null);
  const guideRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [cursorPos, setCursorPos] = useState(null);

  const drawing = useRef(false);
  const start = useRef(null);
  const currentRect = useRef(null);
  const strokePoints = useRef([]);
  const antsRaf = useRef(0);
  const antsPhase = useRef(0);

  // Ajustar la imagen al espacio disponible (ancho Y alto).
  const recomputeScale = useCallback(() => {
    if (!imageSize || !wrapRef.current) return;
    const availW = wrapRef.current.clientWidth - 48;
    const availH = wrapRef.current.clientHeight - 48;
    const s = Math.min(1, availW / imageSize.width, availH / imageSize.height);
    setScale(s > 0 ? s : 1);
  }, [imageSize]);

  useEffect(() => {
    recomputeScale();
    window.addEventListener("resize", recomputeScale);
    return () => window.removeEventListener("resize", recomputeScale);
  }, [recomputeScale]);

  // Dibujar la foto base cuando cambia.
  useEffect(() => {
    if (!imageUrl || !imageSize) return;
    for (const ref of [baseRef, resultRef, guideRef]) {
      ref.current.width = imageSize.width;
      ref.current.height = imageSize.height;
    }
    const ctx = baseRef.current.getContext("2d");
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = imageUrl;
  }, [imageUrl, imageSize]);

  // El resultado vive en su propia capa.
  useEffect(() => {
    if (!imageSize) return;
    const canvas = resultRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!resultUrl) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // el preview llega a resolución de trabajo; se escala al lienzo completo
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = resultUrl;
  }, [resultUrl, imageSize]);

  useEffect(() => () => cancelAnimationFrame(antsRaf.current), []);

  function toImageCoords(e) {
    const rect = guideRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * imageSize.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * imageSize.height);
    return {
      x: Math.max(0, Math.min(imageSize.width - 1, x)),
      y: Math.max(0, Math.min(imageSize.height - 1, y)),
    };
  }

  function ctxGuide() {
    return guideRef.current.getContext("2d");
  }

  function clearGuide() {
    const c = guideRef.current;
    if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }

  // ---- marching ants ----
  function drawAnts() {
    const r = currentRect.current;
    if (!r) return;
    const ctx = ctxGuide();
    const c = guideRef.current;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    const lw = Math.max(1.5, 2 / scale);
    ctx.lineWidth = lw;
    ctx.setLineDash([8 / scale, 6 / scale]);
    ctx.lineDashOffset = -antsPhase.current;
    ctx.strokeStyle = "rgba(214, 246, 75, 0.95)";
    ctx.shadowColor = "rgba(214, 246, 75, 0.6)";
    ctx.shadowBlur = 6 / scale;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(214, 246, 75, 0.06)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  function antsLoop() {
    antsPhase.current += 0.9 / scale;
    drawAnts();
    if (drawing.current && mode === "rect") {
      antsRaf.current = requestAnimationFrame(antsLoop);
    }
  }

  // ---- input ----
  function handleDown(e) {
    if (busy || !imageSize) return;
    e.preventDefault();
    guideRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const p = toImageCoords(e);
    start.current = p;
    strokePoints.current = [p];
    if (mode === "rect") {
      currentRect.current = { x: p.x, y: p.y, w: 0, h: 0 };
      cancelAnimationFrame(antsRaf.current);
      antsRaf.current = requestAnimationFrame(antsLoop);
    } else {
      paintGuideDisc(p);
    }
  }

  function handleMove(e) {
    if (imageSize) setCursorPos({ x: e.clientX, y: e.clientY });
    if (!drawing.current || busy) return;
    const p = toImageCoords(e);
    if (mode === "rect") {
      currentRect.current = normRect(start.current, p);
    } else {
      const pts = strokePoints.current;
      const last = pts[pts.length - 1];
      if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) >= 2) {
        pts.push(p);
        paintGuideSegment(last, p);
      }
    }
  }

  function handleUp(e) {
    if (!drawing.current) return;
    drawing.current = false;
    cancelAnimationFrame(antsRaf.current);
    if (busy) {
      clearGuide();
      return;
    }
    if (mode === "rect") {
      const r = currentRect.current || normRect(start.current, toImageCoords(e));
      currentRect.current = null;
      clearGuide();
      if (r.w > 4 && r.h > 4) onRect(r);
    } else {
      const pts = strokePoints.current;
      clearGuide();
      if (pts.length) {
        onStroke({
          points: pts,
          radius: Math.max(2, Math.round(brushSize / 2)),
          foreground: mode === "fg",
        });
      }
    }
  }

  function handleLeave() {
    setCursorPos(null);
  }

  // ---- guías de pincel ----
  function brushColor() {
    return mode === "fg" ? "rgba(214, 246, 75, 0.55)" : "rgba(255, 94, 99, 0.55)";
  }

  function paintGuideDisc(p) {
    const ctx = ctxGuide();
    ctx.fillStyle = brushColor();
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
    ctx.fill();
  }

  function paintGuideSegment(a, b) {
    const ctx = ctxGuide();
    ctx.strokeStyle = brushColor();
    ctx.lineWidth = Math.max(2, brushSize);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const isBrush = mode === "fg" || mode === "bg";
  const showGhost = isBrush && cursorPos && !busy;

  return (
    <div className="canvas-wrap" ref={wrapRef} onPointerLeave={handleLeave}>
      {!imageUrl && (
        <div className="canvas-empty">
          <div className="empty-glyph" aria-hidden>◐</div>
          <h2>{t("canvas.empty.title")}</h2>
          <p>{t("canvas.empty.body")}</p>
        </div>
      )}
      {imageUrl && imageSize && (
        <div
          className={`canvas-stage ${resultUrl ? "has-result" : ""}`}
          style={{
            width: imageSize.width * scale,
            height: imageSize.height * scale,
          }}
        >
          <div className="checker" />
          <canvas ref={baseRef} className="layer base" />
          <canvas ref={resultRef} className="layer result" />
          <canvas
            ref={guideRef}
            className="layer guide"
            style={{ cursor: mode === "rect" ? "crosshair" : "none", touchAction: "none" }}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          />
          {busy && (
            <div className="canvas-busy" role="status" aria-live="polite">
              <span className="busy-dot" aria-hidden /> {t("busy")}
            </div>
          )}
        </div>
      )}
      {showGhost && (
        <div
          className={`brush-ghost ${mode === "bg" ? "brush-ghost-bg" : ""}`}
          style={{
            width: brushSize * scale,
            height: brushSize * scale,
            transform: `translate(${cursorPos.x}px, ${cursorPos.y}px) translate(-50%, -50%)`,
          }}
        />
      )}
    </div>
  );
}

function normRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

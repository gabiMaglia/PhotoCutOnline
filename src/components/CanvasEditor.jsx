import { useRef, useEffect, useState, useCallback } from "react";
import { t } from "../lib/i18n.js";

// Lienzo interactivo. Modos de entrada:
//  - "rect": arrastrar un recuadro alrededor del sujeto (marching ants)
//  - "fg":   pincel mantener · "bg": pincel quitar
//
// Vista (N3): zoom hacia el cursor con rueda/pinch (1×–8× sobre el encaje),
// pan con espacio+arrastre, botón central o dos dedos; doble clic = reset.
// Comparador (N2): divisor arrastrable antes/después sobre el lienzo.
//
// Capas (de abajo a arriba): checker → base → result → guide. La base queda
// como "fantasma" tenue cuando hay resultado (y a opacidad completa en modo
// comparar, como lado "antes").

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

export default function CanvasEditor({
  imageUrl,
  imageSize,
  resultUrl,
  mode,
  brushSize,
  onRect,
  onStroke,
  busy,
  compare,
  onCompareChange,
}) {
  const wrapRef = useRef(null);
  const baseRef = useRef(null);
  const resultRef = useRef(null);
  const guideRef = useRef(null);

  const [fitScale, setFitScale] = useState(1);
  const [view, setView] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [cursorPos, setCursorPos] = useState(null);
  const [comparePos, setComparePos] = useState(0.5);
  const [spaceDown, setSpaceDown] = useState(false);

  const drawing = useRef(false);
  const start = useRef(null);
  const currentRect = useRef(null);
  const strokePoints = useRef([]);
  const antsRaf = useRef(0);
  const antsPhase = useRef(0);

  const pointers = useRef(new Map()); // pinch / pan táctil
  const gesture = useRef(null);
  const panDrag = useRef(null);
  const compareDrag = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitRef = useRef(fitScale);
  fitRef.current = fitScale;

  const effScale = fitScale * view.zoom;

  // ---- encaje inicial y centrado ----
  const resetView = useCallback(
    (fs) => {
      if (!imageSize || !wrapRef.current) return;
      const f = fs ?? fitRef.current;
      const wrap = wrapRef.current;
      setView({
        zoom: 1,
        pan: {
          x: (wrap.clientWidth - imageSize.width * f) / 2,
          y: (wrap.clientHeight - imageSize.height * f) / 2,
        },
      });
    },
    [imageSize]
  );

  const recomputeFit = useCallback(() => {
    if (!imageSize || !wrapRef.current) return;
    const availW = wrapRef.current.clientWidth - 32;
    const availH = wrapRef.current.clientHeight - 32;
    const f = Math.max(
      0.01,
      Math.min(1, availW / imageSize.width, availH / imageSize.height)
    );
    setFitScale(f);
    resetView(f);
  }, [imageSize, resetView]);

  useEffect(() => {
    recomputeFit();
    window.addEventListener("resize", recomputeFit);
    return () => window.removeEventListener("resize", recomputeFit);
  }, [recomputeFit]);

  // ---- capas ----
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

  // ---- zoom (rueda / pinch del trackpad) ----
  const zoomAt = useCallback(
    (clientX, clientY, factor) => {
      const wrap = wrapRef.current;
      if (!wrap || !imageSize) return;
      const rect = wrap.getBoundingClientRect();
      const { zoom, pan } = viewRef.current;
      const fs = fitRef.current;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      if (newZoom === zoom) return;
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      // mantener el punto bajo el cursor estable
      const wx = (cx - pan.x) / (fs * zoom);
      const wy = (cy - pan.y) / (fs * zoom);
      let nx = cx - wx * fs * newZoom;
      let ny = cy - wy * fs * newZoom;
      if (newZoom === 1) {
        nx = (wrap.clientWidth - imageSize.width * fs) / 2;
        ny = (wrap.clientHeight - imageSize.height * fs) / 2;
      }
      setView({ zoom: newZoom, pan: clampPan({ x: nx, y: ny }, wrap, imageSize, fs * newZoom) });
    },
    [imageSize]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onWheel(e) {
      if (!imageSize) return;
      e.preventDefault();
      // pinch de trackpad llega como wheel+ctrlKey (delta más fino)
      const intensity = e.ctrlKey ? 0.012 : 0.0022;
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * intensity));
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [imageSize, zoomAt]);

  // espacio = pan con arrastre
  useEffect(() => {
    function down(e) {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        setSpaceDown(true);
        e.preventDefault();
      }
    }
    function up(e) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ---- coordenadas ----
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
    const lw = Math.max(1.5, 2 / effScale);
    ctx.lineWidth = lw;
    ctx.setLineDash([8 / effScale, 6 / effScale]);
    ctx.lineDashOffset = -antsPhase.current;
    ctx.strokeStyle = "rgba(214, 246, 75, 0.95)";
    ctx.shadowColor = "rgba(214, 246, 75, 0.6)";
    ctx.shadowBlur = 6 / effScale;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(214, 246, 75, 0.06)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  function antsLoop() {
    antsPhase.current += 0.9 / effScale;
    drawAnts();
    if (drawing.current && mode === "rect") {
      antsRaf.current = requestAnimationFrame(antsLoop);
    }
  }

  // ---- input ----
  function cancelDrawing() {
    if (!drawing.current) return;
    drawing.current = false;
    cancelAnimationFrame(antsRaf.current);
    currentRect.current = null;
    strokePoints.current = [];
    clearGuide();
  }

  function handleDown(e) {
    if (!imageSize) return;
    e.preventDefault();
    try {
      guideRef.current.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointers sintéticos (tests) no se pueden capturar */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // dos dedos → gesto de zoom/pan táctil
    if (pointers.current.size === 2) {
      cancelDrawing();
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom0: viewRef.current.zoom,
        pan0: { ...viewRef.current.pan },
      };
      return;
    }

    // pan: espacio o botón central
    if (spaceDown || e.button === 1) {
      panDrag.current = { sx: e.clientX, sy: e.clientY, pan0: { ...viewRef.current.pan } };
      return;
    }

    if (busy || compare) return;
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
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // pinch en curso
    if (gesture.current && pointers.current.size >= 2) {
      const wrap = wrapRef.current;
      const rect = wrap.getBoundingClientRect();
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const g = gesture.current;
      const fs = fitRef.current;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (g.zoom0 * d) / (g.d0 || 1)));
      const cx = g.mid0.x - rect.left;
      const cy = g.mid0.y - rect.top;
      const wx = (cx - g.pan0.x) / (fs * g.zoom0);
      const wy = (cy - g.pan0.y) / (fs * g.zoom0);
      const nx = mid.x - rect.left - wx * fs * newZoom;
      const ny = mid.y - rect.top - wy * fs * newZoom;
      setView({
        zoom: newZoom,
        pan: clampPan({ x: nx, y: ny }, wrap, imageSize, fs * newZoom),
      });
      return;
    }

    if (panDrag.current) {
      const p = panDrag.current;
      const wrap = wrapRef.current;
      setView((v) => ({
        zoom: v.zoom,
        pan: clampPan(
          { x: p.pan0.x + e.clientX - p.sx, y: p.pan0.y + e.clientY - p.sy },
          wrap,
          imageSize,
          fitRef.current * v.zoom
        ),
      }));
      return;
    }

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
    pointers.current.delete(e.pointerId);
    if (gesture.current && pointers.current.size < 2) gesture.current = null;
    if (panDrag.current) {
      panDrag.current = null;
      return;
    }
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

  // ---- divisor del comparador ----
  function compareDown(e) {
    e.stopPropagation();
    e.preventDefault();
    compareDrag.current = true;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {
      /* ídem */
    }
  }

  function compareMove(e) {
    if (!compareDrag.current) return;
    const rect = wrapRef.current
      .querySelector(".canvas-stage")
      .getBoundingClientRect();
    setComparePos(Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width)));
  }

  function compareUp() {
    compareDrag.current = false;
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
  const showGhost = isBrush && cursorPos && !busy && !compare && !spaceDown;
  const cursor = spaceDown
    ? "grab"
    : compare
      ? "default"
      : mode === "rect"
        ? "crosshair"
        : "none";
  const clipRight = `inset(0 0 0 ${comparePos * 100}%)`;

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
          className={`canvas-stage ${resultUrl ? "has-result" : ""} ${compare ? "comparing" : ""}`}
          style={{
            position: "absolute",
            left: view.pan.x,
            top: view.pan.y,
            width: imageSize.width * effScale,
            height: imageSize.height * effScale,
          }}
        >
          <div className="checker" style={compare ? { clipPath: clipRight } : undefined} />
          <canvas ref={baseRef} className="layer base" />
          <canvas
            ref={resultRef}
            className="layer result"
            style={compare ? { clipPath: clipRight } : undefined}
          />
          <canvas
            ref={guideRef}
            className="layer guide"
            style={{ cursor, touchAction: "none" }}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            onDoubleClick={() => resetView()}
          />
          {compare && (
            <>
              <span className="compare-tag compare-tag-left" aria-hidden>
                {t("compare.before")}
              </span>
              <span className="compare-tag compare-tag-right" aria-hidden>
                {t("compare.after")}
              </span>
              <div
                className="compare-divider"
                role="slider"
                aria-label={t("compare.aria")}
                aria-valuenow={Math.round(comparePos * 100)}
                style={{ left: `${comparePos * 100}%` }}
                onPointerDown={compareDown}
                onPointerMove={compareMove}
                onPointerUp={compareUp}
                onPointerCancel={compareUp}
              >
                <span className="compare-handle">◂▸</span>
              </div>
            </>
          )}
          {busy && (
            <div className="canvas-busy" role="status" aria-live="polite">
              <span className="busy-dot" aria-hidden /> {t("busy")}
            </div>
          )}
        </div>
      )}

      {imageUrl && imageSize && (
        <div className="canvas-hud">
          {resultUrl && (
            <button
              className={`hud-btn ${compare ? "hud-btn-on" : ""}`}
              aria-pressed={compare}
              title={`${t("compare.toggle")} (C)`}
              onClick={() => onCompareChange(!compare)}
            >
              ◐ {t("compare.toggle")}
            </button>
          )}
          <button
            className="hud-btn"
            title={t("zoom.reset")}
            onClick={() => resetView()}
            disabled={view.zoom === 1}
          >
            {Math.round(view.zoom * 100)}%
          </button>
        </div>
      )}

      {showGhost && (
        <div
          className={`brush-ghost ${mode === "bg" ? "brush-ghost-bg" : ""}`}
          style={{
            width: brushSize * effScale,
            height: brushSize * effScale,
            transform: `translate(${cursorPos.x}px, ${cursorPos.y}px) translate(-50%, -50%)`,
          }}
        />
      )}
    </div>
  );
}

function clampPan(pan, wrap, imageSize, scale) {
  // dejar siempre al menos 60px del lienzo visible
  const margin = 60;
  const w = imageSize.width * scale;
  const h = imageSize.height * scale;
  return {
    x: Math.max(margin - w, Math.min(wrap.clientWidth - margin, pan.x)),
    y: Math.max(margin - h, Math.min(wrap.clientHeight - margin, pan.y)),
  };
}

function normRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

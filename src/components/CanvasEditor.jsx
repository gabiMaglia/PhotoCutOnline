import { useRef, useEffect, useState, useCallback } from "react";

// The interactive canvas. Handles three input modes:
//  - "rect":  drag a bounding box around the object
//  - "fg":    paint definite-foreground strokes
//  - "bg":    paint definite-background strokes
//
// It reports a rect (on mouse-up) or a stroke (on mouse-up) to the parent,
// and renders the current cutout preview underneath a checkerboard.

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
  const overlayRef = useRef(null);
  const [scale, setScale] = useState(1);
  const drawing = useRef(false);
  const start = useRef(null);
  const strokePoints = useRef([]);

  // Fit the image to the available width while preserving aspect ratio.
  const recomputeScale = useCallback(() => {
    if (!imageSize || !wrapRef.current) return;
    const avail = wrapRef.current.clientWidth - 32;
    const s = Math.min(1, avail / imageSize.width);
    setScale(s > 0 ? s : 1);
  }, [imageSize]);

  useEffect(() => {
    recomputeScale();
    window.addEventListener("resize", recomputeScale);
    return () => window.removeEventListener("resize", recomputeScale);
  }, [recomputeScale]);

  // Draw the base photo whenever it changes.
  useEffect(() => {
    if (!imageUrl || !imageSize) return;
    const base = baseRef.current;
    base.width = imageSize.width;
    base.height = imageSize.height;
    const ctx = base.getContext("2d");
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = imageUrl;
    // Overlay must match base dimensions so mouse events cover the full canvas.
    const overlay = overlayRef.current;
    overlay.width = imageSize.width;
    overlay.height = imageSize.height;
  }, [imageUrl, imageSize]);

  // The result preview lives in its own layer on top of the checkerboard.
  useEffect(() => {
    if (!resultUrl || !imageSize) return;
    const canvas = overlayRef.current;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = resultUrl;
  }, [resultUrl, imageSize]);

  function toImageCoords(e) {
    const rect = baseRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);
    return {
      x: Math.max(0, Math.min(imageSize.width - 1, x)),
      y: Math.max(0, Math.min(imageSize.height - 1, y)),
    };
  }

  function handleDown(e) {
    if (busy) return;
    drawing.current = true;
    const p = toImageCoords(e);
    start.current = p;
    strokePoints.current = [];
    if (mode !== "rect") {
      collectStroke(p);
    }
  }

  function handleMove(e) {
    if (!drawing.current || busy) return;
    const p = toImageCoords(e);
    if (mode === "rect") {
      drawRectGuide(start.current, p);
    } else {
      collectStroke(p);
    }
  }

  function handleUp(e) {
    if (!drawing.current || busy) return;
    drawing.current = false;
    const p = toImageCoords(e);
    if (mode === "rect") {
      const r = normRect(start.current, p);
      clearGuide();
      if (r.w > 4 && r.h > 4) onRect(r);
    } else {
      onStroke({ points: strokePoints.current, foreground: mode === "fg" });
      clearGuide();
    }
  }

  // Brush: fill a disc of `brushSize` radius around the point, collect pixels.
  function collectStroke(center) {
    const r = Math.max(1, Math.round(brushSize / 2));
    const pts = strokePoints.current;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        if (x >= 0 && y >= 0 && x < imageSize.width && y < imageSize.height) {
          pts.push([x, y]);
        }
      }
    }
    paintGuideDisc(center, r, mode === "fg");
  }

  function ctxGuide() {
    return overlayRef.current.getContext("2d");
  }

  function paintGuideDisc(center, r, fg) {
    const ctx = ctxGuide();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = fg ? "#e8a33d" : "#3d7de8";
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRectGuide(a, b) {
    const ctx = ctxGuide();
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (resultUrl) {
      const img = new Image();
      img.src = resultUrl; // best-effort; guide redrawn over it
    }
    const r = normRect(a, b);
    ctx.save();
    ctx.strokeStyle = "#e8a33d";
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  function clearGuide() {
    // re-render result preview cleanly
    const ctx = ctxGuide();
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (resultUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = resultUrl;
    }
  }

  const cursor =
    mode === "rect" ? "crosshair" : busy ? "wait" : "cell";

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      {!imageUrl && (
        <div className="canvas-empty">
          <p>Open a photo to begin. Drag a box around the object you want to keep.</p>
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
          <canvas ref={baseRef} className="layer base" style={layerStyle(scale)} />
          <canvas
            ref={overlayRef}
            className="layer overlay"
            style={{ ...layerStyle(scale), cursor }}
            onMouseDown={handleDown}
            onMouseMove={handleMove}
            onMouseUp={handleUp}
            onMouseLeave={handleUp}
          />
          {busy && <div className="canvas-busy">Computing cutout…</div>}
        </div>
      )}
    </div>
  );
}

function layerStyle(scale) {
  return {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };
}

function normRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

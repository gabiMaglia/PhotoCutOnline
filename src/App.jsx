import { useState, useCallback } from "react";
import CanvasEditor from "./components/CanvasEditor.jsx";
import { backend } from "./lib/backend.js";

const ITERS = 4;

export default function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [mode, setMode] = useState("rect");
  const [brushSize, setBrushSize] = useState(24);
  const [busy, setBusy] = useState(false);
  const [hasCut, setHasCut] = useState(false);
  const [error, setError] = useState(null);

  const openFile = useCallback(async (file) => {
    setError(null);
    const dataUrl = await fileToDataUrl(file);
    setImageUrl(dataUrl);
    setResultUrl(null);
    setHasCut(false);
    try {
      const { width, height } = await backend.loadImage(dataUrl);
      setImageSize({ width, height });
      setMode("rect");
    } catch (e) {
      setError(String(e));
    }
  }, []);

  function onFileInput(e) {
    const f = e.target.files?.[0];
    if (f) openFile(f);
  }

  const handleRect = useCallback(async (rect) => {
    setBusy(true);
    setError(null);
    try {
      const url = await backend.cutRect(rect, ITERS);
      setResultUrl(url);
      setHasCut(true);
      setMode("fg");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleStroke = useCallback(async (stroke) => {
    if (!stroke.points.length) return;
    setBusy(true);
    setError(null);
    try {
      const url = await backend.refine([stroke], 2);
      setResultUrl(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  async function exportAs(kind, arg) {
    setBusy(true);
    setError(null);
    try {
      let url;
      if (kind === "transparent") url = await backend.exportTransparent();
      else if (kind === "solid") url = await backend.exportSolid(arg);
      else if (kind === "image") url = await backend.exportImageBg(arg);
      downloadDataUrl(url, `photocut-${kind}.png`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function chooseBackgroundImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    exportAs("image", dataUrl);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>◑</span>
          <span className="brand-name">PhotoCut Studio</span>
          <span className="brand-env">{backend.isDesktop ? "Desktop" : "Web"}</span>
        </div>
        <label className="btn btn-primary">
          Open photo
          <input type="file" accept="image/*" hidden onChange={onFileInput} />
        </label>
      </header>

      <div className="body">
        <aside className="rail">
          <section className="rail-group">
            <h2 className="rail-title">Mark</h2>
            <ToolButton active={mode === "rect"} onClick={() => setMode("rect")} disabled={!imageUrl}>
              <span className="tool-key">1</span> Box select
            </ToolButton>
            <ToolButton active={mode === "fg"} onClick={() => setMode("fg")} disabled={!hasCut}>
              <span className="tool-key">2</span> Keep brush
            </ToolButton>
            <ToolButton active={mode === "bg"} onClick={() => setMode("bg")} disabled={!hasCut}>
              <span className="tool-key">3</span> Remove brush
            </ToolButton>

            <div className={`slider ${mode === "rect" ? "slider-off" : ""}`}>
              <label htmlFor="brush">Brush size — {brushSize}px</label>
              <input
                id="brush"
                type="range"
                min="4"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                disabled={mode === "rect"}
              />
            </div>
          </section>

          <section className="rail-group">
            <h2 className="rail-title">Export</h2>
            <button className="btn" disabled={!hasCut || busy} onClick={() => exportAs("transparent")}>
              Transparent PNG
            </button>
            <ColorExport disabled={!hasCut || busy} onExport={(c) => exportAs("solid", c)} />
            <label className={`btn ${!hasCut || busy ? "btn-disabled" : ""}`}>
              New background image
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={!hasCut || busy}
                onChange={chooseBackgroundImage}
              />
            </label>
          </section>

          <div className="rail-help">
            <p>
              1 — Drag a box around your subject. 2 / 3 — paint to fix any edges the
              cut missed. Export when it looks right.
            </p>
          </div>
        </aside>

        <main className="workspace">
          {error && <div className="error-banner">{error}</div>}
          <CanvasEditor
            imageUrl={imageUrl}
            imageSize={imageSize}
            resultUrl={resultUrl}
            mode={mode}
            brushSize={brushSize}
            onRect={handleRect}
            onStroke={handleStroke}
            busy={busy}
          />
        </main>
      </div>
    </div>
  );
}

function ToolButton({ active, children, ...rest }) {
  return (
    <button className={`tool ${active ? "tool-active" : ""}`} {...rest}>
      {children}
    </button>
  );
}

function ColorExport({ disabled, onExport }) {
  const [color, setColor] = useState("#ffffff");
  return (
    <div className="color-export">
      <input
        type="color"
        value={color}
        disabled={disabled}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Background color"
      />
      <button className="btn btn-small" disabled={disabled} onClick={() => onExport(hexToRgba(color))}>
        Solid color
      </button>
    </div>
  );
}

function hexToRgba(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255,
  ];
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downloadDataUrl(dataUrl, name) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

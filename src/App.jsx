import { useState, useCallback, useEffect, useRef } from "react";
import CanvasEditor from "./components/CanvasEditor.jsx";
import IconStudio from "./components/IconStudio.jsx";
import { backend } from "./lib/backend.js";

const ITERS = 4;

export default function App() {
  const [tab, setTab] = useState("cut"); // cut | icons
  const [imageUrl, setImageUrl] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [mode, setMode] = useState("rect");
  const [brushSize, setBrushSize] = useState(28);
  const [feather, setFeather] = useState(2);
  const [busy, setBusy] = useState(false);
  const [hasCut, setHasCut] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [format, setFormat] = useState("png");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBg, setPreviewBg] = useState("checker"); // checker | white | black | color
  const [previewColor, setPreviewColor] = useState("#ffffff");
  const [dragging, setDragging] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const dragDepth = useRef(0);

  const toast = useCallback((text, kind = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const refreshUndo = useCallback(() => setCanUndo(backend.canUndo()), []);

  const openFile = useCallback(
    async (file) => {
      if (!file.type.startsWith("image/")) {
        toast("Ese archivo no es una imagen", "error");
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setImageUrl(dataUrl);
      setResultUrl(null);
      setHasCut(false);
      setCanUndo(false);
      setTab("cut");
      try {
        const { width, height } = await backend.loadImage(dataUrl);
        setImageSize({ width, height });
        setMode("rect");
        toast(`${width} × ${height} px cargados`, "ok");
      } catch (e) {
        toast(String(e), "error");
      }
    },
    [toast]
  );

  function onFileInput(e) {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = "";
  }

  // ---- drag & drop + pegar ----
  useEffect(() => {
    function onDragEnter(e) {
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    }
    function onDragOver(e) {
      e.preventDefault();
    }
    function onDragLeave(e) {
      e.preventDefault();
      if (--dragDepth.current <= 0) {
        dragDepth.current = 0;
        setDragging(false);
      }
    }
    function onDrop(e) {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) openFile(f);
    }
    function onPaste(e) {
      const item = [...(e.clipboardData?.items || [])].find((i) =>
        i.type.startsWith("image/")
      );
      if (item) {
        const f = item.getAsFile();
        if (f) openFile(f);
      }
    }
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [openFile]);

  // ---- acciones de recorte ----
  const handleRect = useCallback(
    async (rect) => {
      setBusy(true);
      try {
        const url = await backend.cutRect(rect, ITERS);
        setResultUrl(url);
        setHasCut(true);
        setMode("fg");
        refreshUndo();
        toast("Recorte listo — pinta para afinar bordes", "ok");
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [toast, refreshUndo]
  );

  const handleAuto = useCallback(async () => {
    if (!imageUrl || busy) return;
    setBusy(true);
    try {
      const url = await backend.autoCut();
      setResultUrl(url);
      setHasCut(true);
      setMode("fg");
      refreshUndo();
      toast("Recorte automático aplicado", "ok");
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }, [imageUrl, busy, toast, refreshUndo]);

  const handleStroke = useCallback(
    async (stroke) => {
      if (!stroke.points.length) return;
      setBusy(true);
      try {
        const url = await backend.refine(stroke, 2);
        setResultUrl(url);
        refreshUndo();
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [toast, refreshUndo]
  );

  const handleUndo = useCallback(async () => {
    if (!backend.canUndo()) return;
    const url = await backend.undo();
    setResultUrl(url);
    setHasCut(!!url);
    if (!url) setMode("rect");
    refreshUndo();
  }, [refreshUndo]);

  const handleFeather = useCallback(
    async (value) => {
      setFeather(value);
      const url = await backend.setFeather(value);
      if (url) setResultUrl(url);
    },
    []
  );

  // ---- exportación ----
  const exportAs = useCallback(
    async (kind, arg) => {
      setBusy(true);
      try {
        const opts = { format, quality: 0.92 };
        let url;
        if (kind === "transparent") url = await backend.exportTransparent(opts);
        else if (kind === "solid") url = await backend.exportSolid(arg, opts);
        else if (kind === "image") url = await backend.exportImageBg(arg, opts);
        const ext = format === "jpeg" ? "jpg" : format;
        downloadDataUrl(url, `photocut-${kind}.${kind === "transparent" ? "png" : ext}`);
        toast("Exportado ✓", "ok");
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [format, toast]
  );

  const copyToClipboard = useCallback(async () => {
    setBusy(true);
    try {
      const url = await backend.exportTransparent({ format: "png" });
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("PNG copiado al portapapeles ✓", "ok");
    } catch (e) {
      toast(`No se pudo copiar: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }, [toast]);

  async function chooseBackgroundImage(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    exportAs("image", dataUrl);
  }

  // ---- atajos de teclado ----
  useEffect(() => {
    function onKey(e) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "1":
          if (imageUrl) setMode("rect");
          break;
        case "2":
          if (hasCut) setMode("fg");
          break;
        case "3":
          if (hasCut) setMode("bg");
          break;
        case "a":
        case "A":
          if (backend.features.auto) handleAuto();
          break;
        case "[":
          setBrushSize((s) => Math.max(4, s - 4));
          break;
        case "]":
          setBrushSize((s) => Math.min(120, s + 4));
          break;
        case "e":
        case "E":
          if (hasCut && !busy) exportAs("transparent");
          break;
        case "p":
        case "P":
          if (hasCut) setPreviewOpen((v) => !v);
          break;
        default:
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageUrl, hasCut, busy, handleUndo, handleAuto, exportAs]);

  const getCutout = useCallback(() => backend.exportTransparent({ format: "png" }), []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>◑</span>
          <span className="brand-name">PhotoCut</span>
          <span className="brand-sub">Studio</span>
          <span className="brand-env">{backend.isDesktop ? "Desktop" : "Web"}</span>
        </div>

        <nav className="tabs" role="tablist" aria-label="Espacios de trabajo">
          <button
            role="tab"
            aria-selected={tab === "cut"}
            className={`tab ${tab === "cut" ? "tab-active" : ""}`}
            onClick={() => setTab("cut")}
          >
            Recorte
          </button>
          <button
            role="tab"
            aria-selected={tab === "icons"}
            className={`tab ${tab === "icons" ? "tab-active" : ""}`}
            onClick={() => setTab("icons")}
          >
            Icon Studio
          </button>
        </nav>

        <label className="btn btn-primary">
          Abrir foto
          <input type="file" accept="image/*" hidden onChange={onFileInput} />
        </label>
      </header>

      {tab === "cut" && (
        <div className="body">
          <aside className="rail">
            <section className="rail-group">
              <h2 className="rail-title">Marcar</h2>
              {backend.features.auto && (
                <button
                  className="btn btn-auto"
                  disabled={!imageUrl || busy}
                  onClick={handleAuto}
                >
                  <span className="tool-key">A</span> Recorte automático
                </button>
              )}
              <ToolButton active={mode === "rect"} onClick={() => setMode("rect")} disabled={!imageUrl}>
                <span className="tool-key">1</span> Recuadro
              </ToolButton>
              <ToolButton active={mode === "fg"} onClick={() => setMode("fg")} disabled={!hasCut}>
                <span className="tool-key">2</span> Pincel mantener
              </ToolButton>
              <ToolButton active={mode === "bg"} onClick={() => setMode("bg")} disabled={!hasCut}>
                <span className="tool-key">3</span> Pincel quitar
              </ToolButton>

              <div className={`slider ${mode === "rect" ? "slider-off" : ""}`}>
                <label htmlFor="brush">Pincel — {brushSize}px <kbd>[</kbd><kbd>]</kbd></label>
                <input
                  id="brush"
                  type="range"
                  min="4"
                  max="120"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  disabled={mode === "rect"}
                />
              </div>

              {backend.features.feather && (
                <div className={`slider ${!hasCut ? "slider-off" : ""}`}>
                  <label htmlFor="feather">Suavizado de borde — {feather}px</label>
                  <input
                    id="feather"
                    type="range"
                    min="0"
                    max="20"
                    value={feather}
                    onChange={(e) => handleFeather(Number(e.target.value))}
                    disabled={!hasCut}
                  />
                </div>
              )}

              {backend.features.undo && (
                <button className="btn btn-small" disabled={!canUndo || busy} onClick={handleUndo}>
                  ↩ Deshacer <kbd>⌘Z</kbd>
                </button>
              )}
            </section>

            <section className="rail-group">
              <h2 className="rail-title">Exportar</h2>
              <button
                className={`btn ${previewOpen ? "btn-primary" : ""}`}
                disabled={!hasCut}
                aria-pressed={previewOpen}
                onClick={() => setPreviewOpen((v) => !v)}
              >
                {previewOpen ? "Ocultar vista previa" : "Vista previa"} <kbd>P</kbd>
              </button>
              {backend.features.formats && (
                <div className="format-row" role="radiogroup" aria-label="Formato">
                  {["png", "webp", "jpeg"].map((f) => (
                    <button
                      key={f}
                      role="radio"
                      aria-checked={format === f}
                      className={`chip ${format === f ? "chip-on" : ""}`}
                      onClick={() => setFormat(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <button className="btn" disabled={!hasCut || busy} onClick={() => exportAs("transparent")}>
                PNG transparente <kbd>E</kbd>
              </button>
              {backend.features.clipboard && (
                <button className="btn" disabled={!hasCut || busy} onClick={copyToClipboard}>
                  Copiar al portapapeles
                </button>
              )}
              <ColorExport disabled={!hasCut || busy} onExport={(c) => exportAs("solid", c)} />
              <label className={`btn ${!hasCut || busy ? "btn-disabled" : ""}`}>
                Fondo con otra imagen
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={!hasCut || busy}
                  onChange={chooseBackgroundImage}
                />
              </label>
              <button
                className="btn"
                disabled={!hasCut || busy}
                onClick={() => setTab("icons")}
              >
                → Crear iconos de app
              </button>
            </section>

            <div className="rail-help">
              <p>
                <strong>A</strong> automático · <strong>1</strong> recuadro ·{" "}
                <strong>2/3</strong> pinceles · <strong>P</strong> vista previa ·{" "}
                <strong>E</strong> exportar. Arrastra o pega (⌘V) cualquier imagen.
              </p>
            </div>
          </aside>

          <main className="workspace">
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
      )}

      {tab === "icons" && (
        <div className="body">
          <IconStudio getCutout={getCutout} hasCut={hasCut} onToast={toast} />
        </div>
      )}

      {tab === "cut" && previewOpen && hasCut && resultUrl && (
        <div className="preview-panel">
          <div className="preview-panel-head">
            <span className="preview-panel-title">Vista previa</span>
            <div className="preview-bg-switch" role="radiogroup" aria-label="Fondo de la vista previa">
              <button
                className={`bg-chip bg-chip-checker ${previewBg === "checker" ? "bg-chip-on" : ""}`}
                onClick={() => setPreviewBg("checker")}
                aria-label="Fondo transparente"
                aria-pressed={previewBg === "checker"}
              />
              <button
                className={`bg-chip bg-chip-white ${previewBg === "white" ? "bg-chip-on" : ""}`}
                onClick={() => setPreviewBg("white")}
                aria-label="Fondo blanco"
                aria-pressed={previewBg === "white"}
              />
              <button
                className={`bg-chip bg-chip-black ${previewBg === "black" ? "bg-chip-on" : ""}`}
                onClick={() => setPreviewBg("black")}
                aria-label="Fondo negro"
                aria-pressed={previewBg === "black"}
              />
              <input
                type="color"
                className={`bg-chip bg-chip-color ${previewBg === "color" ? "bg-chip-on" : ""}`}
                value={previewColor}
                onChange={(e) => {
                  setPreviewColor(e.target.value);
                  setPreviewBg("color");
                }}
                aria-label="Color de fondo personalizado"
              />
            </div>
            <button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa">
              ×
            </button>
          </div>
          <div
            className={`preview-body preview-bg-${previewBg}`}
            style={previewBg === "color" ? { background: previewColor } : undefined}
          >
            {previewBg === "checker" && <div className="checker" />}
            <img src={resultUrl} alt="Vista previa del recorte sobre el fondo elegido" />
          </div>
        </div>
      )}

      {dragging && (
        <div className="drop-veil" aria-hidden>
          <div className="drop-veil-inner">Suéltala aquí</div>
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
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
        aria-label="Color de fondo"
      />
      <button className="btn btn-small" disabled={disabled} onClick={() => onExport(hexToRgba(color))}>
        Color sólido
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

import { useState, useCallback, useEffect, useRef } from "react";
import CanvasEditor from "./components/CanvasEditor.jsx";
import IconStudio from "./components/IconStudio.jsx";
import AboutModal from "./components/AboutModal.jsx";
import DownloadModal from "./components/DownloadModal.jsx";
import HelpModal from "./components/HelpModal.jsx";
import Onboarding from "./components/Onboarding.jsx";
import { backend } from "./lib/backend.js";
import { EXPORT_PRESETS } from "./lib/presets.js";
import { t, useLang, setLang, LANGS } from "./lib/i18n.js";
import pkg from "../package.json";
import {
  inspectImageFile,
  bitmapToDataUrl,
  formatMegapixels,
  DOWNSCALE_MAX_DIM,
} from "./lib/imageFile.js";

const ITERS = 4;

export default function App() {
  useLang(); // re-render al cambiar idioma
  const [tab, setTab] = useState("cut"); // cut | icons
  const [imageUrl, setImageUrl] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [mode, setMode] = useState("rect");
  const [brushSize, setBrushSize] = useState(28);
  const [feather, setFeather] = useState(2);
  const [stickerOn, setStickerOn] = useState(false);
  const [stickerWidth, setStickerWidth] = useState(14);
  const [shadowOn, setShadowOn] = useState(false);
  const [shadowSize, setShadowSize] = useState(40);
  const [presetId, setPresetId] = useState("original");
  const [busy, setBusy] = useState(false);
  const [hasCut, setHasCut] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [format, setFormat] = useState("png");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBg, setPreviewBg] = useState("checker"); // checker | white | black | color
  const [previewColor, setPreviewColor] = useState("#ffffff");
  const [dragging, setDragging] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(
    () => !localStorage.getItem("pc-onboarded")
  );
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const dragDepth = useRef(0);

  const toast = useCallback((text, kind = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const refreshUndo = useCallback(() => {
    setCanUndo(backend.canUndo());
    setCanRedo(backend.canRedo());
  }, []);

  const [pendingLarge, setPendingLarge] = useState(null); // {file,bitmap,width,height}

  const loadDataUrl = useCallback(
    async (dataUrl, note) => {
      setImageUrl(dataUrl);
      setResultUrl(null);
      setHasCut(false);
      setCanUndo(false);
      setTab("cut");
      try {
        const { width, height } = await backend.loadImage(dataUrl);
        setImageSize({ width, height });
        setMode("rect");
        toast(note || t("toast.loaded", { w: width, h: height }), "ok");
      } catch (e) {
        toast(String(e), "error");
      }
    },
    [toast]
  );

  const openFile = useCallback(
    async (file) => {
      const res = await inspectImageFile(file);
      if (res.kind === "heic") {
        toast(t("toast.heic"), "error");
        return;
      }
      if (res.kind === "undecodable") {
        toast(t("toast.unreadable"), "error");
        return;
      }
      if (res.kind === "oversized") {
        // no decidir por el usuario: ofrecer reducir a 4K o cancelar
        setPendingLarge({ file, ...res });
        return;
      }
      res.bitmap.close();
      await loadDataUrl(await fileToDataUrl(file));
    },
    [toast, loadDataUrl]
  );

  const confirmReduceLarge = useCallback(async () => {
    const p = pendingLarge;
    if (!p) return;
    setPendingLarge(null);
    const dataUrl = bitmapToDataUrl(p.bitmap, DOWNSCALE_MAX_DIM, p.file.type);
    p.bitmap.close();
    await loadDataUrl(dataUrl, t("toast.reduced", { w: p.width, h: p.height }));
  }, [pendingLarge, loadDataUrl]);

  const cancelLarge = useCallback(() => {
    pendingLarge?.bitmap.close();
    setPendingLarge(null);
  }, [pendingLarge]);

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
        toast(t("toast.cut"), "ok");
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
      toast(t("toast.auto"), "ok");
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

  const handleRedo = useCallback(async () => {
    if (!backend.canRedo()) return;
    const url = await backend.redo();
    if (url) {
      setResultUrl(url);
      setHasCut(true);
    }
    refreshUndo();
  }, [refreshUndo]);

  const finishTimer = useRef(null);
  const applyFinish = useCallback((sticker, sw, shadow, ss) => {
    clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(async () => {
      const finish = {
        sticker: sticker ? { width: sw, color: [255, 255, 255] } : null,
        shadow: shadow
          ? { blur: 8 + ss * 0.5, dx: 0, dy: 4 + ss * 0.3, opacity: 0.25 + ss * 0.004 }
          : null,
      };
      const url = await backend.setFinish(finish);
      if (url) setResultUrl(url);
    }, 120);
  }, []);

  const featherTimer = useRef(null);
  const handleFeather = useCallback((value) => {
    setFeather(value);
    // debounce: el slider dispara muchos eventos seguidos; recalcular el
    // preview solo cuando el usuario se detiene
    clearTimeout(featherTimer.current);
    featherTimer.current = setTimeout(async () => {
      const url = await backend.setFeather(value);
      if (url) setResultUrl(url);
    }, 120);
  }, []);

  // ---- exportación ----
  const exportAs = useCallback(
    async (kind, arg) => {
      setBusy(true);
      try {
        const preset = EXPORT_PRESETS.find((p) => p.id === presetId)?.preset || null;
        const opts = { format, quality: 0.92, ...(preset ? { preset } : {}) };
        let url;
        if (kind === "transparent") url = await backend.exportTransparent(opts);
        else if (kind === "solid") url = await backend.exportSolid(arg, opts);
        else if (kind === "image") url = await backend.exportImageBg(arg, opts);
        const ext = format === "jpeg" ? "jpg" : format;
        downloadDataUrl(url, `photocut-${kind}.${kind === "transparent" ? "png" : ext}`);
        toast(t("toast.exported"), "ok");
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [format, presetId, toast]
  );

  const copyToClipboard = useCallback(async () => {
    setBusy(true);
    try {
      const url = await backend.exportTransparent({ format: "png" });
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast(t("toast.copied"), "ok");
    } catch (e) {
      toast(t("toast.copyfail", { e }), "error");
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
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (e.key === "Escape") {
        setHelpOpen(false);
        setAboutOpen(false);
        setDlOpen(false);
        setPreviewOpen(false);
        cancelLarge();
        return;
      }
      if (e.key === "?") {
        setHelpOpen((v) => !v);
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
  }, [imageUrl, hasCut, busy, handleUndo, handleRedo, handleAuto, exportAs, cancelLarge]);

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
            {t("tab.cut")}
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

        <div className="topbar-actions">
          <label className="btn btn-primary">
            {t("openPhoto")}
            <input type="file" accept="image/*" hidden onChange={onFileInput} />
          </label>
          <LangSwitch />
          {!backend.isDesktop && (
            <button
              className="btn-icon"
              aria-label={t("dl.aria")}
              title={t("dl.aria")}
              onClick={() => setDlOpen(true)}
            >
              ⬇
            </button>
          )}
          <button
            className="btn-icon"
            aria-label={t("about.aria")}
            onClick={() => setAboutOpen(true)}
          >
            ⓘ
          </button>
        </div>
      </header>

      {tab === "cut" && (
        <div className="body">
          <aside className="rail">
            <section className="rail-group">
              <h2 className="rail-title">{t("rail.mark")}</h2>
              {backend.features.auto && (
                <button
                  className="btn btn-auto"
                  disabled={!imageUrl || busy}
                  onClick={handleAuto}
                >
                  <span className="tool-key">A</span> {t("tool.auto")}
                </button>
              )}
              <ToolButton active={mode === "rect"} onClick={() => setMode("rect")} disabled={!imageUrl}>
                <span className="tool-key">1</span> {t("tool.rect")}
              </ToolButton>
              <ToolButton active={mode === "fg"} onClick={() => setMode("fg")} disabled={!hasCut}>
                <span className="tool-key">2</span> {t("tool.keep")}
              </ToolButton>
              <ToolButton active={mode === "bg"} onClick={() => setMode("bg")} disabled={!hasCut}>
                <span className="tool-key">3</span> {t("tool.remove")}
              </ToolButton>

              <div className={`slider ${mode === "rect" ? "slider-off" : ""}`}>
                <label htmlFor="brush">{t("brush.label", { n: brushSize })} <kbd>[</kbd><kbd>]</kbd></label>
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
                  <label htmlFor="feather">{t("feather.label", { n: feather })}</label>
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
                <div className="row-2">
                  <button className="btn btn-small" disabled={!canUndo || busy} onClick={handleUndo}>
                    {t("undo")} <kbd>⌘Z</kbd>
                  </button>
                  <button className="btn btn-small" disabled={!canRedo || busy} onClick={handleRedo}>
                    {t("redo")}
                  </button>
                </div>
              )}
            </section>

            {backend.features.finish && (
              <section className="rail-group">
                <h2 className="rail-title">{t("finish.title")}</h2>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={stickerOn}
                    disabled={!hasCut}
                    onChange={(e) => {
                      setStickerOn(e.target.checked);
                      applyFinish(e.target.checked, stickerWidth, shadowOn, shadowSize);
                    }}
                  />
                  {t("finish.sticker")}
                </label>
                <div className={`slider ${!stickerOn || !hasCut ? "slider-off" : ""}`}>
                  <label htmlFor="sticker-w">{t("finish.stickerWidth", { n: stickerWidth })}</label>
                  <input
                    id="sticker-w"
                    type="range"
                    min="4"
                    max="48"
                    value={stickerWidth}
                    disabled={!stickerOn || !hasCut}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setStickerWidth(v);
                      applyFinish(stickerOn, v, shadowOn, shadowSize);
                    }}
                  />
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={shadowOn}
                    disabled={!hasCut}
                    onChange={(e) => {
                      setShadowOn(e.target.checked);
                      applyFinish(stickerOn, stickerWidth, e.target.checked, shadowSize);
                    }}
                  />
                  {t("finish.shadow")}
                </label>
                <div className={`slider ${!shadowOn || !hasCut ? "slider-off" : ""}`}>
                  <label htmlFor="shadow-s">{t("finish.shadowSize", { n: shadowSize })}</label>
                  <input
                    id="shadow-s"
                    type="range"
                    min="10"
                    max="100"
                    value={shadowSize}
                    disabled={!shadowOn || !hasCut}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setShadowSize(v);
                      applyFinish(stickerOn, stickerWidth, shadowOn, v);
                    }}
                  />
                </div>
              </section>
            )}

            <section className="rail-group">
              <h2 className="rail-title">{t("rail.export")}</h2>
              <button
                className={`btn ${previewOpen ? "btn-primary" : ""}`}
                disabled={!hasCut}
                aria-pressed={previewOpen}
                onClick={() => setPreviewOpen((v) => !v)}
              >
                {previewOpen ? t("preview.hide") : t("preview.show")} <kbd>P</kbd>
              </button>
              {backend.features.finish && (
                <div className="field">
                  <label htmlFor="export-preset">{t("preset.label")}</label>
                  <select
                    id="export-preset"
                    className="preset-select"
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value)}
                  >
                    {EXPORT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t(p.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                {t("export.png")} <kbd>E</kbd>
              </button>
              {backend.features.clipboard && (
                <button className="btn" disabled={!hasCut || busy} onClick={copyToClipboard}>
                  {t("export.clipboard")}
                </button>
              )}
              <ColorExport disabled={!hasCut || busy} onExport={(c) => exportAs("solid", c)} />
              <label className={`btn ${!hasCut || busy ? "btn-disabled" : ""}`}>
                {t("export.image")}
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
                {t("export.icons")}
              </button>
            </section>

            <div className="rail-help">
              <p>{t("rail.help")}</p>
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
            <span className="preview-panel-title">{t("previewPanel.title")}</span>
            <div className="preview-bg-switch" role="radiogroup" aria-label={t("previewPanel.bgAria")}>
              <button
                className={`bg-chip bg-chip-checker ${previewBg === "checker" ? "bg-chip-on" : ""}`}
                onClick={() => setPreviewBg("checker")}
                aria-label={t("previewPanel.transparent")}
                aria-pressed={previewBg === "checker"}
              />
              <button
                className={`bg-chip bg-chip-white ${previewBg === "white" ? "bg-chip-on" : ""}`}
                onClick={() => setPreviewBg("white")}
                aria-label={t("previewPanel.white")}
                aria-pressed={previewBg === "white"}
              />
              <button
                className={`bg-chip bg-chip-black ${previewBg === "black" ? "bg-chip-on" : ""}`}
                onClick={() => setPreviewBg("black")}
                aria-label={t("previewPanel.black")}
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
                aria-label={t("previewPanel.custom")}
              />
            </div>
            <button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label={t("previewPanel.close")}>
              ×
            </button>
          </div>
          <div
            className={`preview-body preview-bg-${previewBg}`}
            style={previewBg === "color" ? { background: previewColor } : undefined}
          >
            {previewBg === "checker" && <div className="checker" />}
            <img src={resultUrl} alt={t("previewPanel.alt")} />
          </div>
        </div>
      )}

      {onboarding && (
        <Onboarding
          onDismiss={() => {
            localStorage.setItem("pc-onboarded", "1");
            setOnboarding(false);
          }}
        />
      )}

      {aboutOpen && <AboutModal version={pkg.version} onClose={() => setAboutOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {dlOpen && <DownloadModal onClose={() => setDlOpen(false)} />}

      {pendingLarge && (
        <div className="modal-veil" role="dialog" aria-modal="true" aria-labelledby="modal-large-title">
          <div className="modal">
            <h3 id="modal-large-title">{t("large.title")}</h3>
            <p>
              {t("large.body", {
                w: pendingLarge.width,
                h: pendingLarge.height,
                mp: formatMegapixels(pendingLarge.width, pendingLarge.height),
              })}
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" autoFocus onClick={confirmReduceLarge}>
                {t("large.reduce")}
              </button>
              <button className="btn" onClick={cancelLarge}>
                {t("large.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {dragging && (
        <div className="drop-veil" aria-hidden>
          <div className="drop-veil-inner">{t("drop.here")}</div>
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

function LangSwitch() {
  const lang = useLang();
  return (
    <select
      className="lang-select"
      value={lang}
      aria-label={t("lang.aria")}
      onChange={(e) => setLang(e.target.value)}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
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
        aria-label={t("export.bgcolor.aria")}
      />
      <button className="btn btn-small" disabled={disabled} onClick={() => onExport(hexToRgba(color))}>
        {t("export.solid")}
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

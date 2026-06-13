import { useState, useCallback, useEffect, useRef } from "react";
import CanvasEditor from "./components/CanvasEditor.jsx";
import IconStudio from "./components/IconStudio.jsx";
import AdSlot from "./components/AdSlot.jsx";
import Dropdown from "./components/Dropdown.jsx";
import { DONATE_URL } from "./lib/ads.js";
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
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasCut, setHasCut] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [format, setFormat] = useState("png");
  const [exportMode, setExportMode] = useState("transparent"); // transparent | solid | image
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState(null); // dataURL del fondo "imagen"
  const [bgOpacity, setBgOpacity] = useState(100);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBg, setPreviewBg] = useState("checker"); // checker | white | black | color
  const [previewColor, setPreviewColor] = useState("#ffffff");
  const [previewSize, setPreviewSize] = useState({ w: 220, h: 240 });
  const [previewPos, setPreviewPos] = useState(null); // null = anclado por CSS
  const [cutGhost, setCutGhost] = useState(null); // fantasma al arrastrar el recorte
  const previewResize = useRef(null);
  const previewDrag = useRef(null);
  const cutDrag = useRef(null);
  const workspaceRef = useRef(null);
  const previewPanelRef = useRef(null);

  function previewResizeDown(e) {
    e.preventDefault();
    previewResize.current = {
      sx: e.clientX,
      sy: e.clientY,
      w0: previewSize.w,
      h0: previewSize.h,
      x0: previewPos?.x ?? null,
      y0: previewPos?.y ?? null,
    };
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointers sintéticos */
    }
  }

  function previewResizeMove(e) {
    const r = previewResize.current;
    if (!r) return;
    // el handle está abajo-izquierda: arrastrar hacia la izquierda agranda
    const w = clampNum(r.w0 + (r.sx - e.clientX), 180, window.innerWidth * 0.7);
    setPreviewSize({
      w,
      h: clampNum(r.h0 + (e.clientY - r.sy), 170, window.innerHeight * 0.75),
    });
    // si el panel fue arrastrado (posición por left/top), el borde derecho
    // debe quedarse quieto mientras crece hacia la izquierda
    if (r.x0 != null) setPreviewPos({ x: r.x0 - (w - r.w0), y: r.y0 });
  }

  function previewResizeUp() {
    previewResize.current = null;
  }

  // ---- mover el panel de vista previa (por la cabecera) ----
  function previewDragDown(e) {
    if (e.target.closest("button, input")) return; // chips y cerrar siguen vivos
    e.preventDefault();
    const rect = previewPanelRef.current.getBoundingClientRect();
    previewDrag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointers sintéticos */
    }
  }

  function previewDragMove(e) {
    if (!previewDrag.current) return;
    const d = previewDrag.current;
    setPreviewPos({
      x: clampNum(e.clientX - d.dx, 8, window.innerWidth - 80),
      y: clampNum(e.clientY - d.dy, 8, window.innerHeight - 60),
    });
  }

  function previewDragUp() {
    previewDrag.current = null;
  }

  // ---- arrastrar el RECORTE del preview y soltarlo en el lienzo ----
  // (cargarlo como nueva imagen de trabajo para seguir editando sobre él)
  function cutDragDown(e) {
    e.preventDefault();
    cutDrag.current = { sx: e.clientX, sy: e.clientY };
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointers sintéticos */
    }
    setCutGhost({ x: e.clientX, y: e.clientY });
  }

  function cutDragMove(e) {
    if (cutDrag.current) setCutGhost({ x: e.clientX, y: e.clientY });
  }

  function cutDragCancel() {
    cutDrag.current = null;
    setCutGhost(null);
  }

  async function cutDragUp(e) {
    const d = cutDrag.current;
    cutDragCancel();
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 24;
    const ws = workspaceRef.current?.getBoundingClientRect();
    const panel = previewPanelRef.current?.getBoundingClientRect();
    const inside = (r) =>
      r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!moved || !inside(ws) || inside(panel)) return;
    try {
      const url = await backend.exportTransparent({ format: "png" });
      await loadDataUrl(url, t("toast.cutLoaded"));
    } catch (err) {
      toast(String(err), "error");
    }
  }
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
      setCompare(false);
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

  const aiWarm = useRef(false);
  const handleAi = useCallback(async () => {
    if (!imageUrl || busy) return;
    setBusy(true);
    try {
      if (!aiWarm.current) {
        toast(t("toast.aiDownloading"), "ok");
        await backend.warmupAi();
        aiWarm.current = true;
      }
      const url = await backend.aiCut();
      setResultUrl(url);
      setHasCut(true);
      setMode("fg");
      refreshUndo();
      toast(t("toast.ai"), "ok");
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }, [imageUrl, busy, toast, refreshUndo]);

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
        // JPEG no tiene alfa: el modo transparente cae a PNG
        const effFormat = kind === "transparent" && format === "jpeg" ? "png" : format;
        const opts = { format: effFormat, quality: 0.92, ...(preset ? { preset } : {}) };
        let url;
        if (kind === "transparent") url = await backend.exportTransparent(opts);
        else if (kind === "solid") url = await backend.exportSolid(arg, opts);
        else if (kind === "image") url = await backend.exportImageBg(arg, opts);
        const ext = effFormat === "jpeg" ? "jpg" : effFormat;
        downloadDataUrl(url, `photocut-${kind}.${ext}`);
        toast(t("toast.exported"), "ok");
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [format, presetId, toast]
  );

  /** Exportación según el modo elegido (selector único). */
  const handleDownload = useCallback(async () => {
    if (exportMode === "solid") return exportAs("solid", hexToRgba(bgColor));
    if (exportMode === "image") {
      if (!bgImage) return;
      return exportAs("image", await bgWithOpacity(bgImage, bgOpacity, imageSize));
    }
    return exportAs("transparent");
  }, [exportMode, bgColor, bgImage, bgOpacity, imageSize, exportAs]);

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
    // ya no exporta directo: queda como fondo previsualizable del modo "imagen"
    setBgImage(await fileToDataUrl(f));
    setExportMode("image");
    setPreviewOpen(true);
    toast(t("toast.bgSet"), "ok");
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
        case "i":
        case "I":
          if (backend.features.ai) handleAi();
          break;
        case "[":
          setBrushSize((s) => Math.max(4, s - 4));
          break;
        case "]":
          setBrushSize((s) => Math.min(120, s + 4));
          break;
        case "e":
        case "E":
          if (hasCut && !busy) handleDownload();
          break;
        case "p":
        case "P":
          if (hasCut) setPreviewOpen((v) => !v);
          break;
        case "c":
        case "C":
          if (hasCut) setCompare((v) => !v);
          break;
        default:
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageUrl, hasCut, busy, handleUndo, handleRedo, handleAuto, handleAi, handleDownload, cancelLarge]);

  // al volver a Recorte, el lienzo estuvo display:none → re-encajar
  useEffect(() => {
    if (tab === "cut") window.dispatchEvent(new Event("resize"));
  }, [tab]);

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
          <div className="topbar-icons">
            {DONATE_URL && (
              <a
                className="btn-icon btn-icon-donate"
                href={DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("donate.aria")}
                title={t("donate.aria")}
              >
                ☕
              </a>
            )}
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
        </div>
      </header>

      {/* ambas pestañas quedan montadas (display:none) para no perder estado */}
      <div className="body" style={tab === "cut" ? undefined : { display: "none" }}>
        <aside className="rail">
            <section className="rail-group">
              <h2 className="rail-title">{t("rail.mark")}</h2>
              {backend.features.ai && (
                <button
                  className="btn btn-ai"
                  disabled={!imageUrl || busy}
                  onClick={handleAi}
                >
                  <span className="tool-key">I</span> {t("tool.ai")}
                </button>
              )}
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
                  <Dropdown
                    id="export-preset"
                    ariaLabel={t("preset.label")}
                    value={presetId}
                    onChange={setPresetId}
                    options={EXPORT_PRESETS.map((p) => ({
                      value: p.id,
                      label: t(p.labelKey),
                    }))}
                  />
                </div>
              )}
              {/* fondo de la exportación: selector de única opción */}
              <div className="format-row" role="radiogroup" aria-label={t("export.modeAria")}>
                {["transparent", "solid", "image"].map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={exportMode === m}
                    className={`chip ${exportMode === m ? "chip-on" : ""}`}
                    disabled={!hasCut}
                    onClick={() => setExportMode(m)}
                  >
                    {t(`export.mode.${m}`)}
                  </button>
                ))}
              </div>
              {exportMode === "solid" && (
                <div className="color-export">
                  <input
                    type="color"
                    value={bgColor}
                    disabled={!hasCut}
                    onChange={(e) => setBgColor(e.target.value)}
                    aria-label={t("export.bgcolor.aria")}
                  />
                  <span className="color-export-hex">{bgColor}</span>
                </div>
              )}
              {exportMode === "image" && (
                <>
                  {!bgImage ? (
                    <label className={`btn btn-small ${!hasCut ? "btn-disabled" : ""}`}>
                      {t("export.bgChoose")}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={!hasCut}
                        onChange={chooseBackgroundImage}
                      />
                    </label>
                  ) : (
                    <button className="btn btn-small" onClick={() => setBgImage(null)}>
                      {t("export.bgRemove")}
                    </button>
                  )}
                  <div className={`slider ${!bgImage ? "slider-off" : ""}`}>
                    <label htmlFor="bg-opacity">{t("export.bgOpacity", { n: bgOpacity })}</label>
                    <input
                      id="bg-opacity"
                      type="range"
                      min="10"
                      max="100"
                      value={bgOpacity}
                      disabled={!bgImage}
                      onChange={(e) => setBgOpacity(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
              {backend.features.formats && (
                <div className="format-row" role="radiogroup" aria-label="Formato">
                  {["png", "webp", "jpeg"].map((f) => (
                    <button
                      key={f}
                      role="radio"
                      aria-checked={format === f}
                      className={`chip ${format === f ? "chip-on" : ""}`}
                      disabled={f === "jpeg" && exportMode === "transparent"}
                      onClick={() => setFormat(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn btn-primary"
                disabled={!hasCut || busy || (exportMode === "image" && !bgImage)}
                onClick={handleDownload}
              >
                {t("export.download")} <kbd>E</kbd>
              </button>
              {backend.features.clipboard && (
                <button className="btn" disabled={!hasCut || busy} onClick={copyToClipboard}>
                  {t("export.clipboard")}
                </button>
              )}
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

          {/* solo en la pestaña activa: las redes exigen 1 anuncio por página */}
          {tab === "cut" && <AdSlot placement="cut-rail" onDownload={() => setDlOpen(true)} />}
        </aside>

        <main className="workspace" ref={workspaceRef}>
          <CanvasEditor
            imageUrl={imageUrl}
            imageSize={imageSize}
            resultUrl={resultUrl}
            mode={mode}
            brushSize={brushSize}
            onRect={handleRect}
            onStroke={handleStroke}
            busy={busy}
            compare={compare}
            onCompareChange={setCompare}
          />
        </main>
      </div>

      <div className="body" style={tab === "icons" ? undefined : { display: "none" }}>
        <IconStudio
          getCutout={getCutout}
          hasCut={hasCut}
          onToast={toast}
          onDownload={() => setDlOpen(true)}
          active={tab === "icons"}
        />
      </div>

      {tab === "cut" && previewOpen && hasCut && resultUrl && (
        <div
          className="preview-panel"
          ref={previewPanelRef}
          style={{
            width: previewSize.w,
            height: previewSize.h,
            ...(previewPos
              ? { left: previewPos.x, top: previewPos.y, right: "auto" }
              : {}),
          }}
        >
          <div
            className="preview-panel-head"
            onPointerDown={previewDragDown}
            onPointerMove={previewDragMove}
            onPointerUp={previewDragUp}
            onPointerCancel={previewDragUp}
          >
            <span className="preview-panel-title">{t("previewPanel.title")}</span>
            {exportMode === "transparent" && (
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
            )}
            <button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label={t("previewPanel.close")}>
              ×
            </button>
          </div>
          <div
            className={`preview-body preview-bg-${exportMode === "transparent" ? previewBg : "none"}`}
            style={
              exportMode === "solid"
                ? { background: bgColor }
                : exportMode === "transparent" && previewBg === "color"
                  ? { background: previewColor }
                  : undefined
            }
          >
            {((exportMode === "transparent" && previewBg === "checker") ||
              (exportMode === "image" && !bgImage)) && <div className="checker" />}
            {exportMode === "image" && bgImage && (
              <img
                className="preview-bgimg"
                src={bgImage}
                style={{ opacity: bgOpacity / 100 }}
                alt=""
                aria-hidden
              />
            )}
            <img
              className="preview-cutout"
              src={resultUrl}
              alt={t("previewPanel.alt")}
              title={t("preview.dropHint")}
              style={{ touchAction: "none" }}
              onPointerDown={cutDragDown}
              onPointerMove={cutDragMove}
              onPointerUp={cutDragUp}
              onPointerCancel={cutDragCancel}
            />
          </div>
          <div
            className="preview-resize"
            role="separator"
            aria-label={t("previewPanel.resize")}
            onPointerDown={previewResizeDown}
            onPointerMove={previewResizeMove}
            onPointerUp={previewResizeUp}
            onPointerCancel={previewResizeUp}
          />
        </div>
      )}

      {cutGhost && resultUrl && (
        <img
          className="cut-ghost"
          src={resultUrl}
          style={{ left: cutGhost.x, top: cutGhost.y }}
          alt=""
          aria-hidden
        />
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

function clampNum(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

/**
 * Pre-compone el fondo con la opacidad elegida (cover, al tamaño de la
 * imagen de trabajo) para que el motor lo reciba listo para componer.
 */
async function bgWithOpacity(bgDataUrl, opacity, imageSize) {
  if (opacity >= 100 || !imageSize) return bgDataUrl;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = bgDataUrl;
  });
  const c = document.createElement("canvas");
  c.width = imageSize.width;
  c.height = imageSize.height;
  const ctx = c.getContext("2d");
  ctx.globalAlpha = opacity / 100;
  const s = Math.max(c.width / img.width, c.height / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  return c.toDataURL("image/png");
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

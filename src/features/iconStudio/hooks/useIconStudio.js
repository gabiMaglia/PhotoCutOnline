import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { backend } from "../../../lib/backend.js";
import {
  PLATFORMS,
  buildIconZip,
  faviconSnippet,
  trimToContent,
  hasTrimmableMargin,
} from "../../../lib/icons.js";
import { loadHtmlImage } from "../../../lib/jsEngine.js";
import { saveExport } from "../../../utils/save.js";
import { t } from "../../../lib/i18n.js";
import { trackEvent } from "../../../services/analytics.js";

// Lógica de Icon Studio: fuente del arte (recorte actual / PNG abierto), quitar
// fondo con IA, recortar al contenido, ajustes de render y generación del ZIP.
export function useIconStudio({ getCutout, onToast }) {
  const [source, setSource] = useState(null); // HTMLImageElement | canvas
  const [sourceName, setSourceName] = useState(null);
  const [padding, setPadding] = useState(8);
  const [fit, setFit] = useState("contain"); // contain: entera | cover: recorta sobrante | subject: ajusta al sujeto
  const [scale, setScale] = useState(100); // % de agrandado (100 = sin agrandar)
  const [rotation, setRotation] = useState(0); // grados, -180..180
  const rotateBy = useCallback(
    (deg) => setRotation((r) => (((r + deg + 180) % 360) + 360) % 360 - 180),
    []
  );
  const [bgOn, setBgOn] = useState(false);
  const [bgColor, setBgColor] = useState("#111317");
  const [bgImage, setBgImage] = useState(null); // HTMLImageElement | null
  const [appName, setAppName] = useState("Mi App");
  const [selected, setSelected] = useState(() => new Set(PLATFORMS.map((p) => p.id)));
  const [building, setBuilding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [canTrim, setCanTrim] = useState(false);
  const aiWarned = useRef(false);

  // "subject": recorta el margen transparente UNA sola vez (memoizado por
  // source) y encaja entero, para que el sujeto llene el cuadro sea cual sea el
  // margen del recorte; sin re-escanear el alfa en cada tamaño de ícono.
  const trimmedSource = useMemo(
    () => (source ? trimToContent(source) ?? source : null),
    [source]
  );
  const renderSource = fit === "subject" ? trimmedSource : source;
  const renderFit = fit === "subject" ? "contain" : fit;
  const renderOpts = { padding: padding / 100, fit: renderFit, scale: scale / 100, rotation, bg: bgOn ? bgColor : null, bgImage };

  // ¿hay margen transparente que recortar? (habilita/deshabilita el botón)
  useEffect(() => {
    setCanTrim(source ? hasTrimmableMargin(source) : false);
  }, [source]);

  const loadFromFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      setSource(img);
      setSourceName(file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const loadBgFromFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    try {
      setBgImage(await loadHtmlImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const useCurrentCutout = useCallback(async () => {
    try {
      const img = await loadHtmlImage(await getCutout());
      setSource(img);
      setSourceName(t("icon.currentTag"));
    } catch (e) {
      onToast(t("toast.cutfail", { e }), "error");
    }
  }, [getCutout, onToast]);

  const removeBackground = useCallback(async () => {
    if (!source || removing) return;
    setRemoving(true);
    try {
      if (!aiWarned.current) {
        onToast(t("toast.aiDownloading"), "ok");
        aiWarned.current = true;
      }
      const W = source.naturalWidth || source.width;
      const H = source.naturalHeight || source.height;
      // inferencia a resolución de trabajo; el alfa se reescala al original
      const scale = Math.min(1, 1400 / Math.max(W, H));
      const w = Math.max(1, Math.round(W * scale));
      const h = Math.max(1, Math.round(H * scale));
      const workC = document.createElement("canvas");
      workC.width = w;
      workC.height = h;
      const wctx = workC.getContext("2d");
      wctx.imageSmoothingQuality = "high";
      wctx.drawImage(source, 0, 0, w, h);
      const matte = await backend.removeBg(wctx.getImageData(0, 0, w, h));

      // máscara work-res → alfa full-res con suavizado
      const maskImg = new ImageData(w, h);
      for (let i = 0; i < matte.length; i++) {
        const o = i * 4;
        maskImg.data[o] = 255;
        maskImg.data[o + 1] = 255;
        maskImg.data[o + 2] = 255;
        maskImg.data[o + 3] = matte[i];
      }
      const maskC = document.createElement("canvas");
      maskC.width = w;
      maskC.height = h;
      maskC.getContext("2d").putImageData(maskImg, 0, 0);

      const out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      const octx = out.getContext("2d");
      octx.drawImage(source, 0, 0, W, H);
      octx.globalCompositeOperation = "destination-in";
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(maskC, 0, 0, W, H);

      setSource(out);
      setSourceName((n) => `${n || ""} ${t("icon.noBgTag")}`.trim());
      onToast(t("icon.bgRemoved"), "ok");
    } catch (e) {
      onToast(String(e), "error");
    } finally {
      setRemoving(false);
    }
  }, [source, removing, onToast]);

  const trimSource = useCallback(() => {
    if (!source) return;
    const trimmed = trimToContent(source);
    if (!trimmed) {
      onToast(t("icon.trimNone"), "ok");
      return;
    }
    setSource(trimmed);
    setSourceName((n) => `${(n || "").replace(/\s*\(recortado\)$/, "")} ${t("icon.trimTag")}`.trim());
    onToast(t("icon.trimmed", { w: trimmed.width, h: trimmed.height }), "ok");
  }, [source, onToast]);

  const togglePlatform = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const downloadZip = useCallback(async () => {
    if (!source || selected.size === 0) return;
    setBuilding(true);
    try {
      const blob = await buildIconZip(renderSource, { ...renderOpts, platforms: selected, appName });
      const total = PLATFORMS.filter((p) => selected.has(p.id)).reduce((n, p) => n + p.count, 0);
      if (backend.isDesktop) {
        if (!(await saveExport(blob, "app-icons.zip"))) return; // cancelado
      } else {
        downloadBlob(blob, "app-icons.zip");
      }
      trackEvent("icons_zip", { platforms: selected.size });
      onToast(t("toast.zip", { n: total, p: selected.size }), "ok");
    } catch (e) {
      onToast(t("toast.iconsfail", { e }), "error");
    } finally {
      setBuilding(false);
    }
  }, [renderSource, source, selected, renderOpts, appName, onToast]);

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(faviconSnippet());
      onToast(t("icon.snippetCopied"), "ok");
    } catch (e) {
      onToast(String(e), "error");
    }
  }, [onToast]);

  return {
    source,
    sourceName,
    padding,
    setPadding,
    fit,
    setFit,
    scale,
    setScale,
    rotation,
    setRotation,
    rotateBy,
    bgOn,
    setBgOn,
    bgColor,
    setBgColor,
    bgImage,
    setBgImage,
    appName,
    setAppName,
    selected,
    building,
    removing,
    canTrim,
    renderSource,
    renderOpts,
    loadFromFile,
    loadBgFromFile,
    useCurrentCutout,
    removeBackground,
    trimSource,
    togglePlatform,
    downloadZip,
    copySnippet,
  
  };
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

import { useState, useCallback, useRef } from "react";
import { backend } from "../../../lib/backend.js";
import { EXPORT_PRESETS, fitWithinBytes } from "../../../lib/presets.js";
import { t } from "../../../lib/i18n.js";
import { OUTPUT_FORMATS, formatFromMime } from "../../../lib/metadata.js";
import { webpErrorKey } from "../../../lib/webpEncoder.js";
import { hexToRgba } from "../../../utils/color.js";
import { fileToDataUrl, bgWithOpacity } from "../../../utils/image.js";
import { downloadDataUrl } from "../../../utils/dom.js";
import { saveExport } from "../../../utils/save.js";
import { trackEvent } from "../../../services/analytics.js";

// Ajustes y acciones de exportación: modo de fondo (transparente/color/imagen),
// formato, preset de tamaño, opacidad del fondo, descarga y portapapeles.
export function useExport({ imageSize, setBusy, toast, onChooseBgImage }) {
  const [format, setFormat] = useState("png");
  const [exportMode, setExportMode] = useState("transparent"); // transparent | solid | image
  const [presetId, setPresetIdRaw] = useState("original");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState(null); // dataURL del fondo "imagen"
  const [bgOpacity, setBgOpacity] = useState(100);
  // encuadre del resultado para exportar (no toca la edición): escala + rotación
  const [resultScale, setResultScale] = useState(100); // %
  const [resultRotation, setResultRotation] = useState(0); // grados, -180..180
  const [blurAmount, setBlurAmount] = useState(16); // radio del fondo desenfocado

  // Elegir un preset precarga su fondo en el selector (Amazon → blanco, avatar →
  // transparente). Después manda el selector: el usuario puede cambiarlo y eso
  // es lo que se exporta (BUG-01). "Original" no trae fondo y no toca nada.
  // formato y fondo del usuario antes del 1er preset que impuso formato
  const beforePreset = useRef(null);
  const setPresetId = useCallback((id) => {
    setPresetIdRaw(id);
    const preset = EXPORT_PRESETS.find((p) => p.id === id)?.preset;
    if (preset?.format) {
      // se guarda una sola vez: WhatsApp → Telegram no lo pisa
      beforePreset.current ??= { format, exportMode, bgColor };
      if (preset.format !== format)
        toast(t("export.presetFormat", { fmt: preset.format.toUpperCase() }), "ok");
      setFormat(preset.format);
    } else if (beforePreset.current != null) {
      // Salir del preset devuelve lo del usuario (GROW-35 D1). «Original» devuelve
      // también el fondo; un preset con fondo propio lo precarga (BUG-01).
      const prev = beforePreset.current;
      beforePreset.current = null;
      const mode = preset ? (preset.bg ? "solid" : "transparent") : prev.exportMode;
      // el aviso nombra lo que va a bajar: Transparente + JPEG sale PNG (como exportAs)
      const fmt = (mode === "transparent" && prev.format === "jpeg" ? "png" : prev.format).toUpperCase();
      const bgBack = !preset && (prev.exportMode !== exportMode || prev.bgColor !== bgColor);
      if (bgBack) {
        setExportMode(prev.exportMode);
        setBgColor(prev.bgColor);
        toast(t("export.settingsRestored", { bg: t(`export.mode.${prev.exportMode}`), fmt }), "ok");
      } else if (fmt !== format.toUpperCase()) {
        toast(t("export.formatRestored", { fmt }), "ok");
      }
      setFormat(prev.format);
    }
    if (!preset) return;
    if (preset.bg) {
      // avisar solo si de verdad cambió lo que el usuario tenía elegido
      if (exportMode !== "solid" || bgColor.toLowerCase() !== preset.bg.toLowerCase())
        toast(
          preset.bg.toLowerCase() === "#ffffff"
            ? t("export.presetBgWhite")
            : t("export.presetBgColor", { color: preset.bg }),
          "ok"
        );
      setBgColor(preset.bg);
      setExportMode("solid");
    } else {
      if (exportMode !== "transparent") toast(t("export.presetBgTransparent"), "ok");
      setExportMode("transparent");
    }
  }, [exportMode, bgColor, format, toast]);

  const activePreset = EXPORT_PRESETS.find((p) => p.id === presetId)?.preset || null;
  // los stickers exigen un formato concreto: la UI lo muestra fijo
  const lockedFormat = activePreset?.format ?? null;

  const rotateBy = useCallback(
    (deg) => setResultRotation((r) => (((r + deg + 180) % 360) + 360) % 360 - 180),
    []
  );

  const exportAs = useCallback(
    async (kind, arg) => {
      setBusy(true);
      try {
        // el desenfocado no usa presets (exporta a tamaño original)
        const preset = kind === "blur" ? null : activePreset;
        // el formato del preset manda; si no, JPEG no tiene alfa y el modo
        // transparente cae a PNG
        const effFormat =
          preset?.format || (kind === "transparent" && format === "jpeg" ? "png" : format);
        // encuadre: solo se manda si no es identidad (evita recomponer en vano)
        const transform =
          resultScale !== 100 || resultRotation !== 0
            ? { scale: resultScale / 100, rotation: resultRotation }
            : null;
        const run = (quality) => {
          const opts = {
            format: effFormat,
            quality,
            ...(preset ? { preset } : {}),
            ...(transform ? { transform } : {}),
          };
          if (kind === "transparent") return backend.exportTransparent(opts);
          if (kind === "solid") return backend.exportSolid(arg, opts);
          if (kind === "image") return backend.exportImageBg(arg, opts);
          return backend.exportBlurBg(arg, opts);
        };
        let url;
        let realType;
        let notice = null;
        if (preset?.maxBytes) {
          const fit = await fitWithinBytes(
            async (q) => {
              const u = await run(q);
              const b = await (await fetch(u)).blob();
              return { url: u, bytes: b.size, type: b.type };
            },
            { maxBytes: preset.maxBytes }
          );
          url = fit.url;
          realType = fit.type;
          const kb = Math.round(fit.bytes / 1024);
          const max = Math.round(preset.maxBytes / 1024);
          if (!fit.fits) notice = [t("export.overLimit", { kb, max }), "error"];
          else if (fit.reduced)
            notice = [t("export.qualityReduced", { q: Math.round(fit.quality * 100), kb, max }), "ok"];
        } else {
          url = await run(0.92);
          realType = (await (await fetch(url)).blob()).type;
        }
        // el archivo se nombra por lo que ES, no por lo que se pidió (GROW-35);
        // si el motor dio otro formato, ese aviso pesa más que el del peso
        const realFormat = formatFromMime(realType) || effFormat;
        if (realFormat !== effFormat)
          notice = [
            t("export.formatFallback", { want: effFormat.toUpperCase(), got: realFormat.toUpperCase() }),
            "error",
          ];
        const name = `photocut-${kind}.${OUTPUT_FORMATS[realFormat].ext}`;
        if (backend.isDesktop) {
          // diálogo nativo "Guardar como"
          const saved = await saveExport(url, name);
          if (!saved) return; // usuario canceló: sin toast de éxito
        } else {
          downloadDataUrl(url, name);
        }
        trackEvent("export", { kind, format: realFormat });
        if (notice) toast(...notice);
        else toast(t(backend.isDesktop ? "toast.saved" : "toast.exported"), "ok");
      } catch (e) {
        // el encoder WebP no pudo (sin red la 1ª vez, >16383 px, sin memoria):
        // no se descarga nada, nunca un PNG disfrazado
        const key = webpErrorKey(e);
        toast(key ? t(key) : String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [format, activePreset, resultScale, resultRotation, setBusy, toast]
  );

  // descarga según el modo de fondo elegido (selector único)
  const handleDownload = useCallback(async () => {
    if (exportMode === "solid") return exportAs("solid", hexToRgba(bgColor));
    if (exportMode === "image") {
      if (!bgImage) return;
      return exportAs("image", await bgWithOpacity(bgImage, bgOpacity, imageSize));
    }
    return exportAs("transparent");
  }, [exportMode, bgColor, bgImage, bgOpacity, imageSize, exportAs]);

  const downloadBlur = useCallback(() => exportAs("blur", blurAmount), [exportAs, blurAmount]);

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
  }, [setBusy, toast]);

  // elegir imagen de fondo: no exporta directo, queda como fondo previsualizable
  const chooseBackgroundImage = useCallback(
    async (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setBgImage(await fileToDataUrl(f));
      setExportMode("image");
      onChooseBgImage?.(); // abre la vista previa
      toast(t("toast.bgSet"), "ok");
    },
    [onChooseBgImage, toast]
  );

  return {
    format,
    setFormat,
    exportMode,
    setExportMode,
    presetId,
    setPresetId,
    lockedFormat,
    bgColor,
    setBgColor,
    bgImage,
    setBgImage,
    bgOpacity,
    setBgOpacity,
    resultScale,
    setResultScale,
    resultRotation,
    setResultRotation,
    rotateBy,
    blurAmount,
    setBlurAmount,
    downloadBlur,
    exportAs,
    handleDownload,
    copyToClipboard,
    chooseBackgroundImage,
  };
}

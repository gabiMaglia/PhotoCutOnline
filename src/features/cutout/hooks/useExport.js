import { useState, useCallback } from "react";
import { backend } from "../../../lib/backend.js";
import { EXPORT_PRESETS } from "../../../lib/presets.js";
import { t } from "../../../lib/i18n.js";
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
  const [presetId, setPresetId] = useState("original");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgImage, setBgImage] = useState(null); // dataURL del fondo "imagen"
  const [bgOpacity, setBgOpacity] = useState(100);
  // encuadre del resultado para exportar (no toca la edición): escala + rotación
  const [resultScale, setResultScale] = useState(100); // %
  const [resultRotation, setResultRotation] = useState(0); // grados, -180..180

  const rotateBy = useCallback(
    (deg) => setResultRotation((r) => (((r + deg + 180) % 360) + 360) % 360 - 180),
    []
  );

  const exportAs = useCallback(
    async (kind, arg) => {
      setBusy(true);
      try {
        const preset = EXPORT_PRESETS.find((p) => p.id === presetId)?.preset || null;
        // JPEG no tiene alfa: el modo transparente cae a PNG
        const effFormat = kind === "transparent" && format === "jpeg" ? "png" : format;
        // encuadre: solo se manda si no es identidad (evita recomponer en vano)
        const transform =
          resultScale !== 100 || resultRotation !== 0
            ? { scale: resultScale / 100, rotation: resultRotation }
            : null;
        const opts = {
          format: effFormat,
          quality: 0.92,
          ...(preset ? { preset } : {}),
          ...(transform ? { transform } : {}),
        };
        let url;
        if (kind === "transparent") url = await backend.exportTransparent(opts);
        else if (kind === "solid") url = await backend.exportSolid(arg, opts);
        else if (kind === "image") url = await backend.exportImageBg(arg, opts);
        const ext = effFormat === "jpeg" ? "jpg" : effFormat;
        const name = `photocut-${kind}.${ext}`;
        if (backend.isDesktop) {
          // diálogo nativo "Guardar como"
          const saved = await saveExport(url, name);
          if (!saved) return; // usuario canceló: sin toast de éxito
        } else {
          downloadDataUrl(url, name);
        }
        trackEvent("export", { kind, format: effFormat });
        toast(t(backend.isDesktop ? "toast.saved" : "toast.exported"), "ok");
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [format, presetId, resultScale, resultRotation, setBusy, toast]
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
    exportAs,
    handleDownload,
    copyToClipboard,
    chooseBackgroundImage,
  };
}

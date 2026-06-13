import { useState, useCallback } from "react";
import { exportSticker, STICKER_TARGETS } from "../../../lib/stickers.js";
import { loadHtmlImage } from "../../../lib/jsEngine.js";
import { t } from "../../../lib/i18n.js";

// Lógica de Sticker Studio: fuente del arte, look del sticker (contorno +
// sombra) y exportación a los formatos de WhatsApp / Telegram / PNG.
export function useStickerStudio({ getCutout, onToast }) {
  const [source, setSource] = useState(null); // HTMLImageElement | canvas
  const [sourceName, setSourceName] = useState(null);
  const [outlineOn, setOutlineOn] = useState(true);
  const [outlineWidth, setOutlineWidth] = useState(16);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [shadowOn, setShadowOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const renderOpts = {
    outline: outlineOn,
    outlineWidth,
    outlineColor,
    shadow: shadowOn,
  };

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

  const useCurrentCutout = useCallback(async () => {
    try {
      const img = await loadHtmlImage(await getCutout());
      setSource(img);
      setSourceName(t("icon.currentTag"));
    } catch (e) {
      onToast(t("toast.cutfail", { e }), "error");
    }
  }, [getCutout, onToast]);

  const exportTo = useCallback(
    async (target) => {
      if (!source) return;
      setBusy(true);
      try {
        const blob = await exportSticker(source, target, renderOpts);
        downloadBlob(blob, `photocut-sticker.${STICKER_TARGETS[target].ext}`);
        onToast(t("sticker.exported", { target: target.toUpperCase() }), "ok");
      } catch (e) {
        onToast(String(e), "error");
      } finally {
        setBusy(false);
      }
    },
    [source, renderOpts, onToast]
  );

  return {
    source,
    sourceName,
    outlineOn,
    setOutlineOn,
    outlineWidth,
    setOutlineWidth,
    outlineColor,
    setOutlineColor,
    shadowOn,
    setShadowOn,
    busy,
    renderOpts,
    loadFromFile,
    useCurrentCutout,
    exportTo,
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

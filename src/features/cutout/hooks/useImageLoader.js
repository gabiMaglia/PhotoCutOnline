import { useState, useEffect, useRef, useCallback } from "react";
import { backend } from "../../../lib/backend.js";
import { t } from "../../../lib/i18n.js";
import {
  inspectImageFile,
  bitmapToDataUrl,
  DOWNSCALE_MAX_DIM,
} from "../../../lib/imageFile.js";
import { fileToDataUrl } from "../../../utils/image.js";

// Carga de imágenes: abrir/arrastrar/pegar, validación de formato/tamaño y el
// flujo de "imagen muy grande" (reducir a 4K). Posee imageUrl/imageSize.
export function useImageLoader({ toast, onLoad }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pendingLarge, setPendingLarge] = useState(null); // {file,bitmap,width,height}
  const dragDepth = useRef(0);

  const loadDataUrl = useCallback(
    async (dataUrl, note) => {
      setImageUrl(dataUrl);
      onLoad?.();
      try {
        const { width, height } = await backend.loadImage(dataUrl);
        setImageSize({ width, height });
        toast(note || t("toast.loaded", { w: width, h: height }), "ok");
      } catch (e) {
        toast(String(e), "error");
      }
    },
    [toast, onLoad]
  );

  const openFile = useCallback(
    async (file) => {
      const res = await inspectImageFile(file);
      if (res.kind === "heic") return toast(t("toast.heic"), "error");
      if (res.kind === "undecodable") return toast(t("toast.unreadable"), "error");
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

  const onFileInput = useCallback(
    (e) => {
      const f = e.target.files?.[0];
      if (f) openFile(f);
      e.target.value = "";
    },
    [openFile]
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

  // arrastrar y soltar + pegar (a nivel ventana)
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
      const f = item?.getAsFile();
      if (f) openFile(f);
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

  return {
    imageUrl,
    imageSize,
    dragging,
    pendingLarge,
    loadDataUrl,
    openFile,
    onFileInput,
    confirmReduceLarge,
    cancelLarge,
  };
}

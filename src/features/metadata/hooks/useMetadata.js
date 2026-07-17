import { useState, useCallback, useRef } from "react";
import { basicInfo, parseExif } from "../../../lib/metadata.js";

// Carga una imagen local, lee su info de archivo y sus metadatos EXIF, y retiene
// el elemento <img> para poder re-exportar una copia sin metadatos. Todo local.
export function useMetadata({ onToast } = {}) {
  const imgRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [exif, setExif] = useState(null);
  const [busy, setBusy] = useState(false);
  // URL para el thumbnail: se mantiene VIVA (a diferencia del <img> de carga,
  // cuyo blob se revocaba al instante). Se revoca la anterior en cada carga
  // nueva para no acumular blobs.
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewUrlRef = useRef(null);

  // Sólo se revocan object URLs (blob:); los data URLs no lo necesitan y
  // además la imagen compartida entre pestañas es un data URL que no debemos
  // invalidar.
  const setPreview = useCallback((next) => {
    const prev = previewUrlRef.current;
    if (prev && prev !== next && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    previewUrlRef.current = next;
    setPreviewUrl(next);
  }, []);

  const load = useCallback(
    async (file) => {
      if (!file) return;
      setBusy(true);
      let url;
      try {
        const buf = await file.arrayBuffer();
        url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = url;
        });
        imgRef.current = img;
        setInfo(basicInfo(file, img));
        setExif(parseExif(buf));
        setPreview(url); // queda viva para el thumbnail (revoca la blob previa)
        url = null;
      } catch {
        if (url) URL.revokeObjectURL(url);
        onToast?.("No se pudo leer la imagen");
      } finally {
        setBusy(false);
      }
    },
    [onToast, setPreview]
  );

  // Carga desde un data URL — la imagen compartida por otras pestañas. Preserva
  // los bytes originales, así que el EXIF sigue disponible. No hay nombre de
  // archivo real: se sintetiza uno a partir del tipo MIME.
  const loadFromDataUrl = useCallback(
    async (dataUrl, name) => {
      if (!dataUrl) return;
      setBusy(true);
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const buf = await blob.arrayBuffer();
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = dataUrl;
        });
        imgRef.current = img;
        const ext = (blob.type.split("/")[1] || "img").replace("jpeg", "jpg");
        const pseudoFile = { name: name || `imagen.${ext}`, type: blob.type, size: blob.size, lastModified: 0 };
        setInfo(basicInfo(pseudoFile, img));
        setExif(parseExif(buf));
        setPreview(dataUrl); // data URL: no se revoca
      } catch {
        onToast?.("No se pudo leer la imagen");
      } finally {
        setBusy(false);
      }
    },
    [onToast, setPreview]
  );

  return { info, exif, busy, load, loadFromDataUrl, imgRef, previewUrl };
}

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
        // éxito: esta URL queda viva para el thumbnail; se revoca la previa
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        url = null; // ya no la revocamos en el catch
      } catch {
        if (url) URL.revokeObjectURL(url); // falló la carga: soltar esta URL
        onToast?.("No se pudo leer la imagen");
      } finally {
        setBusy(false);
      }
    },
    [onToast]
  );

  return { info, exif, busy, load, imgRef, previewUrl };
}

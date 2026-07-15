import { useState, useCallback, useRef } from "react";
import { basicInfo, parseExif } from "../../../lib/metadata.js";

// Carga una imagen local, lee su info de archivo y sus metadatos EXIF, y retiene
// el elemento <img> para poder re-exportar una copia sin metadatos. Todo local.
export function useMetadata({ onToast } = {}) {
  const imgRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [exif, setExif] = useState(null);
  const [busy, setBusy] = useState(false);

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
      } catch {
        onToast?.("No se pudo leer la imagen");
      } finally {
        if (url) URL.revokeObjectURL(url);
        setBusy(false);
      }
    },
    [onToast]
  );

  return { info, exif, busy, load, imgRef };
}

import { useState, useEffect, useCallback, useRef } from "react";
import { reencodeToBlob, hasTransparency, OUTPUT_FORMATS } from "../../../lib/metadata.js";

// T-014: comprimir/convertir. El estimado se recalcula solo cuando cambian
// formato o calidad; re-encodear es sincrónico y en fotos grandes bloquea el
// hilo, así que se debounce (no en cada paso del slider) y se descarta el
// resultado si llegó tarde.
const DEBOUNCE_MS = 220;

export function useReencode({ imgRef, info }) {
  const [format, setFormat] = useState("jpeg");
  const [quality, setQuality] = useState(80); // 0–100 en la UI, 0–1 en el canvas
  const [estimate, setEstimate] = useState(null); // bytes del resultado
  const [estimating, setEstimating] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const runId = useRef(0);

  // La transparencia se mide UNA vez por imagen: recorrer píxeles en cada
  // cambio del selector no aporta (la imagen no cambia) y cuesta.
  useEffect(() => {
    const img = imgRef.current;
    setTransparent(img ? hasTransparency(img) : false);
  }, [info, imgRef]);

  // Al abrir una imagen nueva, arrancar en su propio formato si lo soportamos:
  // "convertir" no debería ser el default de quien sólo quiere comprimir.
  useEffect(() => {
    if (!info?.type) return;
    const match = Object.keys(OUTPUT_FORMATS).find((k) => OUTPUT_FORMATS[k].mime === info.type);
    if (match) setFormat(match);
  }, [info]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !info) return setEstimate(null);
    const id = ++runId.current;
    setEstimating(true);
    const timer = setTimeout(async () => {
      const blob = await reencodeToBlob(img, { format, quality: quality / 100 });
      if (id !== runId.current) return; // llegó tarde: hay otro cambio en curso
      setEstimate(blob ? blob.size : null);
      setEstimating(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [format, quality, info, imgRef]);

  const download = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;
    const blob = await reencodeToBlob(img, { format, quality: quality / 100 });
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const base = info?.name?.replace(/\.[^.]+$/, "") || "imagen";
    a.download = `${base}.${OUTPUT_FORMATS[format].ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [imgRef, info, format, quality]);

  const fmt = OUTPUT_FORMATS[format];
  return {
    format,
    setFormat,
    quality,
    setQuality,
    estimate,
    estimating,
    // sólo los formatos con pérdida usan `quality`: en PNG el canvas lo ignora
    showQuality: fmt.lossy,
    // convertir algo transparente a un formato sin alfa destruye información
    losesAlpha: transparent && !fmt.alpha,
    download,
  };
}

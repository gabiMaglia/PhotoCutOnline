import { useState, useEffect, useCallback, useRef } from "react";
import { reencodeToBlob, hasTransparency, fitSize, OUTPUT_FORMATS } from "../../../lib/metadata.js";

// T-014/T-015: convertir, comprimir y redimensionar. El estimado se recalcula
// cuando cambian formato, calidad o tamaño; re-encodear es sincrónico y en
// fotos grandes bloquea el hilo, así que se debounce (no en cada paso del
// slider) y se descarta el resultado si llegó tarde.
const DEBOUNCE_MS = 220;

export function useReencode({ imgRef, info }) {
  const [format, setFormat] = useState("jpeg");
  const [quality, setQuality] = useState(80); // 0–100 en la UI, 0–1 en el canvas
  const [estimate, setEstimate] = useState(null); // bytes del resultado
  const [estimating, setEstimating] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [lock, setLock] = useState(true); // candado de proporción
  const [width, setWidth] = useState(null);
  const [height, setHeight] = useState(null);
  const runId = useRef(0);

  const srcW = info?.width || 0;
  const srcH = info?.height || 0;

  // La transparencia se mide UNA vez por imagen: recorrer píxeles en cada
  // cambio del selector no aporta (la imagen no cambia) y cuesta.
  useEffect(() => {
    const img = imgRef.current;
    setTransparent(img ? hasTransparency(img) : false);
  }, [info, imgRef]);

  // Imagen nueva: arrancar en su propio formato si lo soportamos ("convertir"
  // no debería ser el default de quien sólo quiere comprimir) y en su tamaño.
  useEffect(() => {
    if (!info) return;
    const match = Object.keys(OUTPUT_FORMATS).find((k) => OUTPUT_FORMATS[k].mime === info.type);
    if (match) setFormat(match);
    setWidth(info.width || null);
    setHeight(info.height || null);
  }, [info]);

  // Con el candado puesto, tocar un lado ajusta el otro.
  const changeWidth = useCallback(
    (w) => {
      setWidth(w);
      if (lock && srcW && srcH && w) setHeight(fitSize(srcW, srcH, { width: w, lock: true }).height);
    },
    [lock, srcW, srcH]
  );
  const changeHeight = useCallback(
    (h) => {
      setHeight(h);
      if (lock && srcW && srcH && h) setWidth(fitSize(srcW, srcH, { height: h, lock: true }).width);
    },
    [lock, srcW, srcH]
  );
  const setPercent = useCallback(
    (pct) => {
      if (!srcW || !srcH) return;
      setWidth(Math.max(1, Math.round((srcW * pct) / 100)));
      setHeight(Math.max(1, Math.round((srcH * pct) / 100)));
    },
    [srcW, srcH]
  );
  const resetSize = useCallback(() => {
    setWidth(srcW || null);
    setHeight(srcH || null);
  }, [srcW, srcH]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !info) return setEstimate(null);
    const id = ++runId.current;
    setEstimating(true);
    const timer = setTimeout(async () => {
      const blob = await reencodeToBlob(img, {
        format,
        quality: quality / 100,
        width: width || undefined,
        height: height || undefined,
      });
      if (id !== runId.current) return; // llegó tarde: hay otro cambio en curso
      setEstimate(blob ? blob.size : null);
      setEstimating(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [format, quality, width, height, info, imgRef]);

  const download = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;
    const blob = await reencodeToBlob(img, {
      format,
      quality: quality / 100,
      width: width || undefined,
      height: height || undefined,
    });
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const base = info?.name?.replace(/\.[^.]+$/, "") || "imagen";
    a.download = `${base}.${OUTPUT_FORMATS[format].ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [imgRef, info, format, quality, width, height]);

  const fmt = OUTPUT_FORMATS[format];
  return {
    format,
    setFormat,
    quality,
    setQuality,
    estimate,
    estimating,
    width,
    height,
    changeWidth,
    changeHeight,
    setPercent,
    resetSize,
    lock,
    setLock,
    resized: !!(srcW && width && width !== srcW),
    // Interpolar no inventa detalle: agrandar sólo agranda los píxeles. Se avisa
    // en vez de dejar creer que hay un upscaler (que NO tenemos: ver GROW-20).
    upscaling: !!(srcW && width && width > srcW),
    // sólo los formatos con pérdida usan `quality`: en PNG el canvas lo ignora
    showQuality: fmt.lossy,
    // convertir algo transparente a un formato sin alfa destruye información
    losesAlpha: transparent && !fmt.alpha,
    download,
  };
}

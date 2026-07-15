import { useState, useRef, useCallback } from "react";
import { extractPalette, rgbToHex } from "../../../lib/palette.js";

// Lógica de la herramienta de color: carga una imagen a un canvas acotado,
// guarda su ImageData para muestrear píxeles (cuentagotas) y extrae la paleta
// dominante. Todo local; la imagen nunca sale del navegador.
const MAX_DIM = 1400; // techo de resolución para el análisis (rendimiento)

export function useColorTools({ onToast } = {}) {
  const canvasRef = useRef(null); // canvas visible con la imagen
  const dataRef = useRef(null); // ImageData para leer píxeles
  const [ready, setReady] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [count, setCount] = useState(6);
  const [palette, setPalette] = useState([]);
  const [picked, setPicked] = useState([]); // colores fijados con el cuentagotas
  const [busy, setBusy] = useState(false);

  const recompute = useCallback((n) => {
    if (!dataRef.current) return;
    setPalette(extractPalette(dataRef.current, n));
  }, []);

  const drawImage = useCallback(
    (img, name) => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      dataRef.current = ctx.getImageData(0, 0, w, h);
      setSourceName(name || "");
      setReady(true);
      setPicked([]);
      setPalette(extractPalette(dataRef.current, count));
    },
    [count]
  );

  const loadFromUrl = useCallback(
    (url, name) => {
      if (!url) return;
      setBusy(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        drawImage(img, name);
        setBusy(false);
      };
      img.onerror = () => {
        setBusy(false);
        onToast?.("No se pudo cargar la imagen");
      };
      img.src = url;
    },
    [drawImage, onToast]
  );

  const loadFromFile = useCallback(
    (file) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        drawImage(img, file.name);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        onToast?.("No se pudo cargar la imagen");
      };
      img.src = url;
    },
    [drawImage, onToast]
  );

  const changeCount = useCallback(
    (n) => {
      setCount(n);
      recompute(n);
    },
    [recompute]
  );

  // Lee el color del píxel bajo (clientX,clientY) sobre el canvas visible.
  // Devuelve { hex, r, g, b } o null si cae fuera / no hay imagen.
  const readAt = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const data = dataRef.current;
    if (!canvas || !data) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    const o = (y * canvas.width + x) * 4;
    const r = data.data[o], g = data.data[o + 1], b = data.data[o + 2], a = data.data[o + 3];
    if (a < 8) return null; // píxel transparente
    return { hex: rgbToHex(r, g, b), r, g, b };
  }, []);

  const pin = useCallback((color) => {
    if (!color) return;
    setPicked((prev) => (prev.some((c) => c.hex === color.hex) ? prev : [color, ...prev].slice(0, 12)));
  }, []);

  const clearPicked = useCallback(() => setPicked([]), []);

  // ImageData de la imagen cargada (para las transformaciones de Tema/Recolor).
  const getImageData = useCallback(() => dataRef.current, []);

  return {
    canvasRef,
    ready,
    busy,
    sourceName,
    count,
    palette,
    picked,
    loadFromUrl,
    loadFromFile,
    changeCount,
    readAt,
    pin,
    clearPicked,
    getImageData,
  };
}

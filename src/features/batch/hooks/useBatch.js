import { useCallback, useRef, useState } from "react";
import { backend } from "../../../lib/backend.js";
import { makeZip } from "../../../lib/zip.js";
import { t } from "../../../lib/i18n.js";
import { inspectImageFile, bitmapToDataUrl, DOWNSCALE_MAX_DIM } from "../../../lib/imageFile.js";
import { fileToDataUrl } from "../../../utils/image.js";
import { downloadDataUrl } from "../../../utils/dom.js";
import { saveExport } from "../../../utils/save.js";
import { trackEvent } from "../../../services/analytics.js";

// Lote: recorte IA secuencial de N imágenes → ZIP de PNG transparentes.
//
// El motor (backend.js) sostiene UNA sola sesión: cargar la imagen N pisa la
// N-1, así que el procesamiento es estrictamente secuencial (una cola propia
// en `queueRef`, no `Promise.all`). Cada resultado se guarda como Uint8Array
// (no como object URL): el URL que devuelve `exportTransparent` se revoca acá
// mismo apenas se lee, en vez de esperar el timeout de 60s de backend.js —
// con muchos archivos, no hay razón para mantener vivas N URLs a la vez. El
// dataURL de entrada tampoco se pre-computa para todo el lote: se arma uno
// por vez, dentro del paso que lo consume, así el heap no crece con N.
async function processFile(file) {
  const insp = await inspectImageFile(file);
  if (insp.kind === "heic") throw new Error(t("toast.heic"));
  if (insp.kind === "undecodable") throw new Error(t("toast.unreadable"));

  // oversized: reducir a 4K en vez de bloquear el lote con un diálogo por imagen
  const dataUrl =
    insp.kind === "oversized"
      ? bitmapToDataUrl(insp.bitmap, DOWNSCALE_MAX_DIM, file.type)
      : await fileToDataUrl(file);
  insp.bitmap.close();

  await backend.loadImage(dataUrl);
  await backend.aiCut();
  const url = await backend.exportTransparent({ format: "png" });
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function zipPath(name) {
  const base = (name || "imagen").replace(/\.[^./\\]+$/, "");
  return `${base}.png`;
}

/** Nombres de archivo únicos dentro del ZIP (evita pisar "foto.jpg" + "foto.png" → "foto.png" x2). */
function uniquePath(name, used) {
  let path = zipPath(name);
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const stem = path.replace(/\.png$/, "");
  let n = 2;
  while (used.has(`${stem}-${n}.png`)) n++;
  path = `${stem}-${n}.png`;
  used.add(path);
  return path;
}

export function useBatch({ toast }) {
  const [items, setItems] = useState([]); // {id, name, status: pending|processing|done|error, error?}
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const resultsRef = useRef(new Map()); // id -> Uint8Array
  const queueRef = useRef([]); // {id, file}
  const processingRef = useRef(false);
  const nextId = useRef(1);

  const updateItem = useCallback((id, patch) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const runQueue = useCallback(async () => {
    if (processingRef.current) return; // ya hay una cola corriendo
    processingRef.current = true;
    setRunning(true);
    try {
      while (queueRef.current.length > 0) {
        const { id, file } = queueRef.current.shift();
        updateItem(id, { status: "processing" });
        try {
          const buf = await processFile(file);
          resultsRef.current.set(id, buf);
          updateItem(id, { status: "done" });
        } catch (e) {
          // error por-imagen: no aborta el resto de la cola
          updateItem(id, { status: "error", error: String(e?.message || e) });
        }
      }
    } finally {
      processingRef.current = false;
      setRunning(false);
    }
  }, [updateItem]);

  const addFiles = useCallback(
    (fileList) => {
      const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name));
      if (files.length === 0) return;
      const newItems = files.map((f) => ({
        id: nextId.current++,
        name: f.name,
        status: "pending",
      }));
      setItems((list) => [...list, ...newItems]);
      newItems.forEach((it, i) => queueRef.current.push({ id: it.id, file: files[i] }));
      runQueue();
    },
    [runQueue]
  );

  const downloadZip = useCallback(async () => {
    const done = items.filter((it) => it.status === "done");
    if (done.length === 0) {
      toast?.(t("batch.toast.zipEmpty"), "error");
      return;
    }
    setZipping(true);
    try {
      const used = new Set();
      const files = done
        .map((it) => ({ path: uniquePath(it.name, used), data: resultsRef.current.get(it.id) }))
        .filter((f) => f.data);
      const blob = makeZip(files);
      if (backend.isDesktop) {
        if (!(await saveExport(blob, "photocut-lote.zip"))) return; // cancelado
      } else {
        const url = URL.createObjectURL(blob);
        downloadDataUrl(url, "photocut-lote.zip");
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      trackEvent("batch_zip", { n: files.length });
      toast?.(t("batch.toast.zip", { n: files.length }), "ok");
    } finally {
      setZipping(false);
    }
  }, [items, toast]);

  // limpia el lote actual; no toca una cola en curso.
  const clear = useCallback(() => {
    if (processingRef.current) return;
    queueRef.current = [];
    resultsRef.current.clear();
    setItems([]);
  }, []);

  const total = items.length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const settledCount = doneCount + errorCount;

  return {
    items,
    running,
    zipping,
    total,
    doneCount,
    errorCount,
    settledCount,
    addFiles,
    downloadZip,
    clear,
  };
}

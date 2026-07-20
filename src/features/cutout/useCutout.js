import { useRef, useCallback, useState, useEffect } from "react";
import { backend } from "../../lib/backend.js";
import { fileToDataUrl } from "../../utils/image.js";
import { useImageLoader } from "./hooks/useImageLoader.js";
import { useCutoutSession } from "./hooks/useCutoutSession.js";
import { useExport } from "./hooks/useExport.js";
import { usePreviewPanel } from "./hooks/usePreviewPanel.js";

// Funcionalidad completa de la página de recorte: compone la carga de imágenes,
// la sesión del motor, los ajustes de exportación y el panel de vista previa, y
// los cablea entre sí. Lo consumen CutoutPage e IconStudio (vía CutoutContext).
export function useCutout({ toast, onImageLoad }) {
  const workspaceRef = useRef(null);

  const loader = useImageLoader({ toast, onLoad: onImageLoad });
  const session = useCutoutSession({ imageUrl: loader.imageUrl, toast });
  const preview = usePreviewPanel({
    workspaceRef,
    loadDataUrl: loader.loadDataUrl,
    toast,
  });
  const exporter = useExport({
    imageSize: loader.imageSize,
    setBusy: session.setBusy,
    toast,
    onChooseBgImage: () => preview.setOpen(true),
  });

  // Imagen compartida entre pestañas: la última cargada en CUALQUIER pantalla,
  // como data URL (no object URL: no se revoca y sirve para reusar en todas).
  // Está DESACOPLADA del motor de recorte a propósito — que Archivo o Color
  // registren su imagen no debe disparar la sesión de GrabCut. Cada pestaña la
  // lee para "Usar imagen actual" y la escribe al cargar un archivo.
  const [sharedImageUrl, setSharedImageUrl] = useState(null);
  // Las cargas del propio recorte alimentan la imagen compartida.
  useEffect(() => {
    if (loader.imageUrl) setSharedImageUrl(loader.imageUrl);
  }, [loader.imageUrl]);
  const shareFile = useCallback(async (file) => {
    if (!file) return;
    try {
      setSharedImageUrl(await fileToDataUrl(file));
    } catch {
      /* si no se puede leer, la pestaña ya maneja su propio error de carga */
    }
  }, []);

  const getCutout = useCallback(() => backend.exportTransparent({ format: "png" }), []);

  // Fuente para el hub "Editar": la imagen ORIGINAL (compartida) o el SUJETO
  // RECORTADO (PNG transparente del recorte). El PO pidió poder partir de
  // cualquiera de las dos. Si no hay recorte, siempre es la original.
  const [editSourceMode, setEditSourceMode] = useState("original"); // original | cutout
  const [cutoutUrl, setCutoutUrl] = useState(null);
  useEffect(() => {
    if (editSourceMode !== "cutout" || !session.hasCut) {
      setCutoutUrl(null);
      return;
    }
    let alive = true;
    // getCutout() devuelve un object URL (blob:) del PNG transparente, no un
    // Blob — se usa directo como src de imagen.
    getCutout()
      .then((url) => {
        if (alive && url) setCutoutUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [editSourceMode, session.hasCut, getCutout]);
  const editSourceUrl = editSourceMode === "cutout" && cutoutUrl ? cutoutUrl : sharedImageUrl;

  return {
    workspaceRef, loader, session, preview, exporter, getCutout,
    sharedImageUrl, shareFile,
    editSourceUrl, editSourceMode, setEditSourceMode,
  };
}

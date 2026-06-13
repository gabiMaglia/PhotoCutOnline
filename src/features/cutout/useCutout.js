import { useRef, useCallback } from "react";
import { backend } from "../../lib/backend.js";
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

  const getCutout = useCallback(() => backend.exportTransparent({ format: "png" }), []);
  return { workspaceRef, loader, session, preview, exporter, getCutout };
}

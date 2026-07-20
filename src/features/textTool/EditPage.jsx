import { useState, useEffect, lazy, Suspense } from "react";
import TextToolPage from "./TextToolPage.jsx";

// Hub "Editar": una sola pestaña con varias sub-herramientas que se aplican
// sobre la foto. Hoy: Texto y Censurar caras (a futuro stickers, marca de agua…).
// Cada sub-herramienta es su propia página (rail + lienzo) y trae arriba el
// sub-switcher <EditTabs>; acá se lifta el estado del sub-tool y se muestran/
// ocultan con `active`.
const FaceCensorPage = lazy(() => import("../faceCensor/FaceCensorPage.jsx"));
const FiltersPage = lazy(() => import("../filters/FiltersPage.jsx"));
const WatermarkPage = lazy(() => import("../watermark/WatermarkPage.jsx"));
const AnnotatePage = lazy(() => import("../annotate/AnnotatePage.jsx"));

// Sub-tool inicial desde la URL (?sub=faces|filters) para que las landings
// puedan enlazar directo a una sub-herramienta: /editor/?tab=text&sub=faces
function initialSub() {
  try {
    const s = new URLSearchParams(window.location.search).get("sub");
    return ["faces", "filters", "watermark", "annotate"].includes(s) ? s : "text";
  } catch {
    return "text";
  }
}

export default function EditPage({ active, onToast, onOpenDownload }) {
  const [sub, setSub] = useState(initialSub);
  const [facesSeen, setFacesSeen] = useState(false);
  const [filtersSeen, setFiltersSeen] = useState(false);
  const [wmSeen, setWmSeen] = useState(false);
  const [anSeen, setAnSeen] = useState(false);
  // cada sub-tool carga su chunk recién al abrirla por primera vez
  useEffect(() => {
    if (active && sub === "faces") setFacesSeen(true);
    if (active && sub === "filters") setFiltersSeen(true);
    if (active && sub === "watermark") setWmSeen(true);
    if (active && sub === "annotate") setAnSeen(true);
  }, [active, sub]);

  return (
    <>
      <TextToolPage
        active={active && sub === "text"}
        subTool={sub}
        onSubTool={setSub}
        onToast={onToast}
        onOpenDownload={onOpenDownload}
      />
      {facesSeen && (
        <Suspense fallback={null}>
          <FaceCensorPage
            active={active && sub === "faces"}
            subTool={sub}
            onSubTool={setSub}
            onToast={onToast}
            onOpenDownload={onOpenDownload}
          />
        </Suspense>
      )}
      {filtersSeen && (
        <Suspense fallback={null}>
          <FiltersPage
            active={active && sub === "filters"}
            subTool={sub}
            onSubTool={setSub}
            onToast={onToast}
            onOpenDownload={onOpenDownload}
          />
        </Suspense>
      )}
      {wmSeen && (
        <Suspense fallback={null}>
          <WatermarkPage
            active={active && sub === "watermark"}
            subTool={sub}
            onSubTool={setSub}
            onToast={onToast}
            onOpenDownload={onOpenDownload}
          />
        </Suspense>
      )}
      {anSeen && (
        <Suspense fallback={null}>
          <AnnotatePage
            active={active && sub === "annotate"}
            subTool={sub}
            onSubTool={setSub}
            onToast={onToast}
            onOpenDownload={onOpenDownload}
          />
        </Suspense>
      )}
    </>
  );
}

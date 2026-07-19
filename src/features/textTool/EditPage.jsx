import { useState, useEffect, lazy, Suspense } from "react";
import TextToolPage from "./TextToolPage.jsx";

// Hub "Editar": una sola pestaña con varias sub-herramientas que se aplican
// sobre la foto. Hoy: Texto y Censurar caras (a futuro stickers, marca de agua…).
// Cada sub-herramienta es su propia página (rail + lienzo) y trae arriba el
// sub-switcher <EditTabs>; acá se lifta el estado del sub-tool y se muestran/
// ocultan con `active`.
const FaceCensorPage = lazy(() => import("../faceCensor/FaceCensorPage.jsx"));

export default function EditPage({ active, onToast, onOpenDownload }) {
  const [sub, setSub] = useState("text");
  const [facesSeen, setFacesSeen] = useState(false);
  // el chunk de caras se carga recién al abrir por primera vez esa sub-tool
  useEffect(() => {
    if (active && sub === "faces") setFacesSeen(true);
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
    </>
  );
}

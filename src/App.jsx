import { useState, useEffect, lazy, Suspense } from "react";
import { useLang } from "./lib/i18n.js";
import pkg from "../package.json";
import { useToasts } from "./hooks/useToasts.js";
import { CutoutProvider, useCutoutContext } from "./features/cutout/CutoutContext.jsx";
import CutoutPage from "./features/cutout/CutoutPage.jsx";
// Páginas secundarias: se cargan bajo demanda (la mayoría de los usuarios solo
// usa el recorte). Su chunk no entra al bundle inicial hasta abrir la pestaña.
const IconStudioPage = lazy(() => import("./features/iconStudio/IconStudioPage.jsx"));
const BatchPage = lazy(() => import("./features/batch/BatchPage.jsx"));
const StickerStudioPage = lazy(() => import("./features/stickerStudio/StickerStudioPage.jsx"));
const ColorToolsPage = lazy(() => import("./features/colorTools/ColorToolsPage.jsx"));
import Topbar from "./components/layout/Topbar.jsx";
import Toasts from "./components/feedback/Toasts.jsx";
import ConsentBanner from "./components/feedback/ConsentBanner.jsx";
import AboutModal from "./modals/AboutModal.jsx";
import DownloadModal from "./modals/DownloadModal.jsx";
import HelpModal from "./modals/HelpModal.jsx";
import Onboarding from "./modals/Onboarding.jsx";
import { STICKERS_ENABLED } from "./config.js";

// Shell de la app: idioma, pestaña activa, notificaciones y modales. Toda la
// funcionalidad de recorte vive en CutoutProvider; cada página tiene su hook.
// Pestaña inicial desde la URL (?tab=colors) para poder enlazar directo a una
// herramienta desde las landings; si no es válida, cae en "cut".
function initialTab() {
  try {
    const p = new URLSearchParams(window.location.search).get("tab");
    return ["cut", "icons", "batch", "colors"].includes(p) ? p : "cut";
  } catch {
    return "cut";
  }
}

export default function App() {
  useLang(); // re-render al cambiar idioma
  const [tab, setTab] = useState(initialTab); // cut | icons | batch | colors
  const { toasts, toast } = useToasts();

  return (
    <CutoutProvider toast={toast} onImageLoad={() => setTab("cut")}>
      <AppShell tab={tab} setTab={setTab} toasts={toasts} toast={toast} />
    </CutoutProvider>
  );
}

function AppShell({ tab, setTab, toasts, toast }) {
  const { loader } = useCutoutContext();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(() => !localStorage.getItem("pc-onboarded"));

  // Las páginas lazy se montan al abrirlas por primera vez y luego se mantienen
  // montadas (su estado se conserva; alternan visibilidad con `active`). Así el
  // chunk no se descarga hasta que el usuario realmente entra a la pestaña.
  const [iconsSeen, setIconsSeen] = useState(false);
  const [batchSeen, setBatchSeen] = useState(false);
  const [stickersSeen, setStickersSeen] = useState(false);
  const [colorsSeen, setColorsSeen] = useState(tab === "colors");
  useEffect(() => {
    if (tab === "icons") setIconsSeen(true);
    if (tab === "batch") setBatchSeen(true);
    if (tab === "stickers") setStickersSeen(true);
    if (tab === "colors") setColorsSeen(true);
  }, [tab]);

  const openDownload = () => setDlOpen(true);
  const closeModals = () => {
    setHelpOpen(false);
    setAboutOpen(false);
    setDlOpen(false);
  };

  return (
    <div className="app">
      <Topbar
        tab={tab}
        onTab={setTab}
        onFileInput={loader.onFileInput}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenDownload={openDownload}
      />

      <CutoutPage
        active={tab === "cut"}
        onGoIcons={() => setTab("icons")}
        onOpenDownload={openDownload}
        onHelp={() => setHelpOpen((v) => !v)}
        onCloseModals={closeModals}
      />

      {iconsSeen && (
        <Suspense fallback={null}>
          <IconStudioPage active={tab === "icons"} onToast={toast} onOpenDownload={openDownload} />
        </Suspense>
      )}

      {batchSeen && (
        <Suspense fallback={null}>
          <BatchPage active={tab === "batch"} onToast={toast} />
        </Suspense>
      )}

      {STICKERS_ENABLED && stickersSeen && (
        <Suspense fallback={null}>
          <StickerStudioPage active={tab === "stickers"} onToast={toast} onOpenDownload={openDownload} />
        </Suspense>
      )}

      {colorsSeen && (
        <Suspense fallback={null}>
          <ColorToolsPage active={tab === "colors"} onToast={toast} onOpenDownload={openDownload} />
        </Suspense>
      )}

      {onboarding && (
        <Onboarding
          onDismiss={() => {
            localStorage.setItem("pc-onboarded", "1");
            setOnboarding(false);
          }}
        />
      )}
      {aboutOpen && <AboutModal version={pkg.version} onClose={() => setAboutOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {dlOpen && <DownloadModal onClose={() => setDlOpen(false)} />}

      <Toasts toasts={toasts} />
      <ConsentBanner />
    </div>
  );
}

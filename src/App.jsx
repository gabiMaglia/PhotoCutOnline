import { useState } from "react";
import { useLang } from "./lib/i18n.js";
import pkg from "../package.json";
import { useToasts } from "./hooks/useToasts.js";
import { CutoutProvider, useCutoutContext } from "./features/cutout/CutoutContext.jsx";
import CutoutPage from "./features/cutout/CutoutPage.jsx";
import IconStudioPage from "./features/iconStudio/IconStudioPage.jsx";
import StickerStudioPage from "./features/stickerStudio/StickerStudioPage.jsx";
import Topbar from "./components/layout/Topbar.jsx";
import Toasts from "./components/feedback/Toasts.jsx";
import AboutModal from "./modals/AboutModal.jsx";
import DownloadModal from "./modals/DownloadModal.jsx";
import HelpModal from "./modals/HelpModal.jsx";
import Onboarding from "./modals/Onboarding.jsx";

// Shell de la app: idioma, pestaña activa, notificaciones y modales. Toda la
// funcionalidad de recorte vive en CutoutProvider; cada página tiene su hook.
export default function App() {
  useLang(); // re-render al cambiar idioma
  const [tab, setTab] = useState("cut"); // cut | icons
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

      <IconStudioPage active={tab === "icons"} onToast={toast} onOpenDownload={openDownload} />

      <StickerStudioPage active={tab === "stickers"} onToast={toast} onOpenDownload={openDownload} />

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
    </div>
  );
}

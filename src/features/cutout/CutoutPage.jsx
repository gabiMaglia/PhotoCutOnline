import { useEffect } from "react";
import { backend } from "../../lib/backend.js";
import { t } from "../../lib/i18n.js";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.js";
import AdSlot from "../promo/AdSlot.jsx";
import CanvasEditor from "./CanvasEditor.jsx";
import MarkPanel from "./components/MarkPanel.jsx";
import FinishPanel from "./components/FinishPanel.jsx";
import ExportPanel from "./components/ExportPanel.jsx";
import PreviewPanel from "./components/PreviewPanel.jsx";
import CutGhost from "./components/CutGhost.jsx";
import LargeImageModal from "./components/LargeImageModal.jsx";
import DropVeil from "./components/DropVeil.jsx";
import { useCutoutContext } from "./CutoutContext.jsx";

// Página de recorte: rail (marcar / acabado / exportar) + lienzo + vista previa
// flotante. La lógica vive en useCutout (vía contexto); aquí solo se compone.
export default function CutoutPage({ active, onGoIcons, onOpenDownload, onHelp, onCloseModals }) {
  const { workspaceRef, loader, session, preview, exporter } = useCutoutContext();

  // atajos de teclado (la página de recorte es la dueña del flujo principal)
  useKeyboardShortcuts({
    undo: session.handleUndo,
    redo: session.handleRedo,
    modeRect: () => loader.imageUrl && session.setMode("rect"),
    modeWand: () => loader.imageUrl && backend.features.wand && session.setMode("wand"),
    modeKeep: () => session.hasCut && session.setMode("fg"),
    modeRemove: () => session.hasCut && session.setMode("bg"),
    auto: () => backend.features.auto && session.handleAuto(),
    ai: () => backend.features.ai && session.handleAi(),
    brushDown: () => session.nudgeBrush(-4),
    brushUp: () => session.nudgeBrush(4),
    exportNow: () => session.hasCut && !session.busy && exporter.handleDownload(),
    preview: () => session.hasCut && preview.setOpen((v) => !v),
    compare: () => session.hasCut && session.setCompare((v) => !v),
    help: onHelp,
    escape: () => {
      preview.setOpen(false);
      loader.cancelLarge();
      onCloseModals?.();
    },
  });

  // al volver a Recorte, el lienzo estuvo display:none → re-encajar
  useEffect(() => {
    if (active) window.dispatchEvent(new Event("resize"));
  }, [active]);

  const showPreview = active && preview.open && session.hasCut && session.resultUrl;

  return (
    <>
      <div className="body" style={active ? undefined : { display: "none" }}>
        <aside className="rail">
          <MarkPanel
            imageUrl={loader.imageUrl}
            hasCut={session.hasCut}
            busy={session.busy}
            mode={session.mode}
            setMode={session.setMode}
            brushSize={session.brushSize}
            setBrushSize={session.setBrushSize}
            wandTolerance={session.wandTolerance}
            setWandTolerance={session.setWandTolerance}
            feather={session.feather}
            onFeather={session.handleFeather}
            canUndo={session.canUndo}
            canRedo={session.canRedo}
            onAi={session.handleAi}
            onAuto={session.handleAuto}
            onUndo={session.handleUndo}
            onRedo={session.handleRedo}
          />

          {backend.features.finish && (
            <FinishPanel
              hasCut={session.hasCut}
              stickerOn={session.stickerOn}
              stickerWidth={session.stickerWidth}
              shadowOn={session.shadowOn}
              shadowSize={session.shadowSize}
              onSticker={session.setSticker}
              onStickerWidth={session.changeStickerWidth}
              onShadow={session.setShadow}
              onShadowSize={session.changeShadowSize}
            />
          )}

          <ExportPanel
            hasCut={session.hasCut}
            busy={session.busy}
            previewOpen={preview.open}
            onTogglePreview={() => preview.setOpen((v) => !v)}
            presetId={exporter.presetId}
            setPresetId={exporter.setPresetId}
            exportMode={exporter.exportMode}
            setExportMode={exporter.setExportMode}
            format={exporter.format}
            setFormat={exporter.setFormat}
            bgColor={exporter.bgColor}
            setBgColor={exporter.setBgColor}
            bgImage={exporter.bgImage}
            setBgImage={exporter.setBgImage}
            bgOpacity={exporter.bgOpacity}
            setBgOpacity={exporter.setBgOpacity}
            resultScale={exporter.resultScale}
            setResultScale={(v) => {
              exporter.setResultScale(v);
              preview.setOpen(true); // el encuadre se ve en la vista previa
            }}
            resultRotation={exporter.resultRotation}
            setResultRotation={(v) => {
              exporter.setResultRotation(v);
              preview.setOpen(true);
            }}
            rotateBy={(d) => {
              exporter.rotateBy(d);
              preview.setOpen(true);
            }}
            onChooseBgImage={exporter.chooseBackgroundImage}
            onDownload={exporter.handleDownload}
            onCopy={exporter.copyToClipboard}
            onGoIcons={onGoIcons}
          />

          <div className="rail-help">
            <p>{t("rail.help")}</p>
          </div>

          {/* solo en la pestaña activa: las redes exigen 1 anuncio por página */}
          {active && <AdSlot placement="cut-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="workspace" ref={workspaceRef}>
          <CanvasEditor
            imageUrl={loader.imageUrl}
            imageSize={loader.imageSize}
            resultUrl={session.resultUrl}
            mode={session.mode}
            brushSize={session.brushSize}
            onRect={session.handleRect}
            onStroke={session.handleStroke}
            onWand={session.handleWand}
            busy={session.busy}
            compare={session.compare}
            onCompareChange={session.setCompare}
          />
        </main>
      </div>

      {showPreview && (
        <PreviewPanel
          panelRef={preview.panelRef}
          size={preview.size}
          pos={preview.pos}
          bg={preview.bg}
          setBg={preview.setBg}
          color={preview.color}
          setColor={preview.setColor}
          exportMode={exporter.exportMode}
          bgColor={exporter.bgColor}
          bgImage={exporter.bgImage}
          bgOpacity={exporter.bgOpacity}
          resultUrl={session.resultUrl}
          resultScale={exporter.resultScale}
          resultRotation={exporter.resultRotation}
          onClose={() => preview.setOpen(false)}
          handlers={preview.handlers}
        />
      )}

      <CutGhost pos={preview.cutGhost} src={session.resultUrl} />

      <LargeImageModal
        pending={loader.pendingLarge}
        onConfirm={loader.confirmReduceLarge}
        onCancel={loader.cancelLarge}
      />

      <DropVeil show={loader.dragging} />
    </>
  );
}

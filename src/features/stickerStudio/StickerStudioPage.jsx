import { useEffect, useRef } from "react";
import { renderSticker } from "../../lib/stickers.js";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import FileButton from "../../components/ui/FileButton.jsx";
import Checkbox from "../../components/ui/Checkbox.jsx";
import Slider from "../../components/ui/Slider.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useStickerStudio } from "./hooks/useStickerStudio.js";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";

// Sticker Studio: convierte un recorte en sticker (contorno + sombra) y lo
// exporta listo para WhatsApp (WebP 512), Telegram (PNG 512) o PNG genérico.
export default function StickerStudioPage({ active, onToast, onOpenDownload }) {
  const { getCutout, session } = useCutoutContext();
  const hasCut = session.hasCut;
  const heroRef = useRef(null);
  const s = useStickerStudio({ getCutout, onToast });

  // vista previa 512 sobre el checker
  useEffect(() => {
    if (!s.source || !heroRef.current) return;
    const ctx = heroRef.current.getContext("2d");
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(renderSticker(s.source, s.renderOpts), 0, 0);
  }, [s.source, s.outlineOn, s.outlineWidth, s.outlineColor, s.shadowOn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="body" style={active ? undefined : { display: "none" }}>
      <div className="icon-studio">
        <aside className="rail">
          <section className="rail-group">
            <h2 className="rail-title">{t("icon.source")}</h2>
            <Button variant="primary" disabled={!hasCut} onClick={s.useCurrentCutout}>
              {t("icon.useCurrent")}
            </Button>
            <FileButton
              accept="image/png,image/webp"
              onChange={(e) => e.target.files?.[0] && s.loadFromFile(e.target.files[0])}
            >
              {t("icon.openPng")}
            </FileButton>
            {s.sourceName && <div className="source-tag">{s.sourceName}</div>}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("sticker.look")}</h2>
            <div className="row">
              <Checkbox checked={s.outlineOn} onChange={s.setOutlineOn}>
                {t("sticker.outline")}
              </Checkbox>
              <input
                type="color"
                value={s.outlineColor}
                disabled={!s.outlineOn}
                onChange={(e) => s.setOutlineColor(e.target.value)}
                aria-label={t("sticker.outlineColor")}
              />
            </div>
            <Slider
              id="sticker-outline-w"
              label={t("sticker.outlineWidth", { n: s.outlineWidth })}
              min={0}
              max={48}
              value={s.outlineWidth}
              onChange={s.setOutlineWidth}
              disabled={!s.outlineOn}
              off={!s.outlineOn}
            />
            <Checkbox checked={s.shadowOn} onChange={s.setShadowOn}>
              {t("sticker.shadow")}
            </Checkbox>
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("sticker.export")}</h2>
            <Button variant="primary" disabled={!s.source || s.busy} onClick={() => s.exportTo("whatsapp")}>
              {t("sticker.whatsapp")}
            </Button>
            <Button disabled={!s.source || s.busy} onClick={() => s.exportTo("telegram")}>
              {t("sticker.telegram")}
            </Button>
            <Button disabled={!s.source || s.busy} onClick={() => s.exportTo("png")}>
              {t("sticker.png")}
            </Button>
            <div className="rail-help">
              <p>{t("sticker.help")}</p>
            </div>
          </section>

          {active && <AdSlot placement="stickers-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!s.source && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>✦</div>
              <h2>{t("tab.stickers")}</h2>
              <p>{t("sticker.emptyBody")}</p>
            </div>
          )}
          {s.source && (
            <div className="icon-grid">
              <div className="icon-hero icon-hero-sticker">
                <div className="checker" />
                <canvas ref={heroRef} width={512} height={512} />
              </div>
              <p className="icon-note">{t("sticker.note")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { backend } from "../../lib/backend.js";
import { PLATFORMS, renderIcon } from "../../lib/icons.js";
import { t } from "../../lib/i18n.js";
import Button from "../../components/ui/Button.jsx";
import FileButton from "../../components/ui/FileButton.jsx";
import Checkbox from "../../components/ui/Checkbox.jsx";
import Slider from "../../components/ui/Slider.jsx";
import Field from "../../components/ui/Field.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useIconStudio } from "./hooks/useIconStudio.js";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";

// Icon Studio: convierte cualquier PNG (idealmente el recorte transparente) en
// sets de iconos para iOS, Android, macOS, Windows y Web/PWA. La lógica vive en
// useIconStudio; el estado de "hay recorte" llega del contexto de recorte.
const PREVIEW_SIZES = [128, 64, 48, 32, 16];

export default function IconStudioPage({ active, onToast, onOpenDownload }) {
  const { getCutout, session } = useCutoutContext();
  const hasCut = session.hasCut;
  const heroRef = useRef(null);
  const s = useIconStudio({ getCutout, onToast });

  // preview grande (256px)
  useEffect(() => {
    if (!s.source || !heroRef.current) return;
    const ctx = heroRef.current.getContext("2d");
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(renderIcon(s.renderSource, 256, s.renderOpts), 0, 0);
  }, [s.renderSource, s.padding, s.fit, s.scale, s.rotation, s.bgOn, s.bgColor, s.bgImage]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {backend.features.ai && (
              <Button variant="ai" disabled={!s.source || s.removing} onClick={s.removeBackground}>
                {s.removing ? t("icon.removing") : t("icon.removeBg")}
              </Button>
            )}
            <Button disabled={!s.source || !s.canTrim} onClick={s.trimSource}>
              {t("icon.trim")}
            </Button>
            {s.sourceName && <div className="source-tag">{s.sourceName}</div>}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("icon.settings")}</h2>
            <Slider
              id="icon-pad"
              label={t("icon.margin", { n: s.padding })}
              min={0}
              max={30}
              value={s.padding}
              onChange={s.setPadding}
            />
            <ChipGroup
              ariaLabel={t("icon.fitAria")}
              value={s.fit}
              onChange={s.setFit}
              options={["contain", "cover", "subject"].map((f) => ({ value: f, label: t(`icon.fit.${f}`) }))}
            />
            <Slider
              id="icon-scale"
              label={t("icon.scale", { n: s.scale })}
              min={100}
              max={300}
              value={s.scale}
              onChange={s.setScale}
            />
            <Slider
              id="icon-rotation"
              label={t("icon.rotate", { n: s.rotation })}
              min={-180}
              max={180}
              value={s.rotation}
              onChange={s.setRotation}
            />
            <div className="format-row" role="group" aria-label={t("icon.rotateAria")}>
              <button className="chip" onClick={() => s.rotateBy(-90)}>
                ⟲ 90°
              </button>
              <button className="chip" onClick={() => s.rotateBy(90)}>
                ⟳ 90°
              </button>
            </div>
            <div className="row">
              <Checkbox checked={s.bgOn} onChange={s.setBgOn}>
                {t("icon.bg")}
              </Checkbox>
              <input
                type="color"
                value={s.bgColor}
                disabled={!s.bgOn}
                onChange={(e) => s.setBgColor(e.target.value)}
                aria-label={t("icon.bgAria")}
              />
            </div>
            {!s.bgImage ? (
              <FileButton
                size="small"
                onChange={(e) => e.target.files?.[0] && s.loadBgFromFile(e.target.files[0])}
              >
                {t("icon.bgImage")}
              </FileButton>
            ) : (
              <Button size="small" onClick={() => s.setBgImage(null)}>
                {t("icon.bgImageRemove")}
              </Button>
            )}
            <Field id="app-name" label={t("icon.appName")}>
              <input
                id="app-name"
                type="text"
                value={s.appName}
                onChange={(e) => s.setAppName(e.target.value)}
                placeholder="Mi App"
              />
            </Field>
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("icon.platforms")}</h2>
            {PLATFORMS.map((p) => (
              <label key={p.id} className={`platform ${s.selected.has(p.id) ? "platform-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={s.selected.has(p.id)}
                  onChange={() => s.togglePlatform(p.id)}
                />
                <span className="platform-name">{p.name}</span>
                <span className="platform-detail">{p.detail}</span>
              </label>
            ))}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("icon.generate")}</h2>
            <Button
              variant="primary"
              disabled={!s.source || s.selected.size === 0 || s.building}
              onClick={s.downloadZip}
            >
              {s.building ? t("icon.building") : t("icon.zipBtn")}
            </Button>
           
            <Button onClick={s.copySnippet}>{t("icon.snippetBtn")}</Button>
          </section>

          {/* solo en la pestaña activa: las redes exigen 1 anuncio por página */}
          {active && <AdSlot placement="icons-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!s.source && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>▣</div>
              <h2>Icon Studio</h2>
              <p>{t("icon.emptyBody")}</p>
            </div>
          )}
          {s.source && (
            <div className="icon-grid">
              <div className="icon-hero">
                <div className="checker" />
                <canvas ref={heroRef} width={256} height={256} />
              </div>
              <div className="icon-row">
                {PREVIEW_SIZES.map((size) => (
                  <SizePreview key={size} source={s.renderSource} size={size} opts={s.renderOpts} />
                ))}
              </div>
              <p className="icon-note">{t("icon.note")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SizePreview({ source, size, opts }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(renderIcon(source, size, opts), 0, 0);
  }, [source, size, opts.padding, opts.fit, opts.scale, opts.rotation, opts.bg, opts.bgImage]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <figure className="size-preview">
      <div className="size-box">
        <div className="checker" />
        <canvas ref={ref} width={size} height={size} />
      </div>
      <figcaption>{size}px</figcaption>
    </figure>
  );
}

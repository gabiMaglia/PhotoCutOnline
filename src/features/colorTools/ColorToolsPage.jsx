import { useState } from "react";
import { t } from "../../lib/i18n.js";
import { contrastText, paletteToText, hexToRgb, contrastRatio, wcagLevels } from "../../lib/palette.js";
import Button from "../../components/ui/Button.jsx";
import FileButton from "../../components/ui/FileButton.jsx";
import Slider from "../../components/ui/Slider.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import { useColorTools } from "./hooks/useColorTools.js";

function copyText(text, onToast, msg) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => onToast?.(msg),
    () => onToast?.("No se pudo copiar")
  );
}

// Herramientas de color: extrae la paleta dominante de una imagen y permite
// leer el hex de cualquier píxel con un cuentagotas. Análisis 100% local.
export default function ColorToolsPage({ active, onToast, onOpenDownload }) {
  const { loader } = useCutoutContext();
  const currentImage = loader?.imageUrl;
  const c = useColorTools({ onToast });
  const [hover, setHover] = useState(null); // { hex, x, y } sobre el canvas

  // Verificador de contraste WCAG (independiente de la imagen).
  const [fg, setFg] = useState("#1f2937");
  const [bg, setBg] = useState("#d6f64b");
  const ratio = contrastRatio(hexToRgb(fg) || { r: 0, g: 0, b: 0 }, hexToRgb(bg) || { r: 255, g: 255, b: 255 });
  const lv = wcagLevels(ratio);
  const badge = (ok, label) => (
    <span className={`wcag-badge ${ok ? "wcag-pass" : "wcag-fail"}`}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );

  const onMove = (e) => {
    const col = c.readAt(e.clientX, e.clientY);
    if (!col) return setHover(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ hex: col.hex, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onPick = (e) => {
    const col = c.readAt(e.clientX, e.clientY);
    if (!col) return;
    c.pin(col);
    copyText(col.hex, onToast, `${col.hex} copiado`);
  };

  return (
    <div className="body" style={active ? undefined : { display: "none" }}>
      <div className="icon-studio">
        <aside className="rail">
          <section className="rail-group">
            <h2 className="rail-title">{t("color.source")}</h2>
            <Button
              variant="primary"
              disabled={!currentImage}
              onClick={() => c.loadFromUrl(currentImage, t("color.currentName"))}
            >
              {t("color.useCurrent")}
            </Button>
            <FileButton
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && c.loadFromFile(e.target.files[0])}
            >
              {t("color.openImage")}
            </FileButton>
            {c.sourceName && <div className="source-tag">{c.sourceName}</div>}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("color.palette")}</h2>
            <Slider
              id="color-count"
              label={t("color.count", { n: c.count })}
              min={3}
              max={12}
              value={c.count}
              onChange={c.changeCount}
              disabled={!c.ready}
              off={!c.ready}
            />
            <Button
              disabled={!c.palette.length}
              onClick={() => copyText(paletteToText(c.palette, "hex"), onToast, t("color.copiedPalette"))}
            >
              {t("color.copyHex")}
            </Button>
            <Button
              disabled={!c.palette.length}
              onClick={() => copyText(paletteToText(c.palette, "css"), onToast, t("color.copiedCss"))}
            >
              {t("color.copyCss")}
            </Button>
            <Button
              disabled={!c.palette.length}
              onClick={() => copyText(paletteToText(c.palette, "json"), onToast, t("color.copiedJson"))}
            >
              {t("color.copyJson")}
            </Button>
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("color.picker")}</h2>
            <div className="rail-help">
              <p>{t("color.pickerHelp")}</p>
            </div>
            {c.picked.length > 0 && (
              <>
                <div className="color-pins">
                  {c.picked.map((p) => (
                    <button
                      key={p.hex}
                      className="color-pin"
                      style={{ background: p.hex, color: contrastText(p.r, p.g, p.b) }}
                      onClick={() => copyText(p.hex, onToast, `${p.hex} copiado`)}
                      title={t("color.copyOne")}
                    >
                      {p.hex}
                    </button>
                  ))}
                </div>
                <Button onClick={c.clearPicked}>{t("color.clearPicked")}</Button>
              </>
            )}
          </section>

          <section className="rail-group">
            <h2 className="rail-title">{t("color.contrast")}</h2>
            <div className="contrast-inputs">
              <label className="contrast-field">
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} aria-label={t("color.contrastFg")} />
                <span>{t("color.contrastFg")}</span>
              </label>
              <label className="contrast-field">
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label={t("color.contrastBg")} />
                <span>{t("color.contrastBg")}</span>
              </label>
            </div>
            <div className="contrast-sample" style={{ background: bg, color: fg }}>
              <span className="contrast-ratio">{ratio.toFixed(2)}:1</span>
              <span>{t("color.contrastSample")}</span>
            </div>
            <div className="wcag-grid">
              {badge(lv.aaNormal, `AA · ${t("color.textNormal")}`)}
              {badge(lv.aaLarge, `AA · ${t("color.textLarge")}`)}
              {badge(lv.aaaNormal, `AAA · ${t("color.textNormal")}`)}
              {badge(lv.aaaLarge, `AAA · ${t("color.textLarge")}`)}
            </div>
          </section>

          {active && <AdSlot placement="colors-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!c.ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>◔</div>
              <h2>{t("tab.colors")}</h2>
              <p>{t("color.emptyBody")}</p>
            </div>
          )}

          {/* El canvas se mantiene SIEMPRE montado (solo oculto hasta que hay
              imagen): drawImage necesita canvasRef.current disponible para poder
              dibujar y recién ahí marcar ready. */}
          <div className="color-workspace" style={c.ready ? undefined : { display: "none" }}>
            <div className="color-canvas-wrap">
              <canvas
                ref={c.canvasRef}
                className="color-canvas"
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                onClick={onPick}
              />
              {hover && (
                <div className="color-loupe" style={{ left: hover.x, top: hover.y }} aria-hidden>
                  <span className="color-loupe-chip" style={{ background: hover.hex }} />
                  <span className="color-loupe-hex">{hover.hex}</span>
                </div>
              )}
            </div>

            <div className="color-swatches" role="list" aria-label={t("color.palette")}>
              {c.palette.map((sw) => (
                <button
                  key={sw.hex}
                  role="listitem"
                  className="color-swatch"
                  style={{ background: sw.hex, color: contrastText(sw.r, sw.g, sw.b) }}
                  onClick={() => copyText(sw.hex, onToast, `${sw.hex} copiado`)}
                  title={t("color.copyOne")}
                >
                  {sw.hex}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

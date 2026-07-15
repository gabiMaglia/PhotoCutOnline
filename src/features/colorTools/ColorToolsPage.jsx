import { useState, useEffect, useRef, useMemo } from "react";
import { t } from "../../lib/i18n.js";
import { contrastText, paletteToText, hexToRgb, contrastRatio, wcagLevels, extractPalette } from "../../lib/palette.js";
import { themeFlip, extractColorsFromText, recolorToPalette } from "../../lib/recolor.js";
import { buildScheme, schemeToCss, schemeToTailwind } from "../../lib/scheme.js";
import Button from "../../components/ui/Button.jsx";
import FileButton from "../../components/ui/FileButton.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
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

// Fila compacta de muestras (paleta bajo cada preview). Clic = copiar HEX.
function MiniPalette({ colors, onToast }) {
  if (!colors || colors.length === 0) return null;
  return (
    <div className="cs-minipal">
      {colors.map((c) => (
        <button
          key={c.hex}
          className="cs-minipal-chip"
          style={{ background: c.hex, color: contrastText(c.r, c.g, c.b) }}
          title={c.hex}
          onClick={() => copyText(c.hex, onToast, `${c.hex} copiado`)}
        >
          {c.hex}
        </button>
      ))}
    </div>
  );
}

// Color Studio: análisis de color (paleta + cuentagotas + contraste WCAG) y
// transformaciones (tema claro/oscuro y recolor con un esquema de referencia).
// Todo 100% local.
export default function ColorToolsPage({ active, onToast, onOpenDownload }) {
  const { loader } = useCutoutContext();
  const currentImage = loader?.imageUrl;
  const c = useColorTools({ onToast });
  const [mode, setMode] = useState("palette"); // palette | theme | recolor
  const [hover, setHover] = useState(null);

  // Verificador de contraste WCAG (independiente de la imagen).
  const [fg, setFg] = useState("#1f2937");
  const [bg, setBg] = useState("#d6f64b");
  const ratio = contrastRatio(hexToRgb(fg) || { r: 0, g: 0, b: 0 }, hexToRgb(bg) || { r: 255, g: 255, b: 255 });
  const lv = wcagLevels(ratio);
  const badge = (ok, label) => (
    <span className={`wcag-badge ${ok ? "wcag-pass" : "wcag-fail"}`}>{ok ? "✓" : "✕"} {label}</span>
  );

  // Tema y recolor comparten dos canvas antes/después.
  const beforeRef = useRef(null);
  const afterRef = useRef(null);
  const [themeTarget, setThemeTarget] = useState("dark"); // dark | light | flip
  const [cssText, setCssText] = useState("");
  const [applied, setApplied] = useState(false);
  const refColors = useMemo(() => extractColorsFromText(cssText), [cssText]);
  const [beforePal, setBeforePal] = useState([]);
  const [afterPal, setAfterPal] = useState([]);
  const [aspect, setAspect] = useState(1.4); // ancho/alto de la imagen
  const scheme = useMemo(() => (afterPal.length ? buildScheme(afterPal) : null), [afterPal]);

  const paintPair = (resultBytes) => {
    const src = c.getImageData();
    if (!src) return;
    const { width, height } = src;
    setAspect(width / height);
    for (const [ref, bytes] of [[beforeRef, src.data], [afterRef, resultBytes]]) {
      const cv = ref.current;
      if (!cv) continue;
      cv.width = width;
      cv.height = height;
      const ctx = cv.getContext("2d");
      const id = ctx.createImageData(width, height);
      id.data.set(bytes);
      ctx.putImageData(id, 0, 0);
    }
    setBeforePal(extractPalette(src, 6));
    setAfterPal(extractPalette({ data: resultBytes, width, height }, 6));
  };

  // Regenera el tema al entrar al modo, cambiar objetivo o cargar imagen.
  useEffect(() => {
    if (mode !== "theme" || !c.ready) return;
    const src = c.getImageData();
    if (src) paintPair(themeFlip(src, themeTarget));
  }, [mode, themeTarget, c.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al entrar a Recolorear, mostrar la original en el panel "antes" (el "después"
  // queda vacío hasta aplicar un esquema).
  useEffect(() => {
    if (mode !== "recolor" || !c.ready) return;
    const src = c.getImageData();
    const cv = beforeRef.current;
    if (src && cv) {
      cv.width = src.width;
      cv.height = src.height;
      const ctx = cv.getContext("2d");
      const id = ctx.createImageData(src.width, src.height);
      id.data.set(src.data);
      ctx.putImageData(id, 0, 0);
      setAspect(src.width / src.height);
      setBeforePal(extractPalette(src, 6));
      setAfterPal([]);
    }
    setApplied(false);
  }, [mode, c.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyRecolor = () => {
    const src = c.getImageData();
    if (!src || refColors.length === 0) return;
    paintPair(recolorToPalette(src, refColors));
    setApplied(true);
  };

  const downloadAfter = (suffix) => {
    const cv = afterRef.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (c.sourceName?.replace(/\.[^.]+$/, "") || "imagen") + suffix + ".png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };

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
            <Button variant="primary" disabled={!currentImage} onClick={() => c.loadFromUrl(currentImage, t("color.currentName"))}>
              {t("color.useCurrent")}
            </Button>
            <FileButton accept="image/*" onChange={(e) => e.target.files?.[0] && c.loadFromFile(e.target.files[0])}>
              {t("color.openImage")}
            </FileButton>
            {c.sourceName && <div className="source-tag">{c.sourceName}</div>}
            <ChipGroup
              ariaLabel={t("cs.mode")}
              value={mode}
              onChange={setMode}
              options={[
                { value: "palette", label: t("cs.mode.palette") },
                { value: "theme", label: t("cs.mode.theme") },
                { value: "recolor", label: t("cs.mode.recolor") },
              ]}
            />
          </section>

          {mode === "palette" && (
            <>
              <section className="rail-group">
                <h2 className="rail-title">{t("color.palette")}</h2>
                <Slider id="color-count" label={t("color.count", { n: c.count })} min={3} max={12} value={c.count} onChange={c.changeCount} disabled={!c.ready} off={!c.ready} />
                <Button disabled={!c.palette.length} onClick={() => copyText(paletteToText(c.palette, "hex"), onToast, t("color.copiedPalette"))}>{t("color.copyHex")}</Button>
                <Button disabled={!c.palette.length} onClick={() => copyText(paletteToText(c.palette, "css"), onToast, t("color.copiedCss"))}>{t("color.copyCss")}</Button>
                <Button disabled={!c.palette.length} onClick={() => copyText(paletteToText(c.palette, "json"), onToast, t("color.copiedJson"))}>{t("color.copyJson")}</Button>
              </section>

              <section className="rail-group">
                <h2 className="rail-title">{t("color.picker")}</h2>
                <div className="rail-help"><p>{t("color.pickerHelp")}</p></div>
                {c.picked.length > 0 && (
                  <>
                    <div className="color-pins">
                      {c.picked.map((p) => (
                        <button key={p.hex} className="color-pin" style={{ background: p.hex, color: contrastText(p.r, p.g, p.b) }} onClick={() => copyText(p.hex, onToast, `${p.hex} copiado`)} title={t("color.copyOne")}>{p.hex}</button>
                      ))}
                    </div>
                    <Button onClick={c.clearPicked}>{t("color.clearPicked")}</Button>
                  </>
                )}
              </section>

              <section className="rail-group">
                <h2 className="rail-title">{t("color.contrast")}</h2>
                <div className="contrast-inputs">
                  <label className="contrast-field"><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} aria-label={t("color.contrastFg")} /><span>{t("color.contrastFg")}</span></label>
                  <label className="contrast-field"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label={t("color.contrastBg")} /><span>{t("color.contrastBg")}</span></label>
                </div>
                <div className="contrast-sample" style={{ background: bg, color: fg }}><span className="contrast-ratio">{ratio.toFixed(2)}:1</span><span>{t("color.contrastSample")}</span></div>
                <div className="wcag-grid">
                  {badge(lv.aaNormal, `AA · ${t("color.textNormal")}`)}
                  {badge(lv.aaLarge, `AA · ${t("color.textLarge")}`)}
                  {badge(lv.aaaNormal, `AAA · ${t("color.textNormal")}`)}
                  {badge(lv.aaaLarge, `AAA · ${t("color.textLarge")}`)}
                </div>
              </section>
            </>
          )}

          {mode === "theme" && (
            <section className="rail-group">
              <h2 className="rail-title">{t("cs.theme.title")}</h2>
              <ChipGroup
                ariaLabel={t("cs.theme.target")}
                value={themeTarget}
                onChange={setThemeTarget}
                options={[
                  { value: "dark", label: t("cs.theme.dark") },
                  { value: "light", label: t("cs.theme.light") },
                  { value: "flip", label: t("cs.theme.flip") },
                ]}
              />
              <Button variant="primary" disabled={!c.ready} onClick={() => downloadAfter("-" + themeTarget)}>{t("cs.download")}</Button>
              <div className="rail-help"><p>{t("cs.theme.help")}</p></div>
            </section>
          )}

          {mode === "recolor" && (
            <section className="rail-group">
              <h2 className="rail-title">{t("cs.recolor.title")}</h2>
              <textarea
                className="cs-css-input"
                placeholder={t("cs.recolor.placeholder")}
                value={cssText}
                onChange={(e) => setCssText(e.target.value)}
                rows={5}
              />
              {refColors.length > 0 ? (
                <div className="color-pins">
                  {refColors.slice(0, 16).map((p) => (
                    <span key={p.hex} className="color-pin" style={{ background: p.hex, color: contrastText(p.r, p.g, p.b) }}>{p.hex}</span>
                  ))}
                </div>
              ) : (
                <div className="rail-help"><p>{t("cs.recolor.noColors")}</p></div>
              )}
              <Button variant="primary" disabled={!c.ready || refColors.length === 0} onClick={applyRecolor}>{t("cs.recolor.apply")}</Button>
              <Button disabled={!applied} onClick={() => downloadAfter("-recolor")}>{t("cs.download")}</Button>
              <div className="rail-help"><p>{t("cs.recolor.help")}</p></div>
            </section>
          )}

          {active && <AdSlot placement="colors-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!c.ready && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>◔</div>
              <h2>Color Studio</h2>
              <p>{t("color.emptyBody")}</p>
            </div>
          )}

          {/* Modo Paleta: canvas del cuentagotas SIEMPRE montado (drawImage lo
              necesita para poblar el ImageData que usan todos los modos). */}
          <div className="color-workspace" style={c.ready && mode === "palette" ? undefined : { display: "none" }}>
            <div className="color-canvas-wrap">
              <canvas ref={c.canvasRef} className="color-canvas" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onPick} />
              {hover && (
                <div className="color-loupe" style={{ left: hover.x, top: hover.y }} aria-hidden>
                  <span className="color-loupe-chip" style={{ background: hover.hex }} />
                  <span className="color-loupe-hex">{hover.hex}</span>
                </div>
              )}
            </div>
            <div className="color-swatches" role="list" aria-label={t("color.palette")}>
              {c.palette.map((sw) => (
                <button key={sw.hex} role="listitem" className="color-swatch" style={{ background: sw.hex, color: contrastText(sw.r, sw.g, sw.b) }} onClick={() => copyText(sw.hex, onToast, `${sw.hex} copiado`)} title={t("color.copyOne")}>{sw.hex}</button>
              ))}
            </div>
          </div>

          {c.ready && (mode === "theme" || mode === "recolor") && (
            <div className="cs-result">
              {/* Layout adaptativo: imágenes anchas (horizontales) se apilan en
                  columna; las altas (verticales) van lado a lado (aprovecha mejor
                  el espacio). */}
              <div className={`cs-compare ${aspect >= 1 ? "cs-stacked" : "cs-row"}`}>
                <div className="cs-pane">
                  <span className="cs-pane-tag">{t("cs.before")}</span>
                  <canvas ref={beforeRef} className="cs-canvas" />
                  <MiniPalette colors={beforePal} onToast={onToast} />
                </div>
                <div className="cs-pane">
                  <span className="cs-pane-tag">{t("cs.after")}</span>
                  <canvas ref={afterRef} className="cs-canvas" />
                  <MiniPalette colors={afterPal} onToast={onToast} />
                </div>
              </div>

              {scheme && (
                <section className="cs-scheme">
                  <div className="cs-scheme-head">
                    <h3>{t("cs.scheme.title")}</h3>
                    <div className="cs-scheme-actions">
                      <Button size="small" onClick={() => copyText(schemeToCss(scheme), onToast, t("cs.scheme.copiedCss"))}>{t("cs.scheme.css")}</Button>
                      <Button size="small" onClick={() => copyText(schemeToTailwind(scheme), onToast, t("cs.scheme.copiedTw"))}>{t("cs.scheme.tailwind")}</Button>
                    </div>
                  </div>
                  <p className="cs-scheme-note">{t("cs.scheme.help")}</p>
                  <div className="cs-scheme-scales">
                    {["primary", "secondary", "accent", "neutral", "success", "warning", "error", "info"].map((role) => (
                      <div className="cs-scale-row" key={role}>
                        <span className="cs-scale-name">{role}</span>
                        <div className="cs-scale-stops">
                          {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"].map((s) => (
                            <button
                              key={s}
                              className="cs-scale-stop"
                              style={{ background: scheme[role][s] }}
                              title={`${role}-${s} ${scheme[role][s]}`}
                              onClick={() => copyText(scheme[role][s], onToast, `${scheme[role][s]} copiado`)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

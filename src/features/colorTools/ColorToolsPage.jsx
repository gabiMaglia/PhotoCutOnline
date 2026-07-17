import { useState, useEffect, useRef, useMemo } from "react";
import { t } from "../../lib/i18n.js";
import { contrastText, paletteToText, hexToRgb, contrastRatio, wcagLevels, extractPalette } from "../../lib/palette.js";
import { themeFlip } from "../../lib/recolor.js";
import { buildScheme, schemeToCss, schemeToTailwind } from "../../lib/scheme.js";
import { computeHistogram, simulateCVD, CVD_TYPES } from "../../lib/analysis.js";
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

// El esquema mezcla dos cosas distintas y hay que mostrarlo como tal: los
// derivados salen de la paleta de TU imagen, los semánticos son convenciones
// fijas (verde=éxito, rojo=error…) que no cambian con la foto.
const SCHEME_GROUPS = [
  { key: "derived", roles: ["primary", "secondary", "accent", "neutral"] },
  { key: "semantic", roles: ["success", "warning", "error", "info"] },
];

// Paleta compacta bajo cada preview, con su rótulo. Clic en una muestra = copiar HEX.
function MiniPalette({ colors, onToast, label }) {
  if (!colors || colors.length === 0) return null;
  return (
    <div className="cs-minipal-wrap">
      <span className="cs-minipal-label">{label ?? t("cs.paletteLabel")}</span>
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
    </div>
  );
}

// Color Studio: análisis de color (paleta + cuentagotas + contraste WCAG) y
// transformaciones (tema claro/oscuro).
// Todo 100% local.
export default function ColorToolsPage({ active, onToast, onOpenDownload }) {
  const { sharedImageUrl, shareFile } = useCutoutContext();
  const currentImage = sharedImageUrl;
  const c = useColorTools({ onToast });
  const [mode, setMode] = useState("palette"); // palette | theme | histogram | cvd
  const [hover, setHover] = useState(null);

  // Verificador de contraste WCAG (independiente de la imagen).
  const [fg, setFg] = useState("#1f2937");
  const [bg, setBg] = useState("#d6f64b");
  const ratio = contrastRatio(hexToRgb(fg) || { r: 0, g: 0, b: 0 }, hexToRgb(bg) || { r: 255, g: 255, b: 255 });
  const lv = wcagLevels(ratio);
  const badge = (ok, label) => (
    <span className={`wcag-badge ${ok ? "wcag-pass" : "wcag-fail"}`}>{ok ? "✓" : "✕"} {label}</span>
  );

  // Tema usa dos canvas antes/después.
  const beforeRef = useRef(null);
  const afterRef = useRef(null);
  const [themeTarget, setThemeTarget] = useState("dark"); // dark | light | flip
  const [beforePal, setBeforePal] = useState([]);
  const [afterPal, setAfterPal] = useState([]);
  const [aspect, setAspect] = useState(1.4); // ancho/alto de la imagen
  const [schemeSrc, setSchemeSrc] = useState("after"); // desde qué preview sale el esquema
  const schemePal = schemeSrc === "before" ? beforePal : afterPal;
  const scheme = useMemo(() => (schemePal.length ? buildScheme(schemePal) : null), [schemePal]);

  // Histograma y daltonismo (CVD).
  const histRef = useRef(null);
  const cvdBeforeRef = useRef(null);
  const cvdAfterRef = useRef(null);
  const [cvdType, setCvdType] = useState("deuteranopia");
  const [cvdBeforePal, setCvdBeforePal] = useState([]);
  const [cvdAfterPal, setCvdAfterPal] = useState([]);

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

  const downloadCanvas = (ref, suffix) => {
    const cv = ref.current;
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
  const downloadAfter = (suffix) => downloadCanvas(afterRef, suffix);

  // Histograma (RGB, aditivo) del canal de la imagen cargada.
  useEffect(() => {
    if (mode !== "histogram" || !c.ready) return;
    const src = c.getImageData();
    const cv = histRef.current;
    if (!src || !cv) return;
    const W = 512, H = 200;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    const hist = computeHistogram(src);
    const chans = [["r", "#ff5e63"], ["g", "#63d68a"], ["b", "#5a9bff"]];
    ctx.globalCompositeOperation = "lighter";
    for (const [k, color] of chans) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x < 256; x++) ctx.lineTo((x / 255) * W, H - (hist[k][x] / hist.max) * H);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }, [mode, c.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulación de daltonismo (antes/después).
  useEffect(() => {
    if (mode !== "cvd" || !c.ready) return;
    const src = c.getImageData();
    if (!src) return;
    const { width, height } = src;
    setAspect(width / height);
    const cvdBytes = simulateCVD(src, cvdType);
    for (const [ref, bytes] of [[cvdBeforeRef, src.data], [cvdAfterRef, cvdBytes]]) {
      const cv = ref.current;
      if (!cv) continue;
      cv.width = width; cv.height = height;
      const ctx = cv.getContext("2d");
      const id = ctx.createImageData(width, height);
      id.data.set(bytes);
      ctx.putImageData(id, 0, 0);
    }
    // paletas antes/después: ver cómo colapsan los colores bajo el daltonismo
    setCvdBeforePal(extractPalette(src, 6));
    setCvdAfterPal(extractPalette({ data: cvdBytes, width, height }, 6));
  }, [mode, cvdType, c.ready]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <Button variant="primary" disabled={!currentImage} onClick={() => c.loadFromUrl(currentImage, t("img.currentName"))}>
              {t("color.useCurrent")}
            </Button>
            <FileButton accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { c.loadFromFile(f); shareFile(f); } }}>
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
                { value: "histogram", label: t("cs.mode.histogram") },
                { value: "cvd", label: t("cs.mode.cvd") },
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

          {mode === "histogram" && (
            <section className="rail-group">
              <h2 className="rail-title">{t("cs.mode.histogram")}</h2>
              <div className="rail-help"><p>{t("cs.hist.help")}</p></div>
            </section>
          )}

          {mode === "cvd" && (
            <section className="rail-group">
              <h2 className="rail-title">{t("cs.cvd.title")}</h2>
              <ChipGroup
                ariaLabel={t("cs.cvd.title")}
                value={cvdType}
                onChange={setCvdType}
                options={CVD_TYPES.map((v) => ({ value: v, label: t(`cs.cvd.${v}`) }))}
              />
              <Button variant="primary" disabled={!c.ready} onClick={() => downloadCanvas(cvdAfterRef, "-" + cvdType)}>{t("cs.download")}</Button>
              <div className="rail-help"><p>{t("cs.cvd.help")}</p></div>
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

          {c.ready && mode === "theme" && (
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
                  <div className="cs-scheme-src">
                    <span className="cs-scheme-src-label">{t("cs.scheme.from")}</span>
                    <ChipGroup
                      ariaLabel={t("cs.scheme.from")}
                      value={schemeSrc}
                      onChange={setSchemeSrc}
                      options={[
                        { value: "before", label: t("cs.before"), disabled: !beforePal.length },
                        { value: "after", label: t("cs.after"), disabled: !afterPal.length },
                      ]}
                    />
                  </div>
                  <p className="cs-scheme-note">{t("cs.scheme.help")}</p>
                  {/* Dos grupos en vez de una marca por fila: los semánticos NO
                      salen de la imagen (son convenciones: verde=éxito, rojo=
                      error…) y hay que decirlo, pero un badge dentro de
                      .cs-scale-name —columna de ancho fijo— desalineaba las
                      filas. El encabezado de grupo lo dice una vez y no toca el
                      layout. */}
                  <div className="cs-scheme-scales">
                    {SCHEME_GROUPS.map(({ key, roles }) => (
                      <div className="cs-scale-group" key={key}>
                        <h4 className="cs-scale-group-title">{t(`cs.scheme.${key}`)}</h4>
                        {roles.map((role) => (
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
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {c.ready && mode === "histogram" && (
            <div className="cs-hist-wrap">
              <canvas ref={histRef} className="cs-hist-canvas" />
              <div className="cs-hist-legend">
                <span><i style={{ background: "#ff5e63" }} />R</span>
                <span><i style={{ background: "#63d68a" }} />G</span>
                <span><i style={{ background: "#5a9bff" }} />B</span>
              </div>
            </div>
          )}

          {c.ready && mode === "cvd" && (
            <div className={`cs-compare ${aspect >= 1 ? "cs-stacked" : "cs-row"}`}>
              <div className="cs-pane">
                <span className="cs-pane-tag">{t("cs.before")}</span>
                <canvas ref={cvdBeforeRef} className="cs-canvas" />
                <MiniPalette colors={cvdBeforePal} onToast={onToast} />
              </div>
              <div className="cs-pane">
                <span className="cs-pane-tag">{t(`cs.cvd.${cvdType}`)}</span>
                <canvas ref={cvdAfterRef} className="cs-canvas" />
                <MiniPalette colors={cvdAfterPal} onToast={onToast} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

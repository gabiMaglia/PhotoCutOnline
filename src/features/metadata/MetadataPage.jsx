import { useEffect, useRef, useState } from "react";
import { t } from "../../lib/i18n.js";
import { orientationLabel, stripToBlob } from "../../lib/metadata.js";
import Button from "../../components/ui/Button.jsx";
import Slider from "../../components/ui/Slider.jsx";
import ChipGroup from "../../components/ui/ChipGroup.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useCutoutContext } from "../cutout/CutoutContext.jsx";
import { useMetadata } from "./hooks/useMetadata.js";
import { useReencode } from "./hooks/useReencode.js";

const fmtBytes = (b) =>
  b == null ? "—" : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

function Row({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="meta-row">
      <span className="meta-key">{label}</span>
      <span className="meta-val">{value}</span>
    </div>
  );
}

// Pestaña "Archivo": todo lo que es el archivo en sí, no la imagen que muestra.
// Inspección (datos del archivo + EXIF: cámara, fecha, GPS…) y transformación
// (convertir/comprimir, copia sin metadatos). Por eso convivir acá y no en una
// 7ª pestaña: es la misma tarea mental y comparten el mismo motor de
// re-codificado (reencodeToBlob). Todo 100% local.
export default function MetadataPage({ active, onToast, onOpenDownload }) {
  const { sharedImageUrl } = useCutoutContext();
  const m = useMetadata({ onToast });
  const r = useReencode({ imgRef: m.imgRef, info: m.info });

  // Auto-carga la imagen compartida (la del navbar «Abrir foto») al entrar a la
  // pestaña o al cambiar de imagen. Sin botón de carga propio: una sola fuente.
  const loadedUrlRef = useRef(null);
  useEffect(() => {
    if (active && sharedImageUrl && sharedImageUrl !== loadedUrlRef.current) {
      loadedUrlRef.current = sharedImageUrl;
      m.loadFromDataUrl(sharedImageUrl, t("img.currentName"));
    }
  }, [active, sharedImageUrl, m.loadFromDataUrl]);

  // Lupa: al pasar el mouse por un thumbnail, magnifica esa zona a resolución
  // completa para ver el detalle de la calidad. El thumbnail original muestrea
  // la imagen original; el resultado, el blob convertido decodificado — así se
  // ve la pérdida real (artefactos JPEG, etc.).
  const convImgRef = useRef(null);
  useEffect(() => {
    if (!r.convertedUrl) { convImgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { convImgRef.current = img; };
    img.src = r.convertedUrl;
  }, [r.convertedUrl]);

  const [loupe, setLoupe] = useState(null); // { which, u, v, x, y }
  const loupeCanvasRef = useRef(null);
  const onThumbMove = (which) => (e) => {
    const img = which === "conv" ? convImgRef.current : m.imgRef.current;
    if (!img) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.max(rect.width / iw, rect.height / ih); // object-fit: cover
    const offX = (iw * scale - rect.width) / 2, offY = (ih * scale - rect.height) / 2;
    const u = Math.min(1, Math.max(0, (e.clientX - rect.left + offX) / scale / iw));
    const v = Math.min(1, Math.max(0, (e.clientY - rect.top + offY) / scale / ih));
    setLoupe({ which, u, v, x: e.clientX, y: e.clientY });
  };
  useEffect(() => {
    const cv = loupeCanvasRef.current;
    if (!cv || !loupe) return;
    const img = loupe.which === "conv" ? convImgRef.current : m.imgRef.current;
    if (!img) return;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const crop = Math.max(18, Math.round(Math.min(iw, ih) * 0.13)); // px de origen mostrados
    const cx = loupe.u * iw, cy = loupe.v * ih;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false; // nearest: se ven los píxeles/artefactos
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, cx - crop / 2, cy - crop / 2, crop, crop, 0, 0, cv.width, cv.height);
  }, [loupe]);

  const strip = async () => {
    const img = m.imgRef.current;
    if (!img) return;
    const blob = await stripToBlob(img, "image/jpeg", 0.92);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (m.info?.name?.replace(/\.[^.]+$/, "") || "imagen") + "-sin-metadatos.jpg";
    a.click();
    URL.revokeObjectURL(a.href);
    onToast?.(t("meta.stripped"));
  };

  const info = m.info;
  const exif = m.exif;
  const gps = exif?.gps;

  return (
    <div className="body" style={active ? undefined : { display: "none" }}>
      <div className="icon-studio">
        <aside className="rail">
          <section className="rail-group">
            <h2 className="rail-title">{t("meta.source")}</h2>
            {info?.name ? (
              <div className="source-tag">{info.name}</div>
            ) : (
              <div className="rail-help"><p>{t("img.openHint")}</p></div>
            )}
          </section>

          {info && (
            <section className="rail-group">
              <h2 className="rail-title">{t("conv.title")}</h2>
              <ChipGroup
                ariaLabel={t("conv.format")}
                value={r.format}
                onChange={r.setFormat}
                options={[
                  { value: "png", label: "PNG" },
                  { value: "jpeg", label: "JPG" },
                  { value: "webp", label: "WebP" },
                ]}
              />
              {/* PNG es sin pérdida: canvas.toBlob IGNORA el parámetro quality.
                  Mostrar el slider ahí sería un control que no hace nada. */}
              {r.showQuality && (
                <Slider
                  id="conv-quality"
                  label={t("conv.quality", { q: r.quality })}
                  min={10}
                  max={100}
                  value={r.quality}
                  onChange={r.setQuality}
                />
              )}

              <div className="conv-dims">
                <label className="conv-dim">
                  <span>{t("conv.width")}</span>
                  <input
                    type="number"
                    min="1"
                    value={r.width ?? ""}
                    onChange={(e) => r.changeWidth(Number(e.target.value) || null)}
                  />
                </label>
                <button
                  type="button"
                  className={`conv-lock ${r.lock ? "is-on" : ""}`}
                  onClick={() => r.setLock(!r.lock)}
                  aria-pressed={r.lock}
                  title={t("conv.lock")}
                >
                  {r.lock ? "🔒" : "🔓"}
                </button>
                <label className="conv-dim">
                  <span>{t("conv.height")}</span>
                  <input
                    type="number"
                    min="1"
                    value={r.height ?? ""}
                    onChange={(e) => r.changeHeight(Number(e.target.value) || null)}
                  />
                </label>
              </div>
              <div className="conv-pcts">
                {[25, 50, 75].map((p) => (
                  <button key={p} type="button" className="conv-pct" onClick={() => r.setPercent(p)}>
                    {p}%
                  </button>
                ))}
                <button type="button" className="conv-pct" onClick={r.resetSize}>
                  {t("conv.original")}
                </button>
              </div>

              {/* Interpolar no agrega detalle: agrandar sólo agranda los píxeles.
                  Decirlo, en vez de dejar creer que hay un upscaler. */}
              {r.upscaling && (
                <div className="rail-help conv-warn">
                  <p>{t("conv.upscaling")}</p>
                </div>
              )}

              <div className="conv-size">
                <span className="conv-size-from">{fmtBytes(info.bytes)}</span>
                <span className="conv-size-arrow" aria-hidden>→</span>
                <span className={`conv-size-to ${r.estimating ? "is-busy" : ""}`}>
                  {r.estimating ? "…" : fmtBytes(r.estimate)}
                </span>
                {!r.estimating && r.estimate != null && info.bytes > 0 && (
                  <span className={`conv-delta ${r.estimate <= info.bytes ? "is-good" : "is-bad"}`}>
                    {r.estimate <= info.bytes
                      ? `−${Math.round((1 - r.estimate / info.bytes) * 100)}%`
                      : `+${Math.round((r.estimate / info.bytes - 1) * 100)}%`}
                  </span>
                )}
              </div>

              {/* JPG no tiene canal alfa: sin avisar, quien convierte un logo
                  transparente se lleva una sorpresa (fondo relleno). */}
              {r.losesAlpha && (
                <div className="rail-help conv-warn">
                  <p>{t("conv.losesAlpha")}</p>
                </div>
              )}

              <Button variant="primary" onClick={r.download} disabled={m.busy}>
                {t("conv.download")}
              </Button>
              <div className="rail-help">
                <p>{t("conv.help")}</p>
              </div>
            </section>
          )}

          {info && (
            <section className="rail-group">
              <h2 className="rail-title">{t("meta.privacyTitle")}</h2>
              <Button onClick={strip} disabled={m.busy}>
                {t("meta.strip")}
              </Button>
              <div className="rail-help">
                <p>{t("meta.privacy")}</p>
              </div>
            </section>
          )}

          {active && <AdSlot placement="meta-rail" onDownload={onOpenDownload} />}
        </aside>

        <main className="icon-preview">
          {!info && (
            <div className="canvas-empty">
              <div className="empty-glyph" aria-hidden>⛭</div>
              <h2>{t("tab.meta")}</h2>
              <p>{t("meta.emptyBody")}</p>
              <p className="canvas-empty-hint">{t("empty.drag")}</p>
            </div>
          )}

          {info && (
            <div className="meta-workspace">
              {/* Thumbnail centrado por encima del recuadro de datos. Cuando la
                  conversión cambia formato o tamaño, aparece un segundo
                  thumbnail (el resultado) con una flecha — ambos centrados. El
                  bloque extra colapsa/expande con transición (single↔double). */}
              {m.previewUrl && (
                <div className="meta-thumb-hero">
                  <div
                    className="meta-thumb meta-thumb-zoom"
                    title={t("conv.loupeHint")}
                    onMouseMove={onThumbMove("orig")}
                    onMouseLeave={() => setLoupe(null)}
                  >
                    <img src={m.previewUrl} alt={t("meta.thumbAlt")} />
                  </div>
                  <div className={`meta-thumb-extra ${r.changed && r.convertedUrl ? "is-on" : ""}`}>
                    <span className="meta-thumb-arrow" aria-hidden>→</span>
                    <div
                      className="meta-thumb meta-thumb-after meta-thumb-zoom"
                      title={t("conv.loupeHint")}
                      onMouseMove={onThumbMove("conv")}
                      onMouseLeave={() => setLoupe(null)}
                    >
                      {r.convertedUrl && <img src={r.convertedUrl} alt={t("conv.previewAfter")} />}
                    </div>
                  </div>
                </div>
              )}

              {loupe && (
                <div
                  className="meta-loupe"
                  style={{ left: loupe.x + 20, top: loupe.y - 80 }}
                  aria-hidden
                >
                  <canvas ref={loupeCanvasRef} width={150} height={150} />
                  <span className="meta-loupe-tag">
                    {loupe.which === "conv" ? t("conv.previewAfter") : t("conv.original")}
                  </span>
                </div>
              )}

              <section className="meta-card">
                <h2>{t("meta.file")}</h2>
                <Row label={t("meta.name")} value={info.name} />
                <Row label={t("meta.type")} value={info.type} />
                <Row label={t("meta.size")} value={info.size} />
                <Row
                  label={t("meta.dimensions")}
                  value={info.width ? `${info.width} × ${info.height} px` : undefined}
                />
                <Row
                  label={t("meta.modified")}
                  value={info.modified ? info.modified.toLocaleString() : undefined}
                />
              </section>

              <section className="meta-card">
                <h2>{t("meta.exif")}</h2>
                {!exif && <p className="meta-empty-note">{t("meta.noExif")}</p>}
                {exif && (
                  <>
                    <Row label={t("meta.make")} value={exif.make} />
                    <Row label={t("meta.model")} value={exif.model} />
                    <Row label={t("meta.date")} value={exif.dateTime} />
                    <Row label={t("meta.orientation")} value={orientationLabel(exif.orientation)} />
                    <Row label={t("meta.software")} value={exif.software} />
                    {gps && (
                      <div className="meta-gps">
                        <p className="meta-gps-warn">{t("meta.gpsWarn")}</p>
                        <Row label="GPS" value={`${gps.lat}, ${gps.lng}`} />
                        <a
                          className="meta-map-link"
                          href={`https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lng}#map=15/${gps.lat}/${gps.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("meta.viewMap")} →
                        </a>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

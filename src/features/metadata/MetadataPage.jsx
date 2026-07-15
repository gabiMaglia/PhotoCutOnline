import { t } from "../../lib/i18n.js";
import { orientationLabel, stripToBlob } from "../../lib/metadata.js";
import Button from "../../components/ui/Button.jsx";
import FileButton from "../../components/ui/FileButton.jsx";
import AdSlot from "../promo/AdSlot.jsx";
import { useMetadata } from "./hooks/useMetadata.js";

function Row({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="meta-row">
      <span className="meta-key">{label}</span>
      <span className="meta-val">{value}</span>
    </div>
  );
}

// Visor de metadatos: muestra datos del archivo y EXIF (cámara, fecha, GPS…) y
// permite descargar una copia sin metadatos. Análisis 100% local.
export default function MetadataPage({ active, onToast, onOpenDownload }) {
  const m = useMetadata({ onToast });

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
            <FileButton
              variant="primary"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && m.load(e.target.files[0])}
            >
              {t("meta.openImage")}
            </FileButton>
            {info?.name && <div className="source-tag">{info.name}</div>}
          </section>

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
            </div>
          )}

          {info && (
            <div className="meta-workspace">
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

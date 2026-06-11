import { useState, useEffect, useRef, useCallback } from "react";
import { PLATFORMS, renderIcon, buildIconZip } from "../lib/icons.js";
import { loadHtmlImage } from "../lib/jsEngine.js";
import { t } from "../lib/i18n.js";

// Icon Studio: convierte cualquier PNG (idealmente el recorte transparente)
// en sets de iconos completos para iOS, Android, macOS, Windows y Web/PWA.

const PREVIEW_SIZES = [128, 64, 48, 32, 16];

export default function IconStudio({ getCutout, hasCut, onToast }) {
  const [source, setSource] = useState(null); // HTMLImageElement | canvas
  const [sourceName, setSourceName] = useState(null);
  const [padding, setPadding] = useState(8);
  const [bgOn, setBgOn] = useState(false);
  const [bgColor, setBgColor] = useState("#111317");
  const [appName, setAppName] = useState("Mi App");
  const [selected, setSelected] = useState(() => new Set(PLATFORMS.map((p) => p.id)));
  const [building, setBuilding] = useState(false);
  const heroRef = useRef(null);

  const renderOpts = {
    padding: padding / 100,
    bg: bgOn ? bgColor : null,
  };

  // Preview grande
  useEffect(() => {
    if (!source || !heroRef.current) return;
    const c = heroRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(renderIcon(source, 256, renderOpts), 0, 0);
  }, [source, padding, bgOn, bgColor]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFromFile = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      setSource(img);
      setSourceName(file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  async function useCurrentCutout() {
    try {
      const dataUrl = await getCutout();
      const img = await loadHtmlImage(dataUrl);
      setSource(img);
      setSourceName(t("icon.currentTag"));
    } catch (e) {
      onToast(t("toast.cutfail", { e }), "error");
    }
  }

  function togglePlatform(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadZip() {
    if (!source || selected.size === 0) return;
    setBuilding(true);
    try {
      const blob = await buildIconZip(source, {
        ...renderOpts,
        platforms: selected,
        appName,
      });
      const total = PLATFORMS.filter((p) => selected.has(p.id)).reduce(
        (n, p) => n + p.count,
        0
      );
      downloadBlob(blob, "app-icons.zip");
      onToast(t("toast.zip", { n: total, p: selected.size }), "ok");
    } catch (e) {
      onToast(t("toast.iconsfail", { e }), "error");
    } finally {
      setBuilding(false);
    }
  }

  function downloadPython() {
    const a = document.createElement("a");
    a.href = "make_icons.py";
    a.download = "make_icons.py";
    document.body.appendChild(a);
    a.click();
    a.remove();
    onToast(t("toast.py"), "ok");
  }

  return (
    <div className="icon-studio">
      <aside className="rail">
        <section className="rail-group">
          <h2 className="rail-title">{t("icon.source")}</h2>
          <button className="btn btn-primary" disabled={!hasCut} onClick={useCurrentCutout}>
            {t("icon.useCurrent")}
          </button>
          <label className="btn">
            {t("icon.openPng")}
            <input
              type="file"
              accept="image/png,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && loadFromFile(e.target.files[0])}
            />
          </label>
          {sourceName && <div className="source-tag">{sourceName}</div>}
        </section>

        <section className="rail-group">
          <h2 className="rail-title">{t("icon.settings")}</h2>
          <div className="slider">
            <label htmlFor="icon-pad">{t("icon.margin", { n: padding })}</label>
            <input
              id="icon-pad"
              type="range"
              min="0"
              max="30"
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
            />
          </div>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={bgOn} onChange={(e) => setBgOn(e.target.checked)} />
              {t("icon.bg")}
            </label>
            <input
              type="color"
              value={bgColor}
              disabled={!bgOn}
              onChange={(e) => setBgColor(e.target.value)}
              aria-label={t("icon.bgAria")}
            />
          </div>
          <div className="field">
            <label htmlFor="app-name">{t("icon.appName")}</label>
            <input
              id="app-name"
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Mi App"
            />
          </div>
        </section>

        <section className="rail-group">
          <h2 className="rail-title">{t("icon.platforms")}</h2>
          {PLATFORMS.map((p) => (
            <label key={p.id} className={`platform ${selected.has(p.id) ? "platform-on" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => togglePlatform(p.id)}
              />
              <span className="platform-name">{p.name}</span>
              <span className="platform-detail">{p.detail}</span>
            </label>
          ))}
        </section>

        <section className="rail-group">
          <h2 className="rail-title">{t("icon.generate")}</h2>
          <button
            className="btn btn-primary"
            disabled={!source || selected.size === 0 || building}
            onClick={downloadZip}
          >
            {building ? t("icon.building") : t("icon.zipBtn")}
          </button>
          <button className="btn" onClick={downloadPython}>
            {t("icon.pyBtn")}
          </button>
          <div className="rail-help">
            <p>
              {t("icon.py1")} <code>make_icons.py</code> {t("icon.py2")}{" "}
              <code>python make_icons.py logo.png</code>. {t("icon.py3")}
            </p>
          </div>
        </section>
      </aside>

      <main className="icon-preview">
        {!source && (
          <div className="canvas-empty">
            <div className="empty-glyph" aria-hidden>▣</div>
            <h2>Icon Studio</h2>
            <p>{t("icon.emptyBody")}</p>
          </div>
        )}
        {source && (
          <div className="icon-grid">
            <div className="icon-hero">
              <div className="checker" />
              <canvas ref={heroRef} width={256} height={256} />
            </div>
            <div className="icon-row">
              {PREVIEW_SIZES.map((s) => (
                <SizePreview key={s} source={source} size={s} opts={renderOpts} />
              ))}
            </div>
            <p className="icon-note">{t("icon.note")}</p>
          </div>
        )}
      </main>
    </div>
  );
}

function SizePreview({ source, size, opts }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(renderIcon(source, size, opts), 0, 0);
  }, [source, size, opts.padding, opts.bg]); // eslint-disable-line react-hooks/exhaustive-deps
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

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

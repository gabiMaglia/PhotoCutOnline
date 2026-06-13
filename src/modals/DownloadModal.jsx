import { useState, useEffect } from "react";
import { t } from "../lib/i18n.js";

// "Descargar app": consulta la última release de GitHub y ofrece el
// instalador correcto (Windows x64, macOS Apple Silicon, macOS Intel),
// destacando el detectado para el equipo del usuario.

// repo de las releases de escritorio; override por build con VITE_GH_REPO
const REPO = import.meta.env.VITE_GH_REPO || "gabiMaglia/PhotoCutOnline";
const RELEASES_URL = `https://github.com/${REPO}/releases`;

function matchAssets(assets) {
  const find = (pred) => assets.find((a) => pred(a.name.toLowerCase()));
  return {
    win: find((n) => n.endsWith("-setup.exe") || n.endsWith(".msi")),
    macArm: find((n) => n.endsWith(".dmg") && n.includes("aarch64")),
    macIntel: find((n) => n.endsWith(".dmg") && (n.includes("x64") || n.includes("x86_64"))),
  };
}

async function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "win";
  if (/Mac/i.test(ua)) {
    try {
      const hints = await navigator.userAgentData?.getHighEntropyValues?.(["architecture"]);
      if (hints?.architecture === "x86") return "macIntel";
    } catch {
      /* sin hints */
    }
    return "macArm"; // por defecto: los Mac modernos son Apple Silicon
  }
  return null;
}

export default function DownloadModal({ onClose }) {
  const [assets, setAssets] = useState(null); // null=cargando, {}=sin release
  const [version, setVersion] = useState(null);
  const [mine, setMine] = useState(null);

  useEffect(() => {
    detectPlatform().then(setMine);
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rel) => {
        setVersion(rel.tag_name);
        setAssets(matchAssets(rel.assets || []));
      })
      .catch(() => setAssets({}));
  }, []);

  const items = [
    { id: "win", label: t("dl.win"), asset: assets?.win },
    { id: "macArm", label: t("dl.macArm"), asset: assets?.macArm },
    { id: "macIntel", label: t("dl.macIntel"), asset: assets?.macIntel },
  ];
  const anyAsset = items.some((i) => i.asset);

  return (
    <div
      className="modal-veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dl-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-download">
        <h3 id="dl-title">
          {t("dl.title")}
          {version && <span className="about-version">{version}</span>}
        </h3>
        <p>{t("dl.body")}</p>

        {assets === null && <p className="dl-status">{t("dl.loading")}</p>}
        {assets !== null && !anyAsset && <p className="dl-status">{t("dl.none")}</p>}

        {anyAsset && (
          <div className="dl-list">
            {items.map(
              ({ id, label, asset }) =>
                asset && (
                  <a
                    key={id}
                    className={`btn dl-item ${mine === id ? "btn-primary" : ""}`}
                    href={asset.browser_download_url}
                  >
                    <span>
                      {label}
                      {mine === id && <em className="dl-mine"> · {t("dl.recommended")}</em>}
                    </span>
                    <span className="dl-size">{(asset.size / 1e6).toFixed(1)} MB</span>
                  </a>
                )
            )}
          </div>
        )}

        <a className="dl-all" href={RELEASES_URL} target="_blank" rel="noreferrer">
          {t("dl.all")} ↗
        </a>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

import { getLang, t } from "../lib/i18n.js";

// el peso depende del camino (GROW-36: ~115 MB con GPU, 4,6 MB sin): se muestra el real
function formatMb(bytes) {
  const mb = bytes / 1e6;
  return mb >= 10 ? String(Math.round(mb)) : mb.toLocaleString(getLang(), { maximumFractionDigits: 1 });
}

/** Texto de estado de la descarga/arranque del modelo IA. */
export function formatAiProgress(p) {
  if (p?.stage === "init") return t("ai.stage.init");
  if (p?.stage === "model" && p.total > 0) {
    // 99% como techo: llegar a 100 no significa "listo" (falta iniciar la sesión)
    const pct = Math.min(99, Math.floor((p.loaded / p.total) * 100));
    return t("ai.stage.model", { pct, mb: formatMb(p.total) });
  }
  return t("ai.stage.modelIndet");
}

/**
 * onProgress para las operaciones de IA (corte, quitar fondo): si el modelo
 * preciso no pudo correr y se pasó al liviano (GROW-36), lo dice. El módulo de
 * IA emite el aviso una sola vez por sesión.
 */
export function aiNoticeHandler(toast) {
  return (p) => {
    if (p?.stage === "fallback") toast(t("toast.aiFallback"), "ok");
  };
}

/**
 * Corre `warmup(onProgress)` mostrando un toast fijo con el avance real y
 * retirándolo al terminar (ok o error).
 */
export async function warmupAiWithToast(toast, warmup) {
  const id = toast(t("toast.aiDownloading"), "ok", { sticky: true });
  const notice = aiNoticeHandler(toast);
  try {
    await warmup((p) => {
      if (p?.stage === "fallback") notice(p);
      else toast.update?.(id, formatAiProgress(p));
    });
  } finally {
    toast.dismiss?.(id);
  }
}

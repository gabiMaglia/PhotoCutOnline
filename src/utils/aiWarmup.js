import { t } from "../lib/i18n.js";

/** Texto de estado de la descarga/arranque del modelo IA. */
export function formatAiProgress(p) {
  if (p?.stage === "init") return t("ai.stage.init");
  if (p?.stage === "model" && p.total > 0) {
    // 99% como techo: llegar a 100 no significa "listo" (falta iniciar la sesión)
    const pct = Math.min(99, Math.floor((p.loaded / p.total) * 100));
    return t("ai.stage.model", { pct });
  }
  return t("ai.stage.modelIndet");
}

/**
 * Corre `warmup(onProgress)` mostrando un toast fijo con el avance real y
 * retirándolo al terminar (ok o error).
 */
export async function warmupAiWithToast(toast, warmup) {
  const id = toast(t("toast.aiDownloading"), "ok", { sticky: true });
  try {
    await warmup((p) => toast.update?.(id, formatAiProgress(p)));
  } finally {
    toast.dismiss?.(id);
  }
}

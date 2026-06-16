import { backend } from "../lib/backend.js";

// Abre una URL externa. En navegador, un <a target="_blank"> alcanza, pero en
// el webview de Tauri la navegación externa queda bloqueada: hay que delegar al
// navegador del sistema vía el plugin opener. Usar en onClick de los links que
// salen de la app (donaciones, descargas, etc.).
export async function openExternal(url) {
  if (!url) return;
  if (backend.isDesktop) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* si el plugin falla, caemos al window.open de abajo */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

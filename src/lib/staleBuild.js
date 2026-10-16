// «Esta pestaña quedó con una versión vieja» (BUG-08).
//
// Tras un deploy, el servidor ya no tiene los archivos hasheados del build
// anterior. Si una pestaña vieja pide uno (el worker de recorte, un chunk
// perezoso), lo único útil para el usuario es recargar. Acá se reconoce ese
// caso y se avisa; la UI decide cómo mostrarlo (StaleBuildNotice). Nunca se
// recarga solo: el usuario puede tener una foto a medio editar.

import { t } from "./i18n.js";

export const WORKER_LOAD_FAILED = "WORKER_LOAD_FAILED";
export const STALE_BUILD_EVENT = "photocut:stale-build";

// Texto del import() fallido según el motor: Chrome, Firefox, Safari/WebKit.
// Anclado al inicio: un error de dominio que lo envuelve (p.ej.
// «WEBP_ENCODE_FAILED: load: …», GROW-35) ya tiene su propio manejo.
const CHUNK_LOAD =
  /^(?:TypeError: )?(?:Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed)/i;

export function isChunkLoadError(message) {
  return CHUNK_LOAD.test(String(message ?? ""));
}

export function workerLoadError(cause) {
  const err = new Error(`${WORKER_LOAD_FAILED}: ${cause ?? "el worker no cargó"}`);
  err.code = WORKER_LOAD_FAILED;
  return err;
}

export function isStaleBuildError(e) {
  return e?.code === WORKER_LOAD_FAILED;
}

export function reportStaleBuild() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STALE_BUILD_EVENT));
}

/** Texto para un toast de error: el aviso traducido si es de versión, el error tal cual si no. */
export function errorText(e) {
  return isStaleBuildError(e) ? t("update.body") : String(e);
}

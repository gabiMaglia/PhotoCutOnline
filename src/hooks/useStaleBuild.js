import { useEffect, useState } from "react";
import { STALE_BUILD_EVENT } from "../lib/staleBuild.js";

// true en cuanto la pestaña detecta que su versión quedó vieja: el worker no
// cargó (backend.js) o un import() dinámico falló (Vite emite
// `vite:preloadError`, ver «Load Error Handling» en la doc de Vite). No se
// llama preventDefault: el error sigue su curso y el aviso se suma.
export function useStaleBuild() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const on = () => setStale(true);
    window.addEventListener(STALE_BUILD_EVENT, on);
    window.addEventListener("vite:preloadError", on);
    return () => {
      window.removeEventListener(STALE_BUILD_EVENT, on);
      window.removeEventListener("vite:preloadError", on);
    };
  }, []);
  return stale;
}

import { createContext, useContext } from "react";
import { useCutout } from "./useCutout.js";

// Comparte la sesión de recorte entre la página de recorte (que la maneja) e
// Icon Studio (que solo necesita saber si hay un recorte y obtenerlo).
const CutoutContext = createContext(null);

export function CutoutProvider({ toast, onImageLoad, children }) {
  const value = useCutout({ toast, onImageLoad });
  return <CutoutContext.Provider value={value}>{children}</CutoutContext.Provider>;
}

export function useCutoutContext() {
  const ctx = useContext(CutoutContext);
  if (!ctx) throw new Error("useCutoutContext debe usarse dentro de <CutoutProvider>");
  return ctx;
}

import { useEffect, useState } from "react";

/**
 * Para una tira con scroll horizontal: indica si hay contenido oculto a la
 * izquierda / derecha. Sirve para mostrar un fade como pista de "hay más".
 * `el` es el elemento (no un ref) para que el efecto se re-enganche al montar.
 */
export function computeEdges({ scrollLeft, clientWidth, scrollWidth }) {
  // 1px de tolerancia: scrollLeft puede ser fraccional en pantallas escaladas
  return { left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 };
}

export function useScrollEdges(el) {
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    if (!el) return undefined;
    const update = () => {
      const next = computeEdges(el);
      setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // las pestañas cambian de ancho al traducirse (cambio de idioma)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [el]);

  return edges;
}

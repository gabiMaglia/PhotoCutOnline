import { useEffect, useRef } from "react";
import { paintFiltered } from "./filterOps.js";

// Repinta la vista previa de Filtros como mucho una vez por frame: arrastrar
// un slider dispara decenas de cambios por segundo y solo importa el último.
export function useFilterPreview(canvasRef, base, ops, onError) {
  const latest = useRef({ base, ops });
  latest.current = { base, ops };
  const frame = useRef(0);

  useEffect(() => {
    if (!base || frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const cv = canvasRef.current;
      if (!cv || !latest.current.base) return;
      try {
        paintFiltered(cv, latest.current.base, latest.current.ops);
      } catch (e) {
        onError?.(e);
      }
    });
  }, [canvasRef, base, ops, onError]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    []
  );
}

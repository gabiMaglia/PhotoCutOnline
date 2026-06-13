import { useState, useRef, useCallback } from "react";
import { backend } from "../../../lib/backend.js";
import { t } from "../../../lib/i18n.js";
import { clampNum } from "../../../utils/math.js";
import { pointInRect } from "../../../utils/dom.js";

// Panel de vista previa flotante: abrir/cerrar, fondo de preview, mover (por la
// cabecera), redimensionar (esquina) y arrastrar el recorte al lienzo para
// recargarlo como nueva imagen de trabajo.
export function usePreviewPanel({ workspaceRef, loadDataUrl, toast }) {
  const [open, setOpen] = useState(false);
  const [bg, setBg] = useState("checker"); // checker | white | black | color
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState({ w: 220, h: 240 });
  const [pos, setPos] = useState(null); // null = anclado por CSS
  const [cutGhost, setCutGhost] = useState(null);

  const panelRef = useRef(null);
  const resizeRef = useRef(null);
  const dragRef = useRef(null);
  const cutDragRef = useRef(null);

  // ---- redimensionar (esquina inferior izquierda) ----
  const resizeDown = useCallback(
    (e) => {
      e.preventDefault();
      resizeRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        w0: size.w,
        h0: size.h,
        x0: pos?.x ?? null,
        y0: pos?.y ?? null,
      };
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        /* pointers sintéticos */
      }
    },
    [size, pos]
  );

  const resizeMove = useCallback((e) => {
    const r = resizeRef.current;
    if (!r) return;
    const w = clampNum(r.w0 + (r.sx - e.clientX), 180, window.innerWidth * 0.7);
    setSize({ w, h: clampNum(r.h0 + (e.clientY - r.sy), 170, window.innerHeight * 0.75) });
    // si el panel fue arrastrado, el borde derecho queda quieto al crecer
    if (r.x0 != null) setPos({ x: r.x0 - (w - r.w0), y: r.y0 });
  }, []);

  const resizeUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // ---- mover (por la cabecera) ----
  const dragDown = useCallback((e) => {
    if (e.target.closest("button, input")) return; // chips y cerrar siguen vivos
    e.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointers sintéticos */
    }
  }, []);

  const dragMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    setPos({
      x: clampNum(e.clientX - d.dx, 8, window.innerWidth - 80),
      y: clampNum(e.clientY - d.dy, 8, window.innerHeight - 60),
    });
  }, []);

  const dragUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ---- arrastrar el recorte y soltarlo en el lienzo ----
  const cutDown = useCallback((e) => {
    e.preventDefault();
    cutDragRef.current = { sx: e.clientX, sy: e.clientY };
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointers sintéticos */
    }
    setCutGhost({ x: e.clientX, y: e.clientY });
  }, []);

  const cutMove = useCallback((e) => {
    if (cutDragRef.current) setCutGhost({ x: e.clientX, y: e.clientY });
  }, []);

  const cutCancel = useCallback(() => {
    cutDragRef.current = null;
    setCutGhost(null);
  }, []);

  const cutUp = useCallback(
    async (e) => {
      const d = cutDragRef.current;
      cutCancel();
      if (!d) return;
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 24;
      const ws = workspaceRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!moved || !pointInRect(ws, e.clientX, e.clientY) || pointInRect(panel, e.clientX, e.clientY)) {
        return;
      }
      try {
        const url = await backend.exportTransparent({ format: "png" });
        await loadDataUrl(url, t("toast.cutLoaded"));
      } catch (err) {
        toast(String(err), "error");
      }
    },
    [workspaceRef, loadDataUrl, toast, cutCancel]
  );

  return {
    open,
    setOpen,
    bg,
    setBg,
    color,
    setColor,
    size,
    pos,
    cutGhost,
    panelRef,
    handlers: {
      resizeDown,
      resizeMove,
      resizeUp,
      dragDown,
      dragMove,
      dragUp,
      cutDown,
      cutMove,
      cutUp,
      cutCancel,
    },
  };
}

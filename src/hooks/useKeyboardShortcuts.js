import { useEffect } from "react";

// Atajos globales de teclado. Recibe un objeto de callbacks; las teclas que no
// tengan handler se ignoran. No dispara cuando el foco está en un input/textarea.
export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    function onKey(e) {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handlers.redo?.();
        else handlers.undo?.();
        return;
      }
      if (e.key === "Escape") {
        handlers.escape?.();
        return;
      }
      if (e.key === "?") {
        handlers.help?.();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const map = {
        1: handlers.modeRect,
        2: handlers.modeKeep,
        3: handlers.modeRemove,
        a: handlers.auto,
        A: handlers.auto,
        i: handlers.ai,
        I: handlers.ai,
        "[": handlers.brushDown,
        "]": handlers.brushUp,
        e: handlers.exportNow,
        E: handlers.exportNow,
        p: handlers.preview,
        P: handlers.preview,
        c: handlers.compare,
        C: handlers.compare,
      };
      map[e.key]?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}

import { useState, useRef, useCallback } from "react";

// Notificaciones efímeras: cada toast se autodescarta a los 3.4 s.
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((text, kind = "ok") => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3400);
  }, []);

  return { toasts, toast };
}

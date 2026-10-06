import { useState, useRef, useCallback } from "react";

// Notificaciones efímeras: cada toast se autodescarta a los 3.4 s.
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  // devuelve el id para poder retirar un aviso de progreso con toast.dismiss(id)
  // apenas termina la tarea (sin esperar a los 3.4 s ni pisar el resultado)
  const toast = useCallback(
    (text, kind = "ok") => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, text, kind }]);
      setTimeout(() => dismiss(id), 3400);
      return id;
    },
    [dismiss]
  );
  toast.dismiss = dismiss;

  return { toasts, toast };
}

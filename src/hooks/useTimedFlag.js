import { useState, useRef, useCallback, useEffect } from "react";

// Bandera efímera para avisos que se van solos: `trigger()` la enciende y
// reinicia el plazo (un aviso repetido no se corta a mitad), `clear()` la
// apaga ya. El timer no sobrevive al componente.
export function useTimedFlag(ms) {
  const [on, setOn] = useState(false);
  const timer = useRef(0);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setOn(false);
  }, []);

  const trigger = useCallback(() => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [on, trigger, clear];
}

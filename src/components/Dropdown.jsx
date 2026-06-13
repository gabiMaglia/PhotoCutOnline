import { useState, useRef, useEffect, useCallback } from "react";

// Dropdown propio en el estilo "darkroom ácido": reemplaza al <select> nativo
// (que rendea el chrome del SO y desentona). Accesible: roles listbox/option,
// teclado completo (↑↓ Home End, Enter/Espacio, Escape) y cierre al clic fuera.
//
// options: [{ value, label }]   value/onChange controlados desde el padre.

export default function Dropdown({ options, value, onChange, id, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // índice resaltado por teclado
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIdx] || options[0];

  const close = useCallback(() => setOpen(false), []);

  // clic fuera cierra
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e) {
      if (!rootRef.current?.contains(e.target)) close();
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open, close]);

  // al abrir, arrancar el foco en la opción seleccionada
  useEffect(() => {
    if (open) setActive(selectedIdx);
  }, [open, selectedIdx]);

  // mantener visible la opción activa
  useEffect(() => {
    if (!open || !menuRef.current) return;
    menuRef.current.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function pick(idx) {
    onChange(options[idx].value);
    close();
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
      default:
    }
  }

  return (
    <div className="dd" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`dd-trigger ${open ? "dd-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="dd-value">{current?.label}</span>
        <span className="dd-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <ul className="dd-menu" role="listbox" ref={menuRef} tabIndex={-1}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dd-option ${o.value === value ? "dd-selected" : ""} ${
                i === active ? "dd-active" : ""
              }`}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

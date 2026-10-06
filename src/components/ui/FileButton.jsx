// Botón que abre el selector de archivos (un <label> con un <input file>
// oculto), con la misma apariencia que Button. Para imágenes por defecto.
// El input NO usa `hidden` (display:none lo saca del orden de Tab): se oculta
// visualmente con .file-input-sr y el label muestra el foco vía :focus-within.
export default function FileButton({
  accept = "image/*",
  onChange,
  disabled = false,
  variant,
  size,
  multiple = false,
  className = "",
  children,
}) {
  const classes = [
    "btn",
    variant === "primary" && "btn-primary",
    size === "small" && "btn-small",
    disabled && "btn-disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <label className={classes}>
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="file-input-sr"
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

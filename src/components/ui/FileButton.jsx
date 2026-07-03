// Botón que abre el selector de archivos (un <label> con un <input file>
// oculto), con la misma apariencia que Button. Para imágenes por defecto.
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
        hidden
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

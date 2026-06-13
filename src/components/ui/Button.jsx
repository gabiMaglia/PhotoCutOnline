// Botón base del design system. variant mapea a las clases .btn-* y size a
// .btn-small. `kbd` muestra el atajo de teclado a la derecha.
const VARIANT_CLASS = {
  primary: "btn-primary",
  ai: "btn-ai",
  auto: "btn-auto",
  donate: "btn-donate",
};

export default function Button({
  variant,
  size,
  kbd,
  active,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    "btn",
    variant && VARIANT_CLASS[variant],
    size === "small" && "btn-small",
    active && "btn-primary",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...rest}>
      {children}
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );
}

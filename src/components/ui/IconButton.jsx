// Botón de ícono compacto (.btn-icon). Puede renderizar un <a> (href) o un
// <button>. `label` se usa como aria-label y title.
export default function IconButton({ label, href, className = "", children, ...rest }) {
  const classes = ["btn-icon", className].filter(Boolean).join(" ");
  if (href) {
    return (
      <a
        className={classes}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <button className={classes} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

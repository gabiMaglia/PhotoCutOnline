// Diálogo modal con velo. Cierra al clic en el velo (si onClose) y expone un
// área de acciones al pie. `labelledBy` debe apuntar al id del título.
export default function Modal({ labelledBy, onClose, className = "", children, actions }) {
  return (
    <div
      className="modal-veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => onClose && e.target === e.currentTarget && onClose()}
    >
      <div className={`modal ${className}`}>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

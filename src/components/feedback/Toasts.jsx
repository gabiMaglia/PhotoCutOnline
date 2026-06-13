// Pila de notificaciones efímeras (aria-live). El estado vive en useToasts.
export default function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}

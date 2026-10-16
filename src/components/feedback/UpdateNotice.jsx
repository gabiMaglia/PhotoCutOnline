import Button from "../ui/Button.jsx";

// Aviso fijo con una acción (p.ej. «hay una versión nueva → Recargar»). Va por
// encima de todo, incluida la pantalla de error, porque suele ser la salida.
export default function UpdateNotice({ message, actionLabel, onAction }) {
  return (
    <div className="update-notice" role="alert">
      <span>{message}</span>
      <Button variant="primary" size="small" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

// Campo etiquetado (.field): una etiqueta encima del control hijo.
export default function Field({ id, label, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

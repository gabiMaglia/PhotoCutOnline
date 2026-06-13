// Checkbox con etiqueta (.check). `onChange` recibe el booleano directamente.
export default function Checkbox({ checked, onChange, disabled = false, children }) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

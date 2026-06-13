// Grupo de chips de única opción (role=radiogroup). options: [{value,label,
// disabled?}]. Reemplaza los .format-row repetidos a mano por toda la app.
export default function ChipGroup({ ariaLabel, value, onChange, options }) {
  return (
    <div className="format-row" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`chip ${value === o.value ? "chip-on" : ""}`}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

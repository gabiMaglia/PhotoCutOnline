// Slider con etiqueta (rango). `off` lo atenúa y desactiva (clase .slider-off);
// `hint` permite añadir teclas/atajos junto a la etiqueta.
export default function Slider({
  id,
  label,
  hint,
  min,
  max,
  value,
  onChange,
  disabled = false,
  off = false,
}) {
  return (
    <div className={`slider ${off ? "slider-off" : ""}`}>
      <label htmlFor={id}>
        {label} {hint}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

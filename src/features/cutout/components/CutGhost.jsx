// Fantasma del recorte que sigue al cursor mientras se arrastra al lienzo.
export default function CutGhost({ pos, src }) {
  if (!pos || !src) return null;
  return (
    <img
      className="cut-ghost"
      src={src}
      style={{ left: pos.x, top: pos.y }}
      alt=""
      aria-hidden
    />
  );
}

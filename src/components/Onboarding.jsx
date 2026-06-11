// Onboarding de primera visita: 3 pasos, una sola pantalla, sin fricción.
// Se muestra una vez (localStorage "pc-onboarded").

const STEPS = [
  {
    n: "1",
    title: "Abre una foto",
    body: "Arrastra un archivo, pega con ⌘V o toca «Abrir foto».",
  },
  {
    n: "2",
    title: "Marca el sujeto",
    body: "Dibuja un recuadro alrededor — o usa el recorte automático (A).",
  },
  {
    n: "3",
    title: "Afina y exporta",
    body: "Pinceles mantener/quitar para los bordes. Exporta PNG transparente o crea iconos de app.",
  },
];

export default function Onboarding({ onDismiss }) {
  return (
    <div
      className="modal-veil onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-card">
        <div className="brand" aria-hidden>
          <span className="brand-mark">◑</span>
          <span className="brand-name">PhotoCut</span>
          <span className="brand-sub">Studio</span>
        </div>
        <h2 id="onboarding-title">Quita el fondo en tres pasos</h2>
        <p className="onboarding-privacy">
          Todo ocurre en tu navegador — tus fotos nunca se suben a ningún servidor.
        </p>
        <ol className="onboarding-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="step-n" aria-hidden>{s.n}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button className="btn btn-primary onboarding-go" autoFocus onClick={onDismiss}>
          ¡A recortar!
        </button>
      </div>
    </div>
  );
}

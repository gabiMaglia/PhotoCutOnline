import { Component } from "react";

// Pantalla de recuperación: cualquier throw en render muestra esto en vez de
// una pantalla blanca. "Reiniciar" recarga la app (estado limpio); el detalle
// técnico queda plegado para reportes. Punto de enganche futuro para
// telemetría (Sentry) en componentDidCatch.

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
    else window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <span className="brand-mark" aria-hidden>◑</span>
          <h2>Algo salió mal</h2>
          <p>
            La aplicación encontró un error inesperado. Tu imagen no se ha
            enviado a ningún sitio — todo ocurre en tu navegador.
          </p>
          <button className="btn btn-primary" autoFocus onClick={this.handleReset}>
            Reiniciar
          </button>
          <details className="crash-detail">
            <summary>Detalle técnico</summary>
            <pre>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}

import { Component } from "react";
import { reportError } from "../lib/telemetry.js";
import { t } from "../lib/i18n.js";

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
    reportError(error, { componentStack: info?.componentStack });
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
          <h2>{t("crash.title")}</h2>
          <p>{t("crash.body")}</p>
          <button className="btn btn-primary" autoFocus onClick={this.handleReset}>
            {t("crash.reset")}
          </button>
          <details className="crash-detail">
            <summary>{t("crash.detail")}</summary>
            <pre>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}

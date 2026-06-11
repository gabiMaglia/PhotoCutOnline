// Telemetría de errores, opt-in y mínima.
//
// Sin SDK (cero peso extra): si VITE_SENTRY_DSN está definido en el build,
// los errores se envían al endpoint store de Sentry con un payload plano.
// Sin DSN, todo es no-op. Privacidad: solo mensaje/stack/UA — JAMÁS imágenes
// ni datos del usuario (es el selling point del producto).
//
//   VITE_SENTRY_DSN="https://<key>@<host>/<project>" npm run build

const DSN = import.meta.env.VITE_SENTRY_DSN || "";

function parseDsn(dsn) {
  const m = dsn.match(/^(https?):\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/);
  if (!m) return null;
  const [, proto, key, host, project] = m;
  return `${proto}://${host}/api/${project}/store/?sentry_version=7&sentry_key=${key}`;
}

const ENDPOINT = DSN ? parseDsn(DSN) : null;
let sent = 0;

export function reportError(error, context = {}) {
  if (!ENDPOINT || sent >= 10) return; // cap por sesión, no spamear
  sent++;
  const payload = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    release: `photocut-studio@${import.meta.env.VITE_APP_VERSION || "dev"}`,
    exception: {
      values: [
        {
          type: error?.name || "Error",
          value: String(error?.message || error),
        },
      ],
    },
    extra: {
      stack: String(error?.stack || ""),
      ...context,
    },
    request: { headers: { "User-Agent": navigator.userAgent } },
  };
  try {
    fetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetría jamás debe romper la app */
  }
}

export function initTelemetry() {
  if (!ENDPOINT) return false;
  window.addEventListener("error", (e) => reportError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) =>
    reportError(e.reason, { unhandledRejection: true })
  );
  return true;
}

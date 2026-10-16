import UpdateNotice from "../../components/feedback/UpdateNotice.jsx";
import { useStaleBuild } from "../../hooks/useStaleBuild.js";
import { t, useLang } from "../../lib/i18n.js";

const reloadPage = () => window.location.reload();

// BUG-08: cuando la pestaña quedó con una versión vieja, pedir recargar en vez
// de mostrar «worker error». La recarga es solo a pedido (puede haber trabajo
// sin guardar). Se monta fuera del ErrorBoundary para seguir visible si un
// chunk perezoso que no cargó tiró la app.
export default function StaleBuildNotice({ onReload = reloadPage }) {
  useLang(); // re-render al cambiar idioma
  const stale = useStaleBuild();
  if (!stale) return null;
  return <UpdateNotice message={t("update.body")} actionLabel={t("update.reload")} onAction={onReload} />;
}

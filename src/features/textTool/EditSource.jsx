import { t } from "../../lib/i18n.js";
import ChipGroup from "../../components/ui/ChipGroup.jsx";

// Selector de fuente del hub "Editar": partir de la imagen original o del
// sujeto recortado (PNG transparente del recorte). Sólo aparece si hay recorte.
export default function EditSource({ mode, onChange, hasCut }) {
  if (!hasCut) return null;
  return (
    <section className="rail-group">
      <ChipGroup
        ariaLabel={t("edit.source")}
        value={mode}
        onChange={onChange}
        options={[
          { value: "original", label: t("edit.srcOriginal") },
          { value: "cutout", label: t("edit.srcCutout") },
        ]}
      />
    </section>
  );
}

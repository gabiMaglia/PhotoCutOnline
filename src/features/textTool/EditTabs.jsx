import { t } from "../../lib/i18n.js";
import ChipGroup from "../../components/ui/ChipGroup.jsx";

// Sub-switcher del hub "Editar": alterna entre las herramientas que se aplican
// sobre la foto (texto, censurar caras, y a futuro stickers/marca de agua…).
// Vive arriba del rail de cada sub-herramienta.
export default function EditTabs({ value, onChange }) {
  return (
    <section className="rail-group">
      <ChipGroup
        ariaLabel={t("edit.tools")}
        value={value}
        onChange={onChange}
        options={[
          { value: "text", label: t("edit.text") },
          { value: "faces", label: t("edit.faces") },
          { value: "filters", label: t("edit.filters") },
          { value: "watermark", label: t("edit.watermark") },
          { value: "annotate", label: t("edit.annotate") },
        ]}
      />
    </section>
  );
}

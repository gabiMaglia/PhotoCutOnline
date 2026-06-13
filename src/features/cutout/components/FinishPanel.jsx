import { t } from "../../../lib/i18n.js";
import Checkbox from "../../../components/ui/Checkbox.jsx";
import Slider from "../../../components/ui/Slider.jsx";

// Grupo "Acabado": contorno sticker y sombra, cada uno con su intensidad.
export default function FinishPanel({
  hasCut,
  stickerOn,
  stickerWidth,
  shadowOn,
  shadowSize,
  onSticker,
  onStickerWidth,
  onShadow,
  onShadowSize,
}) {
  return (
    <section className="rail-group">
      <h2 className="rail-title">{t("finish.title")}</h2>

      <Checkbox checked={stickerOn} disabled={!hasCut} onChange={onSticker}>
        {t("finish.sticker")}
      </Checkbox>
      <Slider
        id="sticker-w"
        label={t("finish.stickerWidth", { n: stickerWidth })}
        min={4}
        max={48}
        value={stickerWidth}
        onChange={onStickerWidth}
        disabled={!stickerOn || !hasCut}
        off={!stickerOn || !hasCut}
      />

      <Checkbox checked={shadowOn} disabled={!hasCut} onChange={onShadow}>
        {t("finish.shadow")}
      </Checkbox>
      <Slider
        id="shadow-s"
        label={t("finish.shadowSize", { n: shadowSize })}
        min={10}
        max={100}
        value={shadowSize}
        onChange={onShadowSize}
        disabled={!shadowOn || !hasCut}
        off={!shadowOn || !hasCut}
      />
    </section>
  );
}

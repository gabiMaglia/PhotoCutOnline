import { t } from "../../../lib/i18n.js";
import { formatMegapixels } from "../../../lib/imageFile.js";
import Modal from "../../../components/ui/Modal.jsx";
import Button from "../../../components/ui/Button.jsx";

// Diálogo "imagen muy grande": ofrece reducir a 4K o cancelar.
export default function LargeImageModal({ pending, onConfirm, onCancel }) {
  if (!pending) return null;
  return (
    <Modal
      labelledBy="modal-large-title"
      actions={
        <>
          <Button variant="primary" autoFocus onClick={onConfirm}>
            {t("large.reduce")}
          </Button>
          <Button onClick={onCancel}>{t("large.cancel")}</Button>
        </>
      }
    >
      <h3 id="modal-large-title">{t("large.title")}</h3>
      <p>
        {t("large.body", {
          w: pending.width,
          h: pending.height,
          mp: formatMegapixels(pending.width, pending.height),
        })}
      </p>
    </Modal>
  );
}

import { t, useLang, setLang, LANGS } from "../../lib/i18n.js";

// Selector de idioma compacto (pill). Re-renderiza al cambiar de idioma.
export default function LangSwitch() {
  const lang = useLang();
  return (
    <select
      className="lang-select"
      value={lang}
      aria-label={t("lang.aria")}
      onChange={(e) => setLang(e.target.value)}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

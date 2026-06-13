// Consentimiento de cookies/analítica (GDPR/ePrivacy). Guarda la decisión del
// usuario en localStorage. La app funciona igual sin consentimiento: solo la
// analítica (que usa cookies) espera al "granted".
const KEY = "pc-consent";

export function getConsent() {
  try {
    return localStorage.getItem(KEY); // "granted" | "denied" | null
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* sin storage: la decisión no persiste, se vuelve a preguntar */
  }
}

export function hasConsentDecision() {
  const c = getConsent();
  return c === "granted" || c === "denied";
}

// Enlaces de confianza que debe tener el footer de TODA página, por idioma.
// Orden fijo: Privacidad · Términos · Contacto · Acerca · Autor.
export const TRUST = {
  es: [
    ["/legal/privacidad.html", "Privacidad"],
    ["/legal/terminos.html", "Términos"],
    ["/contacto.html", "Contacto"],
    ["/acerca.html", "Acerca"],
    ["/autor.html", "Autor"],
  ],
  en: [
    ["/en/legal/privacy.html", "Privacy"],
    ["/en/legal/terms.html", "Terms"],
    ["/en/contact.html", "Contact"],
    ["/en/about.html", "About"],
    ["/en/author.html", "Author"],
  ],
  pt: [
    ["/pt/legal/privacidade.html", "Privacidade"],
    ["/pt/legal/termos.html", "Termos"],
    ["/pt/contato.html", "Contato"],
    ["/pt/sobre.html", "Sobre"],
    ["/pt/autor.html", "Autor"],
  ],
};

export const ALL_TRUST_HREFS = new Set(
  Object.values(TRUST).flatMap((l) => l.map(([href]) => href))
);

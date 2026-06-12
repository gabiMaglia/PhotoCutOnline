# Monetización — investigación y plan (2026-06-11)

Objetivo: monetizar la página web con publicidad u otras vías, manteniendo el
selling point del producto: **"tus fotos nunca salen de tu navegador"**.

## 1. Google AdSense — posible, pero no como primera opción

**Lo que exige hoy (2025–2026):**
- Sitio público con HTTPS, navegación clara y mobile-friendly.
- Páginas legales personalizadas: About, Contact, **Privacy Policy**,
  Disclaimer, Terms.
- Contenido original "con profundidad": la guía práctica habla de 15–25
  artículos humanos de 800–1500+ palabras. Google evalúa E-E-A-T.
- **Riesgo principal para nosotros:** los sitios que son "solo una
  herramienta" caen con frecuencia en el rechazo por **"low value content"**
  — el crawler ve una SPA con poco texto indexable. Para aprobar, habría que
  añadir una capa editorial (landing con contenido, guías de uso, blog sobre
  recorte/diseño de iconos).
- **Consentimiento (GDPR/EEA + UK):** Google exige un CMP certificado
  (banner de cookies) para servir anuncios personalizados en Europa. Eso
  añade fricción y matiza nuestra promesa de privacidad (las imágenes siguen
  sin subirse, pero el usuario ya no navega "sin terceros").
- Pago: umbral de 100 USD.

**Veredicto:** viable a medio plazo *si* construimos contenido editorial
(blog + guías). No para el lanzamiento.

## 2. Redes orientadas a herramientas/dev — mejor encaje

| Red | Modelo | Requisitos | Encaje |
|---|---|---|---|
| **EthicalAds** | contextual, sin tracking, 1 anuncio/página; ~70% para el publisher, ~$2.50 CPM (tráfico US/EU), pago mensual desde $50 | ~50 000 pageviews/mes, audiencia técnica, revisión manual | ⭐ El mejor: "privacy-first" **refuerza** nuestra promesa en vez de romperla; audiencia de Icon Studio es dev/diseño |
| **Carbon Ads** (BuySellAds) | 1 anuncio curado/página para audiencia dev/design | invite-only, revisión manual de relevancia y tráfico | Muy bueno si nos aceptan; solicitar cuando haya tráfico |
| AdSense | display clásico | ver arriba | Solo con capa editorial |

## 3. Vías que no son ads (ya tenemos la infraestructura)

- **Freemium desktop** ⭐ — la página ya ofrece "Descargar app" con
  instaladores (Win + macOS x2 vía GitHub Releases). Modelo: web gratis
  (motor WASM completo) + desktop de pago con extras (batch, formatos pro,
  sin marca). Requiere pasarela (Gumroad/Lemon Squeezy/Paddle gestionan IVA).
- **Donaciones** — Ko-fi / GitHub Sponsors / Buy Me a Coffee: cero fricción,
  cero conflicto con privacidad. Botón en el modal Acerca de.
- **Plantillas/packs** — venta de packs de iconos/fondos desde Icon Studio
  (más adelante).

## 4. Plan recomendado por fases

1. **Lanzamiento (ya):** hosting + analytics de visitas respetuoso
   (Plausible/Umami — sin cookies, sin banner) para MEDIR tráfico real.
   Botón de donaciones. Página de descarga de la app como funnel.
2. **≥50k pageviews/mes:** aplicar a **EthicalAds** (1 anuncio discreto en
   el rail / bajo el lienzo). Aplicar también a Carbon.
3. **Si el tráfico crece y compensa:** añadir capa editorial (guías SEO:
   "cómo quitar el fondo", "medidas de iconos iOS/Android") → solicitar
   AdSense con CMP de consentimiento. El loader ya está preparado:
   compilar con `VITE_ADSENSE_CLIENT=ca-pub-XXXX npm run build` lo activa
   (ver `src/main.jsx`); sin la variable, no se carga nada.
4. **Monetización fuerte:** desktop de pago (freemium real).

**Nota técnica:** al activar cualquier red, revisar el CSP del hosting para
permitir los dominios del proveedor (p. ej. `pagead2.googlesyndication.com`),
y añadir la Privacy Policy correspondiente.

## Fuentes

- [AdSense rejection due to Low Value Content (Geniee)](https://genieegroup.com/blog/adsense-low-value-content/)
- [Google AdSense Approval Guide 2026 (Webtimize)](https://webtimizesolutions.com/blog/google-adsense-approval-guide-2026-complete-genuine-updated-information/)
- [How to fix "low value content" (Google AdSense Community)](https://support.google.com/adsense/community-guide/241032356/how-can-you-solve-the-low-value-content-adsense-disapproval-challenge?hl=en)
- [EthicalAds — Monetize your Web App or Tool](https://www.ethicalads.io/publishers/topics/web-developers/)
- [EthicalAds como alternativa a Carbon](https://www.ethicalads.io/alternative-to-carbon-ads/)
- [Where to advertise to developers in 2026 (comparativa de 9 plataformas)](https://medium.com/@NimrodKramer/where-to-advertise-to-developers-in-2026-i-compared-9-platforms-heres-what-works-81da49f2d37d)
- [21 Best AdSense Alternatives (Kinsta)](https://kinsta.com/blog/adsense-alternatives/)

# Monetización — estrategia y plan

**Decisión (2026-06-12):** la página se monetiza **principalmente con
publicidad por tráfico**, complementada con **donaciones** (Ko-fi:
<https://ko-fi.com/gabrielmaglia>). Los bundles offline descargables serán de
pago, pero es un tema aparte que se aborda más adelante. Restricción de
diseño: mantener el selling point — **"tus fotos nunca salen de tu
navegador"** — con publicidad discreta (1 slot por vista) y sin terceros por
defecto.

## 1. Qué hay implementado (jun 2026)

- **Slot publicitario multi-proveedor** al pie del rail en ambas pestañas
  (Recorte e Icon Studio; solo una visible a la vez → cumple "1 anuncio por
  página" de EthicalAds/Carbon). Ver `src/lib/ads.js` y
  `src/components/AdSlot.jsx`. Activación por build, un proveedor a la vez:

  | Variable | Red |
  |---|---|
  | `VITE_ETHICALADS_PUBLISHER=<id>` | EthicalAds |
  | `VITE_CARBON_SERVE=<id>` + `VITE_CARBON_PLACEMENT=<dominio>` | Carbon Ads |
  | `VITE_ADSENSE_CLIENT=ca-pub-XXXX` + `VITE_ADSENSE_SLOT=<id>` | Google AdSense |
  | (ninguna) | **House-ad propio**: donación Ko-fi / app de escritorio. Cero terceros. |

  `VITE_ADS_DEV=1` muestra el slot también en `npm run dev`.
- **Donaciones**: corazón ♥ en la topbar, CTA del house-ad y botón en el
  modal Acerca de. URL por defecto: el Ko-fi de Gabriel;
  `VITE_DONATE_URL` la sobreescribe (`""` la oculta).
- **Páginas legales** (requisito AdSense): `/legal/privacidad.html` y
  `/legal/terminos.html`, enlazadas desde Acerca de.
- **Capa editorial SEO** (requisito AdSense + captación de tráfico):
  `/guias/` con 3 guías de ~800-1000 palabras (quitar fondo, medidas de
  iconos 2026, favicons). Más `robots.txt` y plantilla de `ads.txt`.

## 2. Las redes, analizadas

### Por las que vamos (en orden)

| Red | Modelo | Requisito de entrada | CPM aprox. | Encaje |
|---|---|---|---|---|
| **EthicalAds** ⭐ primera | Contextual, sin cookies, 1 anuncio/página; ~70% para el publisher; pago mensual desde $50 | ~50k pageviews/mes, audiencia técnica, revisión manual | ~$2.50 (US/EU) | El "privacy-first" **refuerza** nuestra promesa; Icon Studio = audiencia dev |
| **Carbon Ads** | 1 anuncio curado/página, audiencia dev/design | Invite-only, tráfico demostrable | $1.50–4 | Solicitar a la vez que EthicalAds; si aceptan, comparar eCPM real |
| **Google AdSense** | Display clásico + Auto ads | Aprobación editorial (E-E-A-T); riesgo "low value content" en sitios-herramienta — por eso existen las guías | Muy variable ($0.20–3 efectivo según geo) | El mayor inventario y fill rate; exige CMP en EEA/UK y matiza la promesa de privacidad |

### Descartadas (y por qué)

- **Mediavine / Raptive / Monumetric** (redes premium): exigen 50k–100k
  *sesiones*/mes y contenido editorial extenso; reevaluar solo si el blog
  despega de verdad.
- **Media.net**: requiere mayoría de tráfico US/UK/CA y contenido editorial;
  mal encaje con tráfico hispano de herramienta.
- **Adsterra / Monetag / PropellerAds**: pagan con poco tráfico pero a base
  de formatos agresivos (popunders, push). Destruirían la confianza que es
  nuestro diferencial. No.
- **Afiliados** (hosting de imágenes, stock, dominios): posible complemento
  futuro dentro de las guías, no estructural.

## 3. Donaciones

- **Ko-fi** (activo): 0% de comisión en donaciones simples, página en
  español, sin cuenta para el donante. <https://ko-fi.com/gabrielmaglia>
- **GitHub Sponsors**: candidato a sumarse cuando el repo sea público o haya
  comunidad dev (Icon Studio la atrae). Buy Me a Coffee no aporta nada sobre
  Ko-fi (5% de comisión).
- Regla de UX: la donación se pide *después* de entregar valor (house-ad y
  Acerca de), nunca con modales ni interrupciones.

## 4. Checklist de activación (en orden)

1. **[bloqueante] Dominio propio (A5 del roadmap)** — sin él no hay AdSense,
   ni sitemap, ni canonical. Al tenerlo: añadir `Sitemap:` en `robots.txt`,
   crear `sitemap.xml` (raíz + 2 legales + 4 de guías), y `og:url`/canonical.
2. **Analytics sin cookies** (Plausible/Umami, self-host o cloud) para MEDIR
   pageviews reales — todas las redes lo van a preguntar y hoy estamos
   ciegos. Sin banner de cookies: no usan identificadores.
3. **Tráfico**: publicar las guías (índices ya enlazados), compartir en
   comunidades dev/diseño, indexar en Search Console al tener dominio.
4. **≥50k pageviews/mes** → aplicar a **EthicalAds** y **Carbon** en
   paralelo. Activar la aprobada: un env var en el build de producción y
   revisar el CSP del hosting (`media.ethicalads.io` o
   `cdn.carbonads.com` + `srv.carbonads.net`).
5. **AdSense** (cuando haya dominio + guías indexadas + tráfico estable):
   - Crear cuenta → verificar dominio → descomentar la línea en
     `public/ads.txt` con el `pub-` real.
   - En la consola: activar **Privacidad y mensajes** (CMP certificado de
     Google para EEA/UK — lo sirve el propio script, sin código extra).
   - Build con `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT`.
   - CSP: permitir `pagead2.googlesyndication.com`,
     `googleads.g.doubleclick.net`, `tpc.googlesyndication.com`,
     `fundingchoicesmessages.google.com`.
   - Actualizar la fecha de `/legal/privacidad.html` (ya describe AdSense).
6. **Comparar eCPM real** EthicalAds vs AdSense con 1–2 meses de datos y
   quedarse con el mejor (o segmentar: AdSense en guías, EthicalAds en app).

## 5. Lo que NO se hace todavía

- **Bundles offline de pago / freemium desktop**: decidido que va aparte;
  requiere pasarela (Lemon Squeezy/Paddle para IVA). Retomar cuando el
  tráfico esté monetizando.
- Venta de packs de plantillas/iconos.
- Capa de cuentas de usuario (rompería la promesa de privacidad y no la
  necesita ninguna vía elegida).

## Fuentes

- [AdSense rejection due to Low Value Content (Geniee)](https://genieegroup.com/blog/adsense-low-value-content/)
- [Google AdSense Approval Guide 2026 (Webtimize)](https://webtimizesolutions.com/blog/google-adsense-approval-guide-2026-complete-genuine-updated-information/)
- [How to fix "low value content" (Google AdSense Community)](https://support.google.com/adsense/community-guide/241032356/how-can-you-solve-the-low-value-content-adsense-disapproval-challenge?hl=en)
- [EthicalAds — Monetize your Web App or Tool](https://www.ethicalads.io/publishers/topics/web-developers/)
- [EthicalAds como alternativa a Carbon](https://www.ethicalads.io/alternative-to-carbon-ads/)
- [Where to advertise to developers in 2026 (comparativa de 9 plataformas)](https://medium.com/@NimrodKramer/where-to-advertise-to-developers-in-2026-i-compared-9-platforms-heres-what-works-81da49f2d37d)
- [21 Best AdSense Alternatives (Kinsta)](https://kinsta.com/blog/adsense-alternatives/)

# Instrucciones de monetización — manual operativo

Guía paso a paso para activar cada vía de ingreso. La estrategia y el
análisis de redes están en [MONETIZACION.md](MONETIZACION.md); esto es el
**"qué hacer, dónde y en qué orden"**. Está pensado para ejecutarse en fases:
cada fase desbloquea la siguiente.

> **Estado actual del código:** todo lo técnico ya está implementado y
> commiteado. El slot publicitario, el house-ad, las donaciones, las páginas
> legales y las guías SEO ya están en producción en cuanto se despliegue.
> Lo que sigue son gestiones de cuentas y configuración, no desarrollo.

---

## Fase 0 — Hoy mismo (sin dominio, gratis)

### 0.1 Verificar la página de Ko-fi

1. Entrar a <https://ko-fi.com/gabrielmaglia> y comprobar que la página está
   activa y configurada para recibir pagos (Ko-fi → Settings → Payment:
   conectar PayPal o Stripe — sin esto los botones cobran pero no acreditan).
2. Recomendado: poner en la descripción de Ko-fi una línea sobre PhotoCut
   ("Apoyá PhotoCut Studio, la herramienta de recorte 100% privada") y el
   link al sitio — el tráfico va en ambos sentidos.
3. En Ko-fi → Settings → Page: activar "Ko-fi Gold" **NO** es necesario;
   las donaciones simples no tienen comisión de Ko-fi.

### 0.2 Desplegar la versión actual

El build de producción ya incluye todo (house-ad con tu Ko-fi, legales,
guías). Sin variables extra:

```bash
npm run build   # → dist/
```

Subir `dist/` al hosting actual. Verificar tras el deploy:

- `https://<sitio>/legal/privacidad.html` y `/legal/terminos.html` cargan.
- `https://<sitio>/guias/` lista las 3 guías.
- El ♥ de la topbar y el house-ad del rail llevan a tu Ko-fi.

### 0.3 Probar el slot en local (opcional)

```bash
VITE_ADS_DEV=1 npm run dev   # muestra el house-ad también en desarrollo
```

---

## Fase 1 — Dominio y medición (esta semana, ~10–15 USD/año)

**Esta fase es EL bloqueante de todo lo demás.** Sin dominio propio no
acepta AdSense, no funciona Search Console y las redes no toman en serio la
aplicación.

### 1.1 Comprar el dominio (A5 del roadmap)

1. Elegir un nombre (decisión de marca, no técnica). Sugerencias de zona de
   precio: `.app` (~14 USD/año, fuerza HTTPS — bien para nosotros), `.com`
   si está libre.
2. Registrar en Cloudflare Registrar (precio de costo, sin renovaciones
   infladas) o Namecheap/Porkbun.
3. Apuntar el DNS al hosting actual y verificar que HTTPS funciona.

### 1.2 Cablear el dominio en el código

Una vez exista (reemplazar `photocut.example` por el real):

1. `public/robots.txt`: descomentar y completar la línea
   `Sitemap: https://photocut.example/sitemap.xml`.
2. Crear `public/sitemap.xml` con estas 7 URLs: `/`,
   `/legal/privacidad.html`, `/legal/terminos.html`, `/guias/` y las 3
   guías.
3. `index.html`: añadir `<link rel="canonical" href="https://photocut.example/">`
   y `og:url`.
4. Commit + deploy.

### 1.3 Google Search Console

1. <https://search.google.com/search-console> → Añadir propiedad → tipo
   "Dominio" → verificar por DNS (TXT record).
2. Enviar el `sitemap.xml`.
3. En 1–2 semanas, revisar qué consultas traen impresiones a las guías —
   eso indica qué nueva guía escribir.

### 1.4 Analytics sin cookies (medir pageviews)

Las redes de ads preguntan "¿cuántas pageviews/mes?" y hoy no lo sabemos.
Opciones, ambas sin cookies (no necesitan banner de consentimiento):

- **Plausible** (cloud, 9 USD/mes) — cero mantenimiento.
- **Umami** (gratis self-host en Vercel/Railway + Postgres) — cero costo.

Integración: una línea de `<script>` en `index.html` (solo el dominio de
producción). Anotar en este doc cuál se eligió y el dashboard.

> **Meta de la fase:** saber el número real de pageviews/mes. Todo lo de la
> Fase 3 depende de ese número.

---

## Fase 2 — Tráfico (continuo desde ya)

Sin tráfico no hay publicidad que valga. La palanca principal son las guías
SEO y la distribución manual:

1. **Distribución inicial** (un envío por canal, sin spam):
   - Reddit: r/webdev, r/SideProject, r/InternetIsBeautiful (la promesa
     "100% en tu navegador" funciona muy bien ahí).
   - Hacker News: "Show HN: PhotoCut — background removal that never
     uploads your photo".
   - Product Hunt (preparar assets: GIF del antes/después, el comparador es
     el momento "wow").
   - Comunidades hispanas: ForoBeta, r/programacion, X/Twitter dev hispano.
2. **Más guías** cuando Search Console muestre qué buscan: candidatas ya
   detectadas — "cómo hacer un sticker de WhatsApp", "tamaños de imagen
   para Amazon/Etsy/Shopify" (ya tenemos los presets), "convertir PNG a
   ICO". Mantener el patrón de las existentes: 800+ palabras útiles, CTA a
   la app, en `public/guias/`.
3. **KPI** (del ROADMAP): si Icon Studio supera el 30% del uso, la audiencia
   es dev → priorizar la aplicación a Carbon.

---

## Fase 3 — Activar la primera red (al llegar a ~50k pageviews/mes)

Aplicar a las dos a la vez; activar la que apruebe primero.

### 3.1 EthicalAds (primera opción)

1. Aplicar en <https://www.ethicalads.io/publishers/> (cuentan pageviews,
   audiencia técnica; revisión manual, días).
2. Al aprobar te dan un **publisher ID**.
3. Activar (solo el build de producción):
   ```bash
   VITE_ETHICALADS_PUBLISHER=<publisher-id> npm run build
   ```
4. Si el hosting tiene CSP: permitir `media.ethicalads.io` en `script-src`
   e `img-src`.
5. Verificar en producción que el slot muestra el anuncio (1 por página, ya
   cumplido por diseño).
6. Cobro: mensual desde 50 USD acumulados (PayPal/transferencia).

### 3.2 Carbon Ads (en paralelo)

1. Solicitar en <https://www.carbonads.net/> ("Apply"); es invite-only —
   mencionar Icon Studio y la audiencia dev/design.
2. Al aprobar dan `serve` ID y `placement`:
   ```bash
   VITE_CARBON_SERVE=<id> VITE_CARBON_PLACEMENT=<dominio> npm run build
   ```
3. CSP: `cdn.carbonads.com` y `srv.carbonads.net`.

> Solo una red a la vez (el código toma la primera variable definida, en
> orden EthicalAds → Carbon → AdSense). Si aprueban ambas, correr 1 mes con
> cada una y comparar ingresos reales.

---

## Fase 4 — AdSense (cuando: dominio + guías indexadas + tráfico estable)

AdSense paga peor por impresión pero tiene fill rate del 100% y escala con
cualquier tráfico (las redes dev no monetizan al público general que llega
buscando "quitar fondo de foto").

1. **Cuenta**: <https://adsense.google.com> → registrar el sitio. La
   revisión tarda días–semanas. Si rechazan por "low value content":
   escribir 3–5 guías más y re-aplicar (se puede cada 2 semanas).
2. **ads.txt**: editar `public/ads.txt`, descomentar la línea de Google y
   poner el `pub-XXXXXXXXXXXXXXXX` real. Deploy. (AdSense lo verifica solo.)
3. **Consentimiento (obligatorio para EEA/UK)**: en la consola de AdSense →
   **Privacidad y mensajes** → crear el mensaje GDPR. Es el CMP certificado
   de Google y lo sirve el propio script de ads — no hay que tocar código.
4. **Crear el bloque**: AdSense → Anuncios → Por bloque → "Anuncio display"
   → copiar el `data-ad-slot`.
5. **Activar**:
   ```bash
   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX VITE_ADSENSE_SLOT=<slot-id> npm run build
   ```
6. CSP: `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`,
   `tpc.googlesyndication.com`, `fundingchoicesmessages.google.com`.
7. Actualizar la fecha de `/legal/privacidad.html` (el texto ya cubre
   AdSense y el aviso de consentimiento).
8. Cobro: umbral de 100 USD, transferencia bancaria.

---

## Fase 5 — Optimizar (con 1–2 meses de datos)

- Comparar eCPM real EthicalAds vs AdSense. Posible híbrido: AdSense en las
  guías estáticas (público general) y EthicalAds en la app (audiencia dev)
  — las guías son HTML estático, se les puede poner AdSense directo sin
  tocar React.
- Si las donaciones superan ~20 USD/mes, añadir GitHub Sponsors.
- Recién entonces: retomar los **bundles offline de pago** (tema aparte,
  fuera de este documento).

---

## Resumen: qué depende de quién

| Acción | Quién | Bloquea a |
|---|---|---|
| Conectar pagos en Ko-fi | Gabriel (5 min) | donaciones reales |
| Deploy de la versión actual | Gabriel | todo lo visible |
| Comprar dominio | Gabriel (decisión de marca) | Fases 1–4 completas |
| Sitemap/canonical al tener dominio | desarrollo (15 min) | Search Console |
| Elegir Plausible vs Umami | Gabriel | medición de tráfico |
| Aplicaciones a redes | Gabriel (formularios) | ingresos por ads |
| Activar red aprobada | desarrollo (1 env var + deploy) | — |

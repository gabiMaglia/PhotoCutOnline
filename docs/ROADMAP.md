# PhotoCut Studio — Roadmap de producto

*PO doc · 2026-06-11. Complementa a [PLAN-PRODUCCION.md](PLAN-PRODUCCION.md)
(checklist técnico de calidad/infra, casi todo ✅) y
[MONETIZACION.md](MONETIZACION.md) (plan de ingresos por fases).*

> **Estado 2026-06-15.** **Paridad de la versión desktop (Tauri):** el escritorio
> ahora corre el **mismo motor web** (worker WASM, fallback inline) en vez del
> backend Rust recortado — IA local, auto-recorte, varita, deshacer, feather,
> sticker/sombra/presets y formatos quedan activos igual que en la web. Además:
> **drag-and-drop nativo** (`dragDropEnabled:false`), **exportación con diálogo
> nativo "Guardar como"** (plugins dialog+fs, botón "Exportar"), CSP ampliado para
> onnxruntime-web y fix del comparador antes/después. Los comandos Rust quedan
> inertes (cleanup futuro). Falta el v0.1.0 con instaladores (tag pusheado).
>
> **Estado 2026-06-13.** Sesión grande de pre-deploy y monetización:
> - **Arquitectura modular** completa: `components/ui` (atoms), `features/*`
>   (pages + hooks), `services/`, `utils/`, `lib/` (motor). App.jsx ahora es un
>   shell delgado. Dos suites de test: **Jest + RTL** (UI, 72 tests) y
>   **Playwright** (motor, Chrome).
> - **Deploy en Vercel** configurado (`vercel.json`, headers, `.vercelignore`).
>   Vars de build documentadas en `.env.example`.
> - **Varita mágica por color** (flood-fill, multi-selección con shift) — nuevo
>   modo de marcado junto a recuadro/IA/pinceles.
> - **Sticker Studio** construido (WhatsApp/Telegram) pero **oculto tras flag**
>   `STICKERS_ENABLED=false` (decisión: revisitar más adelante).
> - **Monetización**: Google Analytics 4 **gateado por banner de consentimiento**
>   (GDPR); SEO publicado: **5 guías** + `sitemap.xml` + `canonical` + robots
>   (build desde `VITE_SITE_URL`). Ads multi-proveedor y donaciones ya estaban.
> - **Falta del lado del PO**: setear `VITE_SITE_URL` + `VITE_GA_ID` en Vercel,
>   conseguir **dominio propio** y enviar el sitemap a Search Console.

## Norte

> **El único editor de recorte + iconos donde tus imágenes JAMÁS salen de tu
> equipo.** Gratis en la web, pro en el escritorio.

Dos pilares: **Recorte** (quitar fondo / canal alfa) e **Icon Studio**
(pipeline completo de iconos de app). El segundo casi no tiene competencia
integrada: los removedores de fondo no generan iconos, los generadores de
iconos no recortan fondos. Esa combinación + privacidad total es la cuña.

## Análisis competitivo (jun 2026)

| | remove.bg | Photoroom | Pixelcut | IconKitchen / AppIconKitchen | **PhotoCut** |
|---|---|---|---|---|---|
| Segmentación | IA (top en pelo) | IA e-commerce | IA mobile | — | GrabCut WASM (pierde en pelo) |
| Privacidad | ☁️ sube tu foto | ☁️ | ☁️ | parcial | ⭐ **100% local** |
| Batch | de pago | de pago | de pago | — | ✗ |
| Post-recorte (sombras, presets tienda) | básico | ⭐ el diferenciador | escenas IA | — | fondos sólido/imagen |
| Iconos de app | ✗ | ✗ | ✗ | ⭐ estilos, iOS 18, themed | sets completos + Python CLI |
| Offline / instalable | ✗ | app móvil | app móvil | ✗ | ⭐ PWA + desktop 3 plataformas |
| Precio | crédito/imagen | suscripción | suscripción | gratis | gratis (hoy) |

**Lectura PO:** (1) todos los removedores serios son IA — nuestro GrabCut
pierde en pelo/bordes finos: hay que cerrar ese gap **sin romper la promesa
de privacidad** → IA local en el navegador. (2) Lo que convierte usuarios en
pagadores en Photoroom es el flujo *después* del recorte (presets de
marketplace, sombras, plantillas) — barato de construir sobre lo que ya
tenemos. (3) En iconos, el estándar 2026 es iOS 18 dark/tinted y Android
themed: nos faltan, son acotados.

---

## AHORA (esta semana) — salir al mundo

| # | Ítem | Estado | Por qué |
|---|---|---|---|
| A1 | **Hosting** | ✅ Vercel configurado (`vercel.json`) | Último P0; sin esto no existe el producto |
| A2 | **Release v0.1.0** (tag → instaladores) | ⬜ pendiente (PO) | Probar el pipeline E2E; activa el funnel de descarga |
| A3 | **Analytics** | ✅ GA4 + banner de consentimiento (se eligió GA, no Plausible) | Medir visitas para decidir todo lo demás |
| A4 | **Botón de donaciones** (Ko-fi) | ✅ topbar + house-ad + Acerca de | Monetización fase 1, cero fricción |
| A5 | **Dominio + marca** | ⬜ pendiente (PO) — desbloquea sitemap/canonical/OG (ya cableados a `VITE_SITE_URL`) | Decisión de negocio |

## SIGUIENTE (v0.2–v0.3) — cerrar el gap de calidad

*2026-06-12: N1, N4, N5, N6, N7 y N8 implementados y testeados (ver commits).
N1: u2netp (Apache-2.0, 4.6MB) + onnxruntime-web same-origin en el worker,
matte suave con IoU 98.5% en el test E2E; pinceles editan el matte; modelo
cacheado offline por el SW. N2: comparador antes/después con divisor
arrastrable (atajo C, etiquetas, HUD). N3: zoom hacia el cursor 1×–8×
(rueda/pinch), pan (espacio/botón central/dos dedos), doble clic = reset,
badge de zoom en HUD. Solo queda N9 (firma de código — requiere
certificados).
2026-06-13: además de N1–N8, se sumó la **varita mágica por color** (no estaba
en N1–N9): flood-fill desde el clic, multi-selección con shift, "borrar el
resto". Sweet spot: imágenes planas/gráficos (en fotos siguen ganando IA/
GrabCut). Pincel de recorte optimizado (edita la máscara directo, ~6× más
rápido).*

| # | Ítem | Esfuerzo | Por qué |
|---|---|---|---|
| N1 | ⭐ **Segmentación IA local** (ONNX en el worker: RMBG/MODNet vía onnxruntime-web; modelo ~5–40MB descargado bajo demanda y cacheado por el SW) | L | El gap nº1 vs todos: pelo/bordes finos con IA **que corre en tu navegador** — convierte la debilidad en titular: "IA privada". GrabCut queda como refinamiento/fallback |
| N2 | **Comparador antes/después** (slider en el lienzo) | S | Momento "wow" compartible; estándar del sector |
| N3 | **Zoom + pan** en el lienzo (rueda/pinch) | M | Refinar bordes con pincel a nivel de píxel; muy pedido en este tipo de tools |
| N4 | **Efecto sticker** (contorno blanco configurable) | S | Feature viral (WhatsApp/Telegram stickers); barata sobre la máscara que ya tenemos |
| N5 | **Sombra automática** (drop shadow bajo el sujeto) | M | El básico del e-commerce; Photoroom lo explota |
| N6 | **Presets de exportación** (Amazon/Etsy/Shopify/IG/perfil circular: tamaño + fondo + margen) | M | El flujo post-recorte es lo que monetiza en la competencia |
| N7 | **Icon Studio: iOS 18 dark + tinted, Android 13 themed (monochrome)** | M | Estándar 2026 de los generadores; nos pone a la par de IconKitchen |
| N8 | Icon Studio: **snippet HTML de favicons** listo para copiar | S | Quick win del flujo web |
| N9 | **Firma de código** (Apple Developer ID + Authenticode) | M (+$) | Sin avisos de Gatekeeper/SmartScreen las descargas convierten mucho más |

## DESPUÉS (v1.0) — monetizar en serio

| # | Ítem | Esfuerzo | Por qué |
|---|---|---|---|
| D1 | **Batch processing** (N imágenes, cola en worker) — **de pago/desktop** | L | En toda la competencia es la feature de pago; define el corte freemium |
| D2 | **Freemium real** (licencias desktop vía Lemon Squeezy/Paddle) | L | Ingreso principal según MONETIZACION.md |
| D3 | **EthicalAds** (al llegar a ~50k pageviews/mes) | S | Ads privacy-first que refuerzan el posicionamiento |
| D4 | **Plantillas** (foto de producto, avatar, banner) con marca guardada | L | Retención: de herramienta puntual a flujo recurrente |
| D5 | **HEIC real** (libheif-js, ~+300KB lazy) | M | El formato del iPhone; hoy solo mensaje claro |
| D6 | ~~Capa editorial/SEO~~ ✅ **5 guías + sitemap + canonical** (build desde `VITE_SITE_URL`); falta enviar sitemap a Search Console (PO) | — | Tráfico orgánico + prerequisito AdSense |
| D7 | **AdSense** (con dominio + tráfico): el CMP de consentimiento ya existe para GA y cubre AdSense | M | Mayor inventario; complementa a EthicalAds |

## ALGÚN DÍA / apuestas

- **Sticker Studio** (ya construido, oculto tras `STICKERS_ENABLED`): reactivar
  + pack de varios stickers en ZIP e ícono de bandeja 96 para WhatsApp
- **API/MCP de pago por consulta** (ver [MCP-API.md](MCP-API.md)): npm local
  primero, lambda Rust + Stripe después
- **Magic eraser** (inpainting local de objetos) — L/XL, segundo titular IA
- **Video matting** (quitar fondo de clips cortos) — XL
- Historial visual de sesión + proyectos guardados (IndexedDB, local)
- Marketplace de packs de fondos/plantillas

## Lo ya construido (no se vuelve a discutir)

Motor GrabCut Rust→WASM con fallback JS · **IA local u2netp** (worker) ·
**varita mágica por color** · worker (UI nunca se congela) · undo/redo ·
feather · auto-recorte · **comparador antes/después** · **zoom/pan** · vista
previa flotante arrastrable · export PNG/WebP/JPEG/portapapeles con fondo
sólido/imagen previsualizable · **sticker + sombra** · **presets de export**
(Amazon/Etsy/Shopify/IG/avatar) · Icon Studio (iOS18 dark/tinted, Android
themed, macOS/Windows/PWA + ZIP + CLI Python + favicons) · PWA offline · i18n
ES/EN/PT · responsive · onboarding · a11y base · tope 24MP · error boundary ·
telemetría opt-in · licencias.

**Infra/arquitectura (2026-06-13):** arquitectura modular (atoms/features/
hooks/services/utils) · Jest+RTL (72 tests) + Playwright · deploy Vercel ·
GA4 + consentimiento de cookies · SEO (5 guías + sitemap + canonical) ·
vars de build documentadas (`.env.example`).

## Bugs conocidos (auditoría 2026-06-13)

*Tests verdes (72/72 Jest); no son crashes sino comportamiento que los tests no
cubren. B1/B3/B4 son fixes seguros; B2 es decisión de producto.*

| # | Bug | Severidad | Dónde |
|---|---|---|---|
| B1 | **Desync de estado al cargar imagen nueva**: el efecto resetea `resultUrl`/`hasCut`/`mode` pero **no** `feather`/`stickerOn`/`stickerWidth`/`shadowOn`/`shadowSize`. El motor sí los resetea (`featherPx=2`, `finish=null`). → checkbox/slider muestran valores viejos pero el recorte sale sin ellos hasta tocar cada control | Moderado (visible) | `useCutoutSession.js:32-39` |
| B2 | **Preset + fondo (color/imagen) se ignora**: `compositePreset` usa solo `preset.bg` hardcodeado e ignora `type:'solid'\|'image'` y `bgDataUrl`. Elegir fondo "imagen" + preset IG → sale fondo blanco sin aviso. ¿Intencional (Amazon exige blanco) o el preset debe respetar el fondo elegido? **Decisión de producto** | Moderado (confuso) | `jsEngine.js:523-549` |
| B3 | **`trimSource` con regex en español hardcodeado** (`/\s*\(recortado\)$/`): en EN el tag es `(trimmed)`, así que recortar dos veces acumula `logo (trimmed) (trimmed)` | Menor (cosmético) | `useIconStudio.js:132` |
| ~~B4~~ | ✅ **(resuelto 2026-06-15)** Timers de debounce ahora se limpian al desmontar y al cambiar de imagen (no más `setResultUrl` colgado) | Menor | `useCutoutSession.js` |

## KPIs para decidir

| Métrica | Umbral de acción |
|---|---|
| Pageviews/mes | ≥50k → aplicar EthicalAds (D3) |
| % visitas → descarga desktop | <2% → mejorar funnel; >5% → acelerar D2 |
| Recortes completados / sesión | baja → priorizar N1 (calidad IA) |
| Uso Icon Studio vs Recorte | si >30% → invertir N7/N8 antes que N5/N6 |

> **Resumen para decidir hoy (2026-06-13):** el producto y la infra de
> monetización están listos y deployables. Lo que mueve la aguja ahora es del
> lado del PO: **(1) dominio propio**, **(2)** setear `VITE_SITE_URL` y
> `VITE_GA_ID` en Vercel + redeploy, **(3)** enviar el sitemap a Search Console.
> Después: más guías SEO para acercarse al umbral editorial de AdSense, y al
> llegar a ~50k pageviews/mes aplicar a EthicalAds/Carbon (D3/D7).

# PhotoCut Studio — Roadmap de producto

*PO doc · 2026-06-11. Complementa a [PLAN-PRODUCCION.md](PLAN-PRODUCCION.md)
(checklist técnico de calidad/infra, casi todo ✅) y
[MONETIZACION.md](MONETIZACION.md) (plan de ingresos por fases).*

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

| # | Ítem | Esfuerzo | Por qué |
|---|---|---|---|
| A1 | **Hosting** (falta elegir plataforma) | S | Último P0; sin esto no existe el producto |
| A2 | **Release v0.1.0** (tag → instaladores) | S | Probar el pipeline E2E; activa el funnel de descarga |
| A3 | **Analytics sin cookies** (Plausible/Umami) | S | Medir visitas para decidir todo lo demás (EthicalAds pide 50k/mes) |
| A4 | **Botón de donaciones** (Ko-fi) en Acerca de | S | Monetización fase 1, cero fricción |
| A5 | Dominio + marca | S | Decisión de negocio; bloquea og:url/canonical |

## SIGUIENTE (v0.2–v0.3) — cerrar el gap de calidad

*2026-06-12: N1, N4, N5, N6, N7 y N8 implementados y testeados (ver commits).
N1: u2netp (Apache-2.0, 4.6MB) + onnxruntime-web same-origin en el worker,
matte suave con IoU 98.5% en el test E2E; pinceles editan el matte; modelo
cacheado offline por el SW. N2: comparador antes/después con divisor
arrastrable (atajo C, etiquetas, HUD). N3: zoom hacia el cursor 1×–8×
(rueda/pinch), pan (espacio/botón central/dos dedos), doble clic = reset,
badge de zoom en HUD. Solo queda N9 (firma de código — requiere
certificados).*

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
| D6 | Capa editorial/SEO (guías "quitar fondo", "medidas de iconos") | M | Tráfico orgánico + prerequisito AdSense |

## ALGÚN DÍA / apuestas

- **Magic eraser** (inpainting local de objetos) — L/XL, segundo titular IA
- **Video matting** (quitar fondo de clips cortos) — XL
- Historial visual de sesión + proyectos guardados (IndexedDB, local)
- API/CLI local (la web ya genera iconos por CLI con Python; ampliar a recorte)
- Marketplace de packs de fondos/plantillas

## Lo ya construido (no se vuelve a discutir)

Motor GrabCut Rust→WASM con fallback JS · worker (UI nunca se congela) ·
undo/redo · feather · auto-recorte · vista previa flotante · export
PNG/WebP/JPEG/portapapeles · Icon Studio (iOS/Android/macOS/Windows/PWA + ZIP
+ CLI Python) · PWA offline · i18n ES/EN/PT · responsive · onboarding ·
a11y base · tope 24MP · error boundary · telemetría opt-in · licencias ·
CI 9 suites + Rust · instaladores 3 plataformas + descarga en la página.

## KPIs para decidir

| Métrica | Umbral de acción |
|---|---|
| Pageviews/mes | ≥50k → aplicar EthicalAds (D3) |
| % visitas → descarga desktop | <2% → mejorar funnel; >5% → acelerar D2 |
| Recortes completados / sesión | baja → priorizar N1 (calidad IA) |
| Uso Icon Studio vs Recorte | si >30% → invertir N7/N8 antes que N5/N6 |

> **Resumen para decidir hoy:** A1–A5 esta semana (necesito de ti: plataforma
> de hosting, OK al tag, dominio). El primer gran desarrollo siguiente es
> **N1 (IA local)** — es lo que nos pone en la conversación con remove.bg
> manteniendo el único claim que ellos no pueden copiar: tu foto nunca sale
> de tu equipo.

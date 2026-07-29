# AdSense — recuperación de "contenido de poco valor" (jul 2026)

## Diagnóstico (cotejado con fuentes, corrige marco previo)
- **No es tráfico** (no hay mínimo; es mito). La barra 2026 = **Information Gain** (unicidad) + **E-E-A-T** (1ª persona, capturas propias) + páginas de confianza en el footer de cada página.
- El sitio tenía 26 guías pero **0 imágenes propias** y **sin experiencia en 1ª persona** → ese era el hueco (cantidad ≠ valor).
- **No** generar más artículos genéricos (riesgo "scaled content abuse").
- **Reaplicar recién 2-4 semanas después** de los cambios (reaplicar al toque = rechazo).

## Hecho (commits en main, CI verde)
- `3679cc5` — índices EN/PT sin estilos arreglados + Acerca/Contacto en 44 footers ES.
- `ea6552e` — molde de guía flagship (quitar-fondo): capturas propias reales (u2netp en el navegador), antes/después con damero, screenshot del editor, bloque "Lo probamos" (1ª persona, datos verificables), `image[]` en schema, estilos `.ba/.shot/.tried`.
- `d8579c4` — molde aplicado a "recortar una persona" (assets reutilizados, "Lo probamos" propio).
- `4212ec8` — JSON-LD WebApplication + FAQPage en `/editor/`.

## Assets propios generados (public/media/guias/)
- `quitar-fondo-antes.jpg`, `quitar-fondo-despues.png` (recorte real transparente), `editor-recorte-ia.jpg`.
- Generados con Playwright + Chrome contra el editor (script en scratchpad `shoot.mjs`): cargar imagen → Recorte IA → export. El export tiene alpha limpio.

## Progreso (sesión 2026-07-28/29, PO eligió "todo a fondo")
- **22/25 guías ES** con el molde (capturas propias reales + "Lo probamos" único). Capturas generadas con Playwright contra el editor: recorte IA, fondo blanco/color, avatar circular, marca de agua, paleta+contraste WCAG, EXIF/metadatos, Icon Studio (128/64/48/32/16px), sticker con contorno, producto (manzana PD) sobre blanco, redimensionar.
- **About/Contact en EN y PT** creadas (/en/about, /en/contact, /pt/sobre, /pt/contato) y enlazadas en footers EN(17)/PT(5). En SEO_ROUTES.
- `/editor/` indexable con contenido + JSON-LD. Índices EN/PT con estilos. Trust footers ES (44).

## Pendiente
- **3 guías ES** sin molde (necesitan sujeto propio): `logo-con-fondo-transparente` (un logo), `quitar-fondo-a-una-firma` (una firma escaneada), `generar-modo-oscuro-desde-una-captura` (un screenshot de UI como input).
- **EN/PT: traducir las guías** (hoy EN/PT tienen 0 guías). Hacerlo por olas de calidad, reutilizando las capturas ya generadas, NO como dump masivo (riesgo scaled-content).
- Tras aplicar todo: **esperar 2-4 semanas** y recién ahí reaplicar a AdSense.

## Assets reutilizables en public/media/guias/
quitar-fondo-antes/despues, editor-recorte-ia, fondo-blanco, fondo-color, avatar-redondo, herramienta-{marca-de-agua,paleta,metadatos,iconos}, sticker-{whatsapp,telegram}, producto-blanco. Script de captura: scratchpad `shoot.mjs` (patrón: goto editor → setInputFiles → click "Recorte IA" → export/screenshot). Imagen de prueba: retrato PD de Obama; producto: manzana PD de Wikimedia.

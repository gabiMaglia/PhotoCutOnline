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

## Pendiente
- Escalar el molde al resto de guías ES núcleo (cambiar-fondo, producto, avatar redondo, etc.). Cambiar-fondo/producto/avatar necesitan capturas nuevas (export con color/imagen de fondo; recorte de producto; avatar circular).
- **Decisión PO:** alcance EN/PT (hoy 0 guías). Falta también About/Contact en EN/PT (los footers EN/PT enlazan solo a legales ES).
- Tras aplicar todo: **esperar 2-4 semanas** y recién ahí reaplicar a AdSense.

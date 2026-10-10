# GROW-34 — Verificación ciega (P-11/P-12, Adversarial)

- Fecha: 2026-10-10 · Verificador: nerv-verifier (ciego: sin informes ni narrativa del implementador)
- Objeto: `git diff 2c1b8eb 9d80d21` (mergeado; HEAD main `ca3d692`)
- Entorno: clon en scratchpad `…/scratchpad/verifier34/repo` @ca3d692; `npm run build` + `vite preview --port 4399`; base 2c1b8eb servida en :4400 para comparar. Chrome (channel chrome, Playwright 1.60) y Playwright WebKit (build mac14 2251, instalado solo en el scratchpad).
- Scripts del verificador (solo en el scratchpad, no en el repo): `scripts/pruebas/v34.mjs`, `v34b.mjs`, `v34c.mjs`, `v34g6.mjs`.

## Veredicto: **RECHAZADO**

## Resultado por garantía

| Garantía | Estado | Evidencia |
|---|---|---|
| G1 fondo exacto con plantilla | CUMPLE (Chrome) | `jsEngine.js:635-657` + `paintBackground` en `jsEngine.js:1006-1014`: el fondo sale de `opts.type/color/bgDataUrl` y nunca de `preset.bg`. Medido: Amazon con Color #12ab34 → PNG 2000×2000, 4 esquinas `#12ab34` a255. Original con #0a0b0c → esquinas `#0a0b0c`. IG post + Imagen → esquinas `#cfe0f0` (la imagen, no blanco). Avatar + #3366cc → esquinas a0, bordes del círculo `[51,102,204,255]`. WhatsApp + transparente → esquinas a0; WhatsApp + #00ff00 → `#00ff01` (WebP con pérdida; la garantía de HEX exacto es solo para PNG). |
| G2 aviso cuando la plantilla cambia el fondo | CUMPLE | `useExport.js:28-48`. Rojo → Amazon: aviso «El preset puso fondo blanco; podés cambiarlo» y el panel pasa a Color #ffffff. #12ab34 → Shopify: aviso. Imagen → IG: aviso, y se puede volver a Imagen (la imagen se conserva). Color → Avatar/WA/TG: aviso «…transparente…». Original: no cambia nada ni avisa. EN/PT a 390 px: aviso traducido, dentro del viewport (y=780, h=52 de 844) y sin scroll horizontal. El aviso dura 3,4 s (`useToasts.js:20`). |
| G3 Sticker WhatsApp WebP / Telegram PNG | **NO CUMPLE** | Chrome: WhatsApp → WebP 512×512 real (cabecera RIFF/WEBP), esquinas a0, proporción 0,6698 frente a 0,6715 de referencia; con un fondo de ruido el editor baja la calidad y avisa «Bajé la calidad a 82 %… 75 KB», y el archivo pesa 76 438 B. Telegram → PNG 512×512, a0. **WebKit: el archivo del preset WhatsApp es un PNG con extensión `.webp`** (ver D1). |
| G4 Sticker Studio eliminado | CUMPLE con un defecto bajo | Ninguna referencia en `src/`, `public/` ni `dist/` (grep). `?tab=stickers` cae en «cut» (`App.jsx:27-31`). `npm test` 238/238 + 63/63, `npm run test:web` «✓ todo verde». Queda texto viejo en `docs/ROADMAP.md:25-26,117` (D3). El build da 1 warning de Vite (jsEngine se importa de forma dinámica y estática), pero ya estaba igual en la base 2c1b8eb, así que no lo introdujo este cambio. |
| G5 guías verdaderas y reproducibles | **NO CUMPLE** | Reproducción: con `npm run pruebas` de los 4 slugs sobre HEAD, los `findings` salen idénticos a los de `scripts/pruebas.json`. Seguí al pie de la letra las guías de producto (Amazon → Color #ffffff ya puesto → JPEG) y de avatar (preset → después el color), y la de stickers: todas se cumplen en Chrome. Pero la guía de stickers en ES/EN/PT promete «Sale un WebP de 512×512» sin decir en qué navegador, y en WebKit (iPhone/Safari, y el escritorio Tauri en macOS) eso es falso (D1). Además el sitio afirma que funciona igual en iPhone (`public/guias/como-quitar-el-fondo-de-una-imagen.html`, FAQ). |
| G6 otros flujos sin cambios | CUMPLE (con una observación) | Base (:4400) contra HEAD (:4399), mismo flujo sin plantilla: el hash RGBA y los bytes son IDÉNTICOS en transparente PNG, transparente WebP, Color PNG, Color JPEG y desenfoque PNG. El lote usa `exportTransparent({format:"png"})` sin plantilla (`useBatch.js:35`). Icon Studio solo importa `loadHtmlImage` (`useIconStudio.js:10`). Observación en D2. |

## Defectos

**D1 — ALTA — G3/G5.** En WebKit, el preset «Sticker WhatsApp» descarga un PNG con extensión `.webp`.
- Dónde: `jsEngine.js:986-987` (`convertToBlob({type})` sin comprobar el MIME que devuelve) y `useExport.js:67-68,105-106` (nombre/extensión tomados de `effFormat`, no del blob real). `fitWithinBytes` baja la «calidad» 7 veces sobre un PNG, que no la usa.
- Reproducción (Playwright WebKit, viewport 1440 y 390, ES/EN/PT): retrato `quitar-fondo-antes.jpg` → Recorte IA → preset Sticker WhatsApp → Descargar. Sale `photocut-transparent.webp` con cabecera PNG, 168 096 B, y el aviso «Pesa 164 KB: no entra en el límite de 100 KB ni con la calidad mínima». En Chrome el mismo flujo da un WebP real de 26 256 B.
- Efecto: el usuario de iPhone o Safari que sigue la guía no obtiene un WebP. Recibe un aviso de peso engañoso (que no entra «ni con la calidad mínima»), cuando la causa es que el navegador no codifica WebP, y el archivo no sirve para WhatsApp.
- Supuesto marcado: lo medí en Playwright WebKit, no en Safari/iOS real. Que Safari tampoco codifique WebP en canvas lo infiero; no lo verifiqué.

**D2 — BAJA — G6/G2.** Elegir un sticker cambia el formato global y ese cambio queda al volver a «Original», sin aviso.
- `useExport.js:32` hace `setFormat(preset.format)`. Medido: Sticker WhatsApp → el botón de desenfoque exporta `photocut-blur.webp`. Al volver a Original queda el formato del último sticker (WEBP o PNG). El chip lo muestra, pero no hay aviso como sí lo hay para el fondo.

**D3 — BAJA — G4.** Texto sobrante de Sticker Studio en `docs/ROADMAP.md:25-26` y `:117`: lo describe como «construido, oculto tras `STICKERS_ENABLED`», y ni el flag ni el código existen ya. Es documentación interna, no la ve el usuario.

## Supuestos / observaciones (no son defectos)
- La rama «no entra ni con la calidad mínima» de `fitWithinBytes` no la pude disparar en Chrome con datos reales: con ruido entró a q=0,82. Está cubierta solo por `presets.test.js:40-43`.
- La sección «Lo probamos» de la guía de stickers firma `commit 767d6da`, anterior a `7a262d9` (que cambia `useExport`). Al volver a medir en HEAD da los mismos números.
- «Copiar al portapapeles» siempre copia el PNG transparente a tamaño original e ignora la plantilla y el fondo (`useExport.js:138-150`). Ya era así antes y no genera un archivo, así que queda fuera de G1.

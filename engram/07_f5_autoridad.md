# F5 — Autoridad e indexación (GROW-9)

> **Diagnóstico (2026-07-15, auditoría sobre el sitio en vivo):** el problema de
> las cero visitas **no es técnico**. 63/63 URLs responden 200, el texto está en
> el HTML crudo (no depende de JS), sin `noindex`, canonicals y hreflang
> correctos, robots `Allow: /` + Sitemap, apex→www con 308, og.png 1200×630.
> Google **puede** indexar todo. El problema es que **nadie enlaza al sitio**, y
> sin señales de que existís, Google rastrea poco y posiciona menos.
> Más contenido no arregla esto. Enlaces y solicitud de indexación, sí.

## Límite ético (no negociable)

**No se compran enlaces, no se intercambian, no se siembran comentarios y no se
postea fingiendo ser un usuario random.** Eso es un *link scheme*: penalización
de Google y, con AdSense ya rechazado una vez, un riesgo que no vale la pena.

Todo lo de abajo lo publica **el PO como autor del producto, diciendo que es
suyo**. Esa es la diferencia entre difundir y astroturfear. También es lo único
que funciona a largo plazo.

---

## Prioridad 1 — Indexación (gratis, inmediato, mayor impacto)

Sin esto, lo demás no rinde. Todo lo hace el PO (requiere sus cuentas).

1. **Search Console — crear la propiedad `www`.**
   Hoy la propiedad verificada no cubre el prefijo www, que es donde vive el
   sitio. Crear **propiedad de prefijo de URL** = `https://www.photocutapp.com/`.
2. **Enviar el sitemap:** `https://www.photocutapp.com/sitemap.xml` (63 URLs).
3. **Pedir indexación a mano** de las páginas que más importan, con
   *Inspección de URL → Solicitar indexación*. Empezar por estas 6:
   - `/` (home)
   - `/guias/quitar-la-ubicacion-de-una-foto.html`
   - `/guias/accesibilidad-de-color-contraste-y-daltonismo.html`
   - `/guias/como-elegir-una-paleta-de-colores.html`
   - `/herramientas/quitar-fondo.html`
   - `/herramientas/desenfocar-fondo.html`
4. **Bing Webmaster Tools:** alta + sitemap. Se importa desde Search Console en
   dos clics. Bing alimenta también a ChatGPT/Copilot, cada vez más relevante.

> **Medición:** en Search Console, *Páginas → Indexadas*. Si en 2–3 semanas no
> sube de forma sostenida, el cuello de botella es autoridad (prioridad 2), no
> rastreo.

## Prioridad 2 — Los primeros enlaces reales

El ángulo honesto y genuinamente interesante para audiencia técnica:
**un quita-fondos con IA que corre 100% en el navegador y nunca sube tu foto**
(WASM + ONNX). Eso es una decisión de arquitectura poco común y es verdad — no
hay que inflarla. Es la historia, no "otra herramienta gratis más".

- **Show HN / r/webdev / r/SideProject:** el PO postea como autor. Funciona si
  se cuenta el *cómo* (u2netp en onnxruntime-web, GrabCut en Rust/WASM, por qué
  local en vez de nube) y no si es un anuncio publicitario. Aceptar críticas.
- **Product Hunt:** requiere preparación (imágenes, primer comentario del maker,
  elegir el día). Un lanzamiento flojo se quema una sola vez — mejor hacerlo
  cuando haya tiempo de estar respondiendo todo el día.
- **Directorios de herramientas:** alta manual, enlace legítimo. Ojo: varios son
  sitios de "alternativas a X". Estar listado ahí **no** contradice la política
  de no hacer comparativas en nuestro sitio, pero es decisión del PO.

## Prioridad 3 — Que el contenido se gane los enlaces solo

Nadie enlaza una landing de producto; sí se enlaza algo útil. Las guías que
mejor funcionan para esto son las que resuelven un problema real y no dependen
de la marca:

- `quitar-la-ubicacion-de-una-foto` (privacidad, alta intención)
- `accesibilidad-de-color-contraste-y-daltonismo` (la citan desde comunidades de
  diseño/a11y)
- `medidas-de-iconos-de-app-ios-android-2026` (referencia que se comparte sola)

Mantenerlas actualizadas y con fecha visible vale más que diez guías nuevas.

---

## Estado

- [ ] Propiedad `www` en Search Console — **PO**
- [ ] Sitemap enviado — **PO**
- [ ] Indexación solicitada (6 URLs) — **PO**
- [ ] Bing Webmaster — **PO**
- [ ] Umami: `VITE_UMAMI_SRC` + `VITE_UMAMI_WEBSITE_ID` en Vercel + redeploy —
      **PO** (sin analítica no sabemos si algo de esto funciona)
- [ ] Re-aplicar a AdSense — **PO** (desbloqueado: 25 guías, 0 huérfanas)
- [ ] Show HN / Product Hunt — **PO decide cuándo**

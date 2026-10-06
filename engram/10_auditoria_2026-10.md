# Auditoría de calidad profesional + AdSense — 2026-10-06

> Spike ordenado por el PO tras el 7º rechazo de AdSense ("contenido de poco valor",
> siempre el mismo motivo). Datos del PO: ~50 clics en Search Console en 3 meses.
> Tres auditorías en paralelo sobre el SITIO EN VIVO (no el repo): QA adversarial
> de la app (nerv-qa), técnica/CWV (seo-technical), contenido (seo-content).
> Informes crudos + ~60 capturas + crawl.json + lighthouse en el scratchpad de la
> sesión (efímero); lo que importa está acá.

## 1. Veredicto

| Eje | Veredicto | Evidencia clave |
|---|---|---|
| **App** | **Profesional PARCIAL** | Núcleo sólido: Recorte IA, PNG con alpha real, Lote, Icon Studio, limpieza EXIF; 0 errores de consola, CLS 0, axe 0 violaciones. Pero los bordes fallan: Recuadro y Varita dan resultados invertidos/inútiles, 4 de 6 pestañas invisibles en móvil, texto ES en EN/PT, "Abrir foto" inaccesible por teclado. |
| **Técnica/SEO** | **Sin bloqueo de indexación** | 133/133 URLs 200, canónicos, hreflang recíproco, 0 noindex, 0 links rotos, 0 img sin alt, JSON-LD válido. Google puede indexar todo. |
| **Rendimiento** | **Móvil lento** | LCP 5,5–7,2 s en home/editor/guía ES (Lighthouse local, 1 corrida; PSI dio 429). Causa: Google Fonts render-blocking (876 ms) + ~250–300 KB de AdSense en TODAS las páginas. Escritorio 88–100. |
| **Contenido** | **Original pero genérico** | Duplicidad intra-sitio REFUTADA (máx. 3% shingles entre guías). Pero "Lo probamos" describe la UI en 23/25 guías, 3 guías reciclan la misma prueba, byline "equipo" en las 75, errores factuales (18 MB vs 4,6 MB), solo 3 fechas distintas en 75 artículos, sin changelog. |
| **AdSense** | **Causa real: eje "interés de usuarios" + "presencia constante"** | La política actual pide explícitamente "un nivel de interés por parte de los usuarios" y "mantenimiento estructural continuo". Con 50 clics/3 meses y lastmod idéntico (30-jul) en 133 URLs, no hay señal de ninguna de las dos. No se arregla con código. |

**Corrección a la memoria previa:** "no es tráfico" era cierto en la redacción vieja
de la política. La redacción vigente (texto literal del rechazo) incluye
"interés genuino de los usuarios que justifique una asociación publicitaria".
Tráfico/engagement SÍ cuenta.

## 2. Hallazgos priorizados (fusión de los 3 informes)

### Bloqueantes de percepción (lo que un revisor humano ve en 2 minutos)
| ID | Qué | Evidencia | Origen |
|---|---|---|---|
| B1 | Home y herramientas sin ninguna imagen del producto; el hero del landing es un damero vacío con etiquetas invertidas ("FONDO ORIGINAL" sobre la parte transparente) | 0 `<img>` en home/editor/herramientas; captura `shots/` | QA H-09, Tech T04 |
| B2 | Texto en español dentro de las versiones EN y PT del editor (bloque SEO bajo el editor + `<title>` de la pestaña) | QA H-06 | QA |
| B3 | Privacidad y Términos solo en ES; EN/PT enlazan la versión ES. Autor falta en 49/133 footers. Términos solo en 37/133 | Tech T03 | Tech |
| B4 | Móvil: solo se ven "Recorte · Editar"; las otras 4 pestañas quedan cortadas sin indicador de scroll (390 y 360 px) | QA H-05 | QA |
| B5 | LCP móvil 5,5–7,2 s (fonts bloqueantes + AdSense en todas las páginas) | Tech T01/T02 | Tech |
| B6 | Sitio parece abandonado: lastmod 2026-07-30 en 133/133, feed con una sola fecha, sin novedades/changelog, 50 guías "julio 2026" | Tech T10, Content C9/C11 | ambos |

### Importantes (producto)
| ID | Qué | Evidencia |
|---|---|---|
| P1 | "Abrir foto" no es alcanzable con Tab (a11y bloqueante real; axe no lo ve). Causa en `src/components/ui/FileButton.jsx` | QA H-01 |
| P2 | Recuadro NO separa fondo (es crop rectangular; blanco interior opaco, verificado píxel a píxel). Es el paso 2 del onboarding | QA H-03 (coincide con decisión vieja del PO "cutRect ya no segmenta" en D-05) |
| P3 | Varita hace lo inverso a lo que dice la guía (clic en fondo conserva fondo y borra el logo) | QA H-04 |
| P4 | Lote: "Descargar ZIP" activo mientras procesa → ZIP incompleto sin aviso | QA H-07 |
| P5 | Halo claro de 2–3 px en productos sobre blanco | QA H-08 |
| P6 | Onboarding no menciona Recorte IA (la promesa principal) | QA H-11 |
| P7 | Voseo y tuteo mezclados en app y guías ("Suelta una imagen aquí" + "Quitá el fondo"; "dibujas"/"exportás") | QA H-10, Content C6 |
| P8 | AdSense carga antes del consentimiento y sigue tras "Rechazar"; el banner del editor solo gobierna analítica y no menciona publicidad. Diseño actual: delega el banner GDPR en "Privacidad y mensajes" de la consola AdSense (lo sirve adsbygoogle.js). **PO debe confirmar si está activado.** En páginas estáticas no hay banner alguno | QA H-02, Tech T02 |
| P9 | Aviso "~18 MB" cuando se descargan ~7,3 MB (4,25 MB modelo + 3 MB runtime); mismo error en la guía flagship (18 vs 4,6 MB) | QA H-16, Content C5 |
| P10 | Sin barra de progreso en la carga del modelo; primer Recorte IA 4,5–15,7 s según corrida | QA H-17 |

### Importantes (contenido)
| ID | Qué | Evidencia |
|---|---|---|
| K1 | "Lo probamos" es descripción de UI, no medición, en 23/25 guías ES (+ traducciones). Solo ~5 bloques tienen un dato propio (335→204 KB, 1201×1500, 11,98:1…) | Content C2 |
| K2 | 3 guías reciclan la misma prueba (retrato 1201×1500, u2netp 4,6 MB, "fleco en los hombros") | Content C3 |
| K3 | Byline plural "Prueba del equipo de PhotoCut Studio…" ×75 cuando el autor es una persona; sin 1ª persona real | Content C4, Tech T14 |
| K4 | Canibalización por intención: 4 guías de "quitar fondo" compiten por la misma búsqueda; 5 de "fondo blanco/color"; 2 stickers; 2 perfil; 3 iconos/favicon | Content, lista de fusión |
| K5 | FAQ = ~23% de las palabras y repite el cuerpo (solape hasta 29%) | Content C8 |
| K6 | Medidas 2026 sin fuente oficial ni fecha de verificación; un bloque sin tildes | Content C7 |
| K7 | Autor: GitHub/LinkedIn/sitio enlazados pero sin trabajos citados ni por qué escribe de imagen | Content C13 |
| K8 | Sin `datePublished`/`dateModified` en Article | Content C9 |

### Menores
Títulos >60 car. en 103/133 y descriptions >160 en 118/133 · `/favicon.ico` 404 (icono es SVG data-URI, Google no lo usa) · `/editor/` sin og:image · hubs sin JSON-LD · variantes `/guias` y `/guias/` ambas 200 · RSS sin autodiscovery · avatar-redondo.png 325 KB sin WebP · nombres de descarga "Imagen actual-texto.png" · "1 cara(s) detectada(s)" · botones 26 px y atajos de teclado visibles en táctil · dos CTAs de donar siempre visibles · paleta repite #E9ECF1 · README de Icon Studio menciona `make_icons.py`.

### Lo que funciona y no hay que romper
Recorte IA (bordes buenos en retrato) · export JPEG se desactiva con alpha (evita fondo negro) · Lote con estados por archivo · Archivo avisa GPS y la copia sale limpia · Icon Studio set completo en 0,9 s · Censurar caras ~2 s · sistema visual consistente, foco visible · seguridad headers OK · ads.txt correcto · llms.txt · IndexNow key live · Umami live en todas las páginas.

## 3. Lo que NO es el problema (para no gastar ahí)
- Rastreo/indexabilidad técnica. Está bien.
- Contenido duplicado por plantilla. Medido: no existe.
- Cantidad de guías. Sobran, no faltan.
- Comparativas con competidores. Política permanente: no.

## 4. Plan propuesto para la 8ª solicitud (en este orden)

### Fase A — Percepción y producto (código; 2–3 sesiones)
1. Home/herramientas con antes/después REAL del producto (assets ya existen en public/media/guias/) + corregir etiquetas del hero. (B1)
2. Traducir el bloque SEO y el `<title>` del editor en EN/PT. (B2)
3. Privacidad + Términos en EN/PT con hreflang; footer único con Privacidad·Términos·Contacto·Acerca·Autor en las 133 páginas. (B3)
4. Navbar móvil: 6 pestañas visibles (scroll con indicador o 2 filas), targets 44 px, ocultar atajos en táctil. (B4)
5. Self-host de Spline Sans (woff2 + preload + swap); cargar adsbygoogle tras `load` y solo en páginas con slot (no en legales/autor). (B5, P8)
6. FileButton accesible por teclado. (P1)
7. Recuadro y Varita: arreglar o quitar del onboarding; onboarding centrado en Recorte IA. (P2, P3, P6)
8. ZIP de Lote deshabilitado hasta terminar. (P4)
9. Unificar registro (voseo o tuteo) en app + guías. (P7)
10. Corregir "18 MB" → "~7 MB" en UI y guía; progreso de carga del modelo. (P9, P10)
11. favicon.ico, og:image por defecto, lastmod real por archivo desde git. (menores + B6)

### Fase B — Contenido: menos y mejor (contenido; 2–3 sesiones)
1. Fusionar 25 → ~10–12 temas por idioma con 301 y sitemap actualizado (lista en informe de contenido: quitar-fondo ×4 → 1; fondo blanco/color ×5 → 1; stickers ×2 → 1; perfil ×2 → 1; iconos/favicon ×3 → 1). Mantener y profundizar: png-jpg-webp, EXIF/GPS, firma, marca de agua, accesibilidad+paleta, medidas-2026 con fuentes.
2. Reescribir cada "Lo probamos" con una medición propia y distinta (dispositivo, tiempo, KB, resultado, incluido un caso que salió mal), en 1ª persona, con fecha y versión. Borrar el byline plural.
3. `datePublished`/`dateModified` reales + página /novedades (changelog público) enlazada desde el footer: es la prueba de "mantenimiento continuo".
4. Quitar FAQs redundantes; citar fuentes oficiales en medidas; corregir tildes.
5. Autor: 2–3 trabajos verificables y por qué escribe de imagen.

### Fase C — Interés de usuarios (PO; es la que destraba AdSense)
1. **Publicar el launch kit** (engram/08_launch_kit.md): Show HN + r/privacy + r/webdev/SideProject + directorios. Recién DESPUÉS de Fase A (la primera impresión no se repite).
2. Search Console: pedir indexación de las URLs fusionadas/nuevas; Bing Webmaster + `npm run indexnow`.
3. Confirmar en consola AdSense: "Privacidad y mensajes" activado (CMP GDPR).
4. **Criterio para reaplicar (no por fecha, por números):** Umami ≥ 1.000 visitas/mes y ≥ 150 sesiones/mes en /editor/ sostenidas 4 semanas; Search Console ≥ 300 clics/mes con tendencia ascendente; ≥ 80% de las URLs del sitemap "Indexadas". Son umbrales heurísticos (Google no publica cifras), pero por debajo de eso la 8ª va a ser igual a las 7 anteriores.

## 5. Preguntas abiertas al PO
- ¿Se publicó algo del launch kit del 30-jul? (si no: el sitio nunca tuvo canal de entrada fuera de Google)
- Umami: visitantes/mes y cuántos llegan a /editor/.
- ¿"Privacidad y mensajes" está activado en la consola de AdSense?
- Aprobar Fase A → ticketizar (GROW-25…).

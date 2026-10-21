# QA GROW-39 — SEO sobre páginas con impresiones

Rama `seo/GROW-39-impresiones` (e243f73) vs main. nerv-qa, 2026-10-21. Nivel P-11 computado por nerv-gate: **A** (249 líneas reviewables), igual al declarado. Verificado desde el worktree de la rama; dist reconstruido (el dist del worktree estaba viejo: ver §Notas).

**Veredicto: RECHAZADO** (D1 proceso, D2 contenido, D3 criterio, D4 coherencia). Solo contenido/proceso; el fondo SEO está bien encaminado.

## §Plan
Gate nerv-gate → cotejo de cada medida con `src/lib/icons.js` → prueba en navegador (Chromium, 390×844) de la tabla, del CTA y de `/editor/?tab=icons` → JSON-LD/hreflang sobre `dist` → voseo/competidores por grep → `npm test` + `npm run test:web`.

## §GAP (Especificado vs Deducido)
- Especificado, implementado: title ≤60 / H1 con «tamaño»+«favicon» (ES 52, EN 46, PT 47 caracteres); description ≤155 (139/132/136); primer párrafo de 1–2 frases con las medidas; botón «Generar favicons» arriba y al final en ES/EN/PT; title/H1/description de fondo azul y medidas de iconos; sin páginas ni URLs nuevas; hreflang intacto en `dist`; `npm run lastmod` corrido (e243f73).
- Especificado, NO implementado: meta description con la medida de 16 px (D3).
- Deducido (a validar por el PO, no se vuelve caso de prueba): (a) se quitó «PhotoCut Studio» de los title; (b) tabla de medidas movida ARRIBA del preámbulo histórico («durante años…»); (c) la tabla de medidas-de-iconos-de-app es un resumen nuevo (5 filas) antes de la imagen; (d) cuadritos de color en las dos filas de azul; (e) HowTo ES pasa de 5 a 6 archivos.
- Pendiente de proceso: «Medir antes/después en GSC a 4 semanas» (no es de QA).

## §Casos (1:1 vs Gherkin)
| Criterio | Resultado |
|---|---|
| title ≤60 y H1 con tamaño+favicon (ES/EN/PT) | OK: «Tamaño de favicon: medidas en px y HTML listo (2026)» (52) · «Favicon size: dimensions in px and HTML (2026)» (46) · «Tamanho do favicon: medidas em px e HTML (2026)» (47) |
| description ≤155 con 16, 32, 48, 180, 192, 512 | **FALLA**: las 3 traen 32, 48, 180, 192/512 pero no 16 (D3) |
| primer párrafo responde en 1–2 frases | OK (1 frase + el .ico de 16/32/48) |
| tabla visible antes del primer scroll en 390×844 | PARCIAL, aceptado: medido con Chromium 390×844. ES y PT: la tabla empieza en y=630; entran el encabezado y la fila `favicon.ico` (16·32·48) completos y la fila `favicon-32.png` cortada (fila 2 termina en 848 > 844). EN: empieza en 594, entran 3 filas. El párrafo de apertura (arriba de la tabla) ya contiene 32/180/192/512 y la fila del .ico. Decisión: alcanza para «visible» (tabla arriba del scroll con las dos medidas que más buscan: 32 y .ico), sin ser completa; mejora no bloqueante: filas más bajas (hoy 89 px por salto de línea en la 2ª columna). Si el PO lee «visible» como «completa», es un cambio de criterio, no de QA |
| botón «Generar favicons» arriba y al final | OK ×3 (`href="/editor/?tab=icons"`, ES y PT también) |
| `/editor/?tab=icons` abre Icon Studio | OK, probado con Chromium sobre `dist` servido en puerto libre: la URL se mantiene, la pestaña activa es «Icon Studio» y el cuerpo muestra SOURCE/SETTINGS/PLATFORMS (iOS, Android…). Encima aparece el modal de bienvenida del editor (comportamiento existente, no del ticket). Lo lee `src/App.jsx:29-30` |
| medidas = Icon Studio, sin inventar | OK contra `icons.js`: .ico web 16/32/48 (l.460), favicon-32 PNG, apple-touch 180, icon-192/512, maskable 512 (l.448), iOS 1024 (+dark/tinted), Android legacy 48–192 y adaptive 432 y Play 512, macOS 16–1024 (10 archivos), Windows .ico 16/24/32/48/64/128/256. «80 % central» del maskable y «sin transparencia» del apple-touch son texto previo, no medidas de icons.js (el código usa padding 20 % por lado = 60 % central): deuda, no se introdujo ahora |
| fondo azul EN y medidas ES: title/H1/description + contenido antes del scroll | OK en medidas ES (tabla en y=671, 2 filas dentro; CTA a 1093) y en fondo azul (CTA en y=467). **Typo en el cuerpo nuevo** (D2) |
| sin páginas ni URLs nuevas; hreflang intacto | OK (`git diff --stat`: 11 archivos, todos existentes; `dist`: es/en/pt/x-default recíprocos en las 3 guías, es/en en blue-background) |
| JSON-LD válido y coherente con el texto visible | JSON-LD parsea (Article, HowTo, FAQPage, BreadcrumbList) y los headline coinciden con H1 en ES/EN/PT. Incoherencia menor en D4 |
| sin competidores | OK (grep de marcas: 0) |
| voseo ES | OK («necesitás», «Reuní», «Generalos»; infinitivos en botones) |
| `npm run lastmod` | OK (e243f73); `node --test` verifica fechas = manifiesto |

## §Defectos
1. **D1 [proceso, bloqueante]** nerv-gate: `REJECTED NO_TESTS` — «implementation changed with no test file touched (P-18.1)». El gate computa A, el return handoff tiene los 4 campos, files == diff, pero sin archivo de test tocado ni `.nerv-tdd-exempt` no hay gate PASS, y sin gate PASS no hay aprobación. Arreglo: o un test que fije lo nuevo (p. ej. en `scripts/`: title ≤60, description ≤155 y que contenga 16/32/48/180/192/512 en las 3 guías de favicons, CTA a `/editor/?tab=icons` arriba y al final, sin `the<strong>`), o declarar el motivo en `.nerv-tdd-exempt` si el PO lo acepta para tickets de contenido.
2. **D2 [contenido, bloqueante]** `public/en/tools/blue-background.html:106`: «the<strong>AI cutout</strong>» renderiza «theAI cutout» (falta el espacio). Texto nuevo del ticket, visible en el primer párrafo.
3. **D3 [criterio, bloqueante]** el Gherkin pide que la meta description traiga las medidas clave **16**, 32, 48, 180, 192, 512 px. Las 3 (ES, EN, PT) y sus og/twitter/Article description omiten 16 (solo dicen «48 px para el .ico»). Hay margen: 139/132/136 de 155. Aplica a `public/guias/favicons-medidas-y-html.html`, `public/en/guides/favicon-sizes-html.html`, `public/pt/guias/favicons-medidas-e-html.html`.
4. **D4 [coherencia, menor, entra en la misma reentrega]** el HowTo ES pasó a «6 archivos» pero el texto visible que describe la guía sigue diciendo «los 5 archivos que de verdad hacen falta»: tarjeta en `public/guias/medidas-de-iconos-de-app-ios-android-2026.html:366`, `public/guias/foto-de-perfil-redonda.html:302`, `public/guias/logo-con-fondo-transparente.html:261`, `public/guias/index.html:148` (+ EN/PT index). Igualar a un solo número en JSON-LD y texto (el cuerpo lo lista como 6 archivos: ico, 32, 180, 192, 512, maskable).

## Tests
- `npm test`: jest 62 suites / 439 tests verdes; `node --test scripts/` 98/98 (la 1ª corrida dio 97/98 por un `dist/` viejo del worktree, anterior a `lastmod.json`; con `dist` reconstruido, 98/98).
- `npm run test:web`: en el checkout principal (src/ y test/ sin diff contra la rama) Chrome + WebKit completo, exit 0, «todo verde». Desde el worktree de la rama solo falló `webp-retry-test [webkit]` (WEBP_ENCODE_FAILED, wasm mal servido por el symlink de node_modules: artefacto conocido del worktree, mismo caso que en BUG-13); no atribuible al ticket. Puerto libre, sin pkill.
- TDD (P-18): no hay tests nuevos; no se debilitó ninguna aserción (diff sin archivos de test). Es el motivo de D1.

## Notas / deuda (no bloqueante)
- Tabla Android de medidas-de-iconos desborda 15 px a 390 (scrollWidth 405): ya estaba, no es de la tabla nueva.
- «80 % central» (maskable) vs 60 % que exporta Icon Studio: revisar el texto o la fuente.
- Filas de la tabla nueva demasiado altas a 390 px; con una sola línea por celda entrarían 4–5 filas en el primer scroll.
- Falta `.nerv-tdd-exempt` para tickets de contenido (el gate seguirá rechazando).

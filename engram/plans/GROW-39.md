<!--
Para nerv-web: el gate lee engram/plans/GROW-39.md del checkout de la rama seo/GROW-39-impresiones
(sed /^## QUÉ/,/^## /). Traé este archivo a la rama (merge de main o copia TEXTUAL con su sello) y
completá «## CÓMO» con tu sello DENTRO de esa sección, ANTES de tocar public/ o scripts/ en el intento 2.
-->

# Plan — GROW-39 · SEO sobre las páginas que ya tienen impresiones

**Nivel (P-11):** **X por reintento.** Se declaró A y el gate computó A. El intento 1
(`seo/GROW-39-impresiones` @ e243f73) fue RECHAZADO por QA (D1–D4). Con ese rechazo contado, el intento 2
deriva X: van §QUÉ (arquitecto) y §CÓMO (nerv-web), los dos estampados antes del fix.

**Origen:** pedido del PO (2026-10-21, datos de GSC), fila GROW-39 y bloque Gherkin en
`engram/03_backlog.md`, `engram/qa/GROW-39.md` (D1–D4 y deudas), `src/lib/icons.js`.

**Cronología (P-21.2):** este §QUÉ se escribe el 2026-10-21, **después** del intento 1 y **antes** del
fix del intento 2. Cubre la solución completa, así que también valida lo que ya hizo el intento 1.

## QUÉ — diseño (arquitecto)

### Problema
Cinco páginas ya reciben impresiones en posiciones 55–73 y no reciben clics. Su title, su description
y su apertura no usan los términos con los que Google las muestra, y no dan la respuesta antes del
primer scroll. El intento 1 resolvió casi todo. Quedan cuatro defectos: no hay ningún test que fije el
contrato (D1), falta un espacio visible en blue-background (D2), las descriptions de favicons no
incluyen los 16 px (D3) y las tarjetas no coinciden con el número de archivos (D4). La causa de fondo
es que **el contrato no estaba escrito en ningún lado que se pudiera ejecutar**. Este plan lo escribe y
lo deja fijado en un test.

### 1. Fuente de verdad de las cifras: `src/lib/icons.js`
Toda medida en px que estas páginas afirman sale de lo que **exporta** Icon Studio. No sale de
documentación externa ni de la memoria:
- `WEB_PNGS`: favicon-16, favicon-32, favicon-48, apple-touch-icon-180, icon-192 e icon-512.
- `favicon.ico`: es el bucle `for (const size of [16, 32, 48])` de `buildIconZip`.
- `maskable-512.png`: 512.
- **Set web derivado = {16, 32, 48, 180, 192, 512}.** Es exactamente la lista del Gherkin. Si mañana
  cambia icons.js, el test tiene que fallar en las páginas. No alcanza con un literal copiado.
- **Archivos imprescindibles = 6:** `favicon.ico`, `favicon-32.png`, `apple-touch-icon-180.png`,
  `icon-192.png`, `icon-512.png` y `maskable-512.png`. Son las 6 filas de archivo de la tabla de la guía,
  en los tres idiomas. `site.webmanifest` y `snippet.html` son texto, no imágenes, y no entran en la
  cuenta.
- Para la guía de medidas de app valen las demás constantes: `IOS_LEGACY`/1024, `ANDROID_LEGACY` 48–192,
  `ANDROID_ADAPTIVE` 432, Play 512, `MACOS_SET` (10 archivos) e `ICO_SIZES` 16–256.

**Decisión:** el test lee `src/lib/icons.js` **como texto** y extrae los números con regex. Si la
extracción da vacío, el test falla con un mensaje claro y no pasa en silencio.
**Alternativa descartada:** exportar `WEB_PNGS` desde icons.js e importarlo en el test. Descartada
porque toca `src/`, que entra en el bundle del producto y queda fuera del alcance de un ticket de
contenido. Además icons.js importa `zip.js` y usa `document`, y no se puede importar limpio en
`node --test`.

### 2. Contrato SEO por página
Las longitudes se miden en caracteres Unicode (`[...s].length`) **después** de decodificar las entidades.
«Contiene» no distingue mayúsculas. Los textos propuestos son orientativos: nerv-web los puede ajustar
mientras cumpla la regla.

**Las tres guías de favicons** (las reglas son comunes a los tres idiomas):
- **title** ≤ 60 caracteres. ES: contiene «tamaño» y «favicon». EN: contiene «favicon size». PT:
  contiene «tamanho do favicon». Los title del intento 1 (52 / 46 / 47) cumplen y se quedan.
- **H1:** lleva los mismos términos que el title. Los del intento 1 cumplen y se quedan.
- **meta description** ≤ 155 caracteres. Contiene, como números enteros (`\b16\b` y así con cada uno),
  **todo el set derivado {16, 32, 48, 180, 192, 512}**. Esto es D3. Propuestas:
  - ES (132): «Tamaño de favicon en 2026: .ico de 16, 32 y 48 px, 32 px para la pestaña, 180 px para iOS y
    192/512 px para PWA. Tabla y HTML listo.»
  - EN (137): «Favicon size in 2026: a 16, 32 and 48 px .ico, 32 px for the tab, 180 px for iOS and
    192/512 px for PWAs. Size table and copy-ready HTML.»
  - PT (130): «Tamanho do favicon em 2026: .ico de 16, 32 e 48 px, 32 px para a aba, 180 px para iOS e
    192/512 px para PWA. Tabela e HTML pronto.»
- **Igualdades dentro de la página.** `og:description`, `twitter:description` (donde exista) y
  `Article.description` del JSON-LD son **idénticas** a la meta description. `og:title` y `twitter:title`
  son idénticos al title. `Article.headline` y el último ítem de `BreadcrumbList` son idénticos al H1, y
  también el `<span>` final de `nav.crumbs`. **Hallazgo nuevo:** en PT el breadcrumb (JSON-LD l.141 y
  `<span>` l.166) todavía dice «Favicons em 2026: os tamanhos que você precisa e o HTML…». Hay que
  corregirlo.
- **Párrafo de respuesta:** es el primer `<p>` después del H1 que no es `p.meta`. Tiene 1 o 2 frases,
  no tiene preámbulo y contiene todo el set derivado. Los del intento 1 cumplen.
- **Tabla:** es el primer `<table>` del `<main>` y va **antes** de la primera `<figure>` y del primer
  `<h2>`. Todo número de su primera columna pertenece al set derivado, sin inventar nada. Las filas de
  archivo son 6.
- **CTA:** al menos 2 enlaces a `/editor/?tab=icons`. Uno va entre el párrafo de respuesta y la tabla y
  el otro, después del último `<h2>` del cuerpo.

**`en/tools/blue-background.html`:**
- **title** ≤ 60 y contiene «blue background photo». El actual tiene 43 y cumple.
- **H1** contiene «blue background photo». El actual cumple.
- **meta description** ≤ 155 y contiene «blue background photo». La actual tiene 143 y cumple.
  `og:description` es idéntica.
- **Párrafo de respuesta:** es el primer `<p>` después del H1 que no es `p.meta`. Dice qué hace la
  herramienta, en 1 o 2 frases, **sin texto pegado a una etiqueta**. Esto es D2:
  «the<strong>AI cutout</strong>» pasa a ser «the <strong>AI cutout</strong>».
- **CTA** al editor: va antes del primer `<h2>`.

**`guias/medidas-de-iconos-de-app-ios-android-2026.html` (ES):**
- **title** ≤ 60 y contiene «medidas», «iconos» y «app». El actual tiene 56 y cumple.
- **H1** contiene «medidas de iconos de app». El actual cumple.
- **meta description** ≤ 155. Contiene «medidas de iconos de app» y las cifras 1024, 192, 432, 512 y 256,
  todas en icons.js. La actual tiene 140 y cumple.
- **Respuesta:** es la tabla resumen (5 filas: iOS, Android, macOS, Windows y Web), que va antes del
  primer CTA y de la primera `<figure>`. El párrafo de apertura **no se reescribe**: QA lo aceptó y el
  Gherkin pide «la herramienta o la tabla» antes del scroll, no un párrafo. Toda cifra de la tabla
  resumen pertenece a icons.js.

**Regla común a las 5 páginas:** no puede haber texto pegado a una etiqueta en línea. El patrón
`/[\p{L}\d]<(strong|em|code|a)\b/u` en el `<main>` da 0 resultados. La razón es que D2 apareció en
texto nuevo, y esto lo atrapa sin importar la página.

**Lo que el test no puede verificar** y queda para QA manual en Chromium a 390×844: que la tabla o la
herramienta se vean antes del primer scroll. El criterio aceptado es el de QA en el intento 1:
encabezado más al menos una fila completa.

### 3. Superficies secundarias que tienen que coincidir
Hay un solo número de archivos, **6**, en el JSON-LD y en el texto visible, en los tres idiomas. Hay un
solo título de tarjeta por idioma, igual al H1 de la guía o a una forma corta que contenga los términos
de búsqueda. Estas son las tarjetas que hoy dicen «5 archivos / 5 files / 5 arquivos» y pasan a 6 (D4):

| Archivo | Línea (rama) |
|---|---|
| `public/guias/index.html` | 148 |
| `public/guias/medidas-de-iconos-de-app-ios-android-2026.html` | 366 |
| `public/guias/foto-de-perfil-redonda.html` | 302 |
| `public/guias/logo-con-fondo-transparente.html` | 261 |
| `public/en/guides/index.html` | 121 |
| `public/pt/guias/index.html` | 121 |

El **HowTo de la guía ES** ya dice 6 y se queda así. Los HowTo de EN y PT no afirman ningún número y no
se tocan. Si nerv-web suma una cifra, tiene que ser 6.
Hay otras superficies que enlazan a las guías y **no afirman ningún número**: los `<li>` de
`en/index.html` y `pt/index.html` y las tarjetas de `en/guides/app-icon-sizes.html` y
`pt/guias/tamanhos-de-icones-de-app.html`. Se pueden alinear con el H1, pero el test no lo exige.
**Breadcrumb PT** (sección 2): es obligatorio.

### 4. Test que fija el contrato: `scripts/grow39-seo.test.mjs`
- Corre con `node --test`, porque `npm test` ya ejecuta `node --test scripts/`. No se agrega ninguna
  dependencia. Lee **`public/`**, la fuente, y no `dist/`: el contrato es sobre el contenido, y el `dist`
  viejo del worktree ya dio falsos rojos en el intento 1. Para el parseo alcanzan las regex y
  `JSON.parse` de los bloques `ld+json`, siguiendo el estilo de `guide-dates.test.mjs`. No hace falta
  un DOM.
- **Casos** (un `test()` por página y por regla, para que el rojo diga exactamente qué falla):
  1. **Set derivado de icons.js:** no está vacío y es igual a {16, 32, 48, 180, 192, 512}. Esto es un
     guardián: si icons.js cambia, el contrato se revisa a propósito.
  2. **Favicons ES/EN/PT:** title, H1, description (longitud, términos y set completo), las igualdades
     de og/twitter/Article/headline/breadcrumb, el párrafo de respuesta, la tabla (su posición, sus
     cifras ⊆ el set y sus 6 archivos) y los 2 CTA a `?tab=icons`.
  3. **Blue background EN:** title, H1, description y CTA.
  4. **Medidas de iconos ES:** title, H1, description (cifras ⊆ icons.js) y la tabla antes del CTA.
  5. **Sin texto pegado a etiquetas** en las 5 páginas.
  6. **Coherencia del número de archivos:** en las 6 superficies de la sección 3 y en el HowTo ES, toda
     frase del tipo «N archivos/files/arquivos» que hable de la guía de favicons tiene N = 6. Ningún
     archivo de `public/` contiene «5 archivos que de verdad», «5 files you really» ni «5 arquivos de
     que».
- **Cómo se demuestra el rojo (P-18):**
  1. Primer commit del intento 2: **solo el test**, sobre e243f73 y sin tocar `public/`.
  2. Correr `node --test scripts/grow39-seo.test.mjs`. Tiene que fallar **al menos** en: la description
     sin 16 ×3 (D3), «the<strong>» (D2), los «5 archivos» ×6 (D4) y el breadcrumb PT.
  3. Copiar esa salida roja (los nombres de los casos que fallan) al return P-1.
  4. Después, el fix en `public/`, en otro commit, y la misma corrida en verde.
  Un test que nace verde no prueba nada. Si algún caso de los cuatro anteriores no falla, el test está
  mal escrito.
- Además, `JSON.parse` de todo `ld+json` de las páginas tocadas. Esto ya lo cubre el caso 2 al leer
  Article y BreadcrumbList.

### 5. Qué NO se toca
- **El «80 % central» del maskable** contra el 60 % que exporta icons.js (padding de 20 % por lado): es
  deuda previa y **va como ticket aparte**, a pedir al orquestador. El intento 2 no cambia ese texto, y
  el test no afirma nada del maskable salvo que mide 512.
- «Sin transparencia» del apple-touch: es texto previo y no es una medida. Queda afuera.
- `src/` completo, `icons.js` incluido: es la fuente de verdad, no el objeto del cambio.
- No hay URLs nuevas, páginas nuevas ni cambios de slug. `hreflang` queda intacto.
- Los bloques «Lo probamos» (`class="tested"`, `.limit`, `.byline`) se generan desde `pruebas.json` y no
  se tocan. «11 archivos», «60 archivos» y «10 archivos» son mediciones o el iconset de macOS: no son
  la cuenta de imprescindibles.
- El alto de las filas de la tabla a 390 px y el desborde de 15 px de la tabla Android: son mejoras no
  bloqueantes de QA y quedan fuera de alcance.
- Las decisiones deducidas que QA aceptó en el intento 1 (quitar «PhotoCut Studio» de los title, poner
  la tabla arriba del preámbulo, la tabla resumen en medidas y los cuadritos de color) **se mantienen**.
- `.nerv-tdd-exempt`: no se crea, porque este ticket sí tiene un test.
- Se corre `npm run lastmod` después de commitear `public/`, y el commit del json lleva [lastmod-skip].
  `npm run indexnow` queda para el PO después del deploy.

### Riesgos
- **La regex sobre icons.js es frágil ante un refactor.** Está mitigada: si extrae vacío, falla fuerte,
  y el caso guardián (1) obliga a revisar el contrato. Es mejor un rojo ruidoso que una cifra inventada.
- **Falso positivo de texto pegado a etiquetas**, por ejemplo una `<a>` legítima después de un carácter
  de puntuación. El patrón solo mira letras y dígitos, y antes de `<a` en español va un espacio.

**Aprobado por:** nerv-arquitecto [2026-10-21] · arquitecto · alcance: diseño de la solución completa
de GROW-39 (el contrato SEO de las 5 páginas, icons.js como fuente de verdad, las superficies
secundarias, el test y su rojo, y las exclusiones). Escrito después del intento 1 (e243f73) y **antes**
del fix del intento 2. Deriva del Gherkin aprobado por el PO y de qa/GROW-39.md. No cubre el §CÓMO.

## CÓMO — implementación (nerv-web)

_Pendiente: lo escribe y lo estampa nerv-web antes de tocar `public/` o `scripts/`. Tiene que marcar qué
pasos son independientes y cuáles son seriales (P-24). El test va primero y en serie, y su rojo queda
demostrado antes del fix._

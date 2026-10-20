<!--
Para nerv-web: el gate lee engram/plans/BUG-14.md del checkout de la rama content/BUG-14-model-size
(sed /^## QUÉ/,/^## /). Traé este archivo a la rama (merge de main o copia TEXTUAL con su sello) y
completá «## CÓMO» con tu sello DENTRO de esa sección, ANTES de tocar public/ en el intento 2.
-->

# Plan — BUG-14 · Textos públicos sobre el peso del modelo, tras BUG-13

**Nivel (P-11):** **X por reintento.** Se declaró A. En el intento 1, nerv-gate computó **S** por path
sensible (`public/en/author.html`) y rechazó con PLAN_GATE_MISSING (D1). Con ese rechazo contado, el
intento 2 deriva X: van §QUÉ (arquitecto) y §CÓMO (nerv-web), los dos estampados antes del fix.

**Origen:** pedido del PO (2026-10-20), fila BUG-14 y bloque Gherkin en `engram/03_backlog.md`,
`engram/qa/BUG-14.md` (D1, D2) y la regla de dispositivo de BUG-13 (`engram/plans/BUG-13-QUE.md` §1, §3, §6).

**Cronología (P-21.2):** este §QUÉ se escribe el 2026-10-20, **después** del intento 1
(`content/BUG-14-model-size` @ 456d618 + 1e7c559) y **antes** del fix del intento 2. Cubre la
solución completa, así que también valida lo que ya hizo el intento 1.

## QUÉ — diseño (arquitecto)

### Problema
BUG-13 cambia el ruteo del modelo: **la clase de dispositivo decide antes que la GPU**. En celulares y
tablets siempre baja u2netp (~6 MB con su motor, según `scripts/pruebas.json`), aunque haya WebGPU.
BiRefNet-lite (~120 MB) baja solo en **computadoras** con GPU apta. Hay dos tipos de texto público que
quedan falsos:
- **La cifra:** «~7 MB» describía u2netp más el motor antes de la medición vigente.
- **La condición:** frases como «con GPU → BiRefNet; si no / otherwise / se não → u2netp» afirman que un
  celular con GPU baja ~120 MB. Esto es falso **aunque no aparezca ninguna cifra**.

### Regla única (la fuente de verdad del texto)
Toda afirmación pública sobre **qué modelo baja o cuánto pesa** dice, en sustancia:
> En computadoras con una GPU que el navegador puede usar (WebGPU): BiRefNet-lite, ~120 MB la primera
> vez. En celulares y tablets, o sin GPU apta: u2netp, ~6 MB con su motor. Se descarga una sola vez y
> queda cacheado.

El nivel de detalle se adapta a cada página. **La condición no puede omitir la clase de dispositivo:**
toda frase que condicione BiRefNet solo a la GPU, sin mencionar la computadora, es un defecto. Lo mismo
vale para el idioma: ES con voseo, EN y PT con la misma sustancia (en PT, «celulares e tablets»).

### Qué superficies deben decirlo (alcance cerrado)
| Superficie | Archivos | Qué cambia |
|---|---|---|
| Páginas de explicación | `public/como-funciona.html`, `public/en/how-it-works.html` (no existe PT) | Texto visible: la lista «IA de recorte» y «El intercambio». Cifra y condición. |
| FAQ / JSON-LD | Las mismas páginas, `FAQPage` → `acceptedAnswer.text` | Tiene que decir **lo mismo** que la pregunta visible equivalente. El JSON-LD tiene que seguir parseando. |
| llms.txt | `public/llms.txt` | Cifra y condición en la descripción. |
| Cuerpo de guías (fuera de «Lo probamos») | `public/guias/como-quitar-el-fondo-de-una-imagen.html` ~l.268, `public/en/guides/how-to-remove-image-background.html` ~l.248, `public/pt/guias/como-remover-fundo-de-imagem.html` ~l.249 | **D2:** reemplazar «si no / otherwise / se não, u2netp (~7&nbsp;MB)» por la regla única. Revisar también su FAQ/JSON-LD. Hoy no tienen «7», pero si afirman ruteo se alinean. |
| Páginas de autor | `public/autor.html`, `public/en/author.html`, `public/pt/autor.html` | Solo la **condición** («en computadoras» / «en celulares y tablets o cuando no»). Las cifras «~115 MB» y «4,6 MB» son del modelo solo, no de la descarga con motor: son coherentes con pruebas.json y **no** se cambian a 120/6. El orquestador mantiene este cambio (QA: dentro de criterio). |

El intento 1 ya resolvió las páginas de explicación, el FAQ, llms.txt y autor. El intento 2 agrega las
3 guías y vuelve a pasar la verificación sobre **todo** `public/`.

### Qué NO se toca
- **Entradas fechadas de novedades/changelog** (`public/novedades.html:69`, `public/en/changelog.html:69`,
  `public/pt/novidades.html:69`, «~7 MB»): son registro de lo que pasó.
- **Bloques «Lo probamos»** de las guías (los `<li>` medidos, `.limit` y `.byline`), generados desde
  `scripts/pruebas.json`: son lo que se midió. Por ejemplo, «Este equipo tiene GPU, así que la IA bajó
  BiRefNet-lite: 114,8 MB…» se queda como está.
- **Fuera de alcance**, porque no afirman cifra ni ruteo de modelo:
  - `public/acerca.html`, `public/en/about.html`, `public/pt/sobre.html`: «aceleración WebGPU/WebGL cuando
    el dispositivo lo permite» es genérico y sigue siendo cierto.
  - `public/sw.js`: es un comentario de código.
  - `public/licenses/ai-models-NOTICE.txt`.
- **`src/lib/i18n.js` (`ob.2.body*`)**: lo cubre la rama de BUG-13, no esta.
- **Mediciones de tiempo** «sin GPU, unos 3 s» en como-funciona y how-it-works: siguen siendo verdad,
  porque sin GPU corre u2netp.

### Criterio de verificación (reemplaza al grep literal del Gherkin, que no ve `&nbsp;`)
1. **Cifra.** El grep tiene que contemplar el espacio duro como carácter y como entidad. El patrón de
   abajo incluye U+00A0 y U+202F literales dentro de la clase:
   `grep -rnI -E "7(&nbsp;|&#160;|&#xa0;| | | )?MB" public`
   Equivalente portable sin caracteres invisibles:
   `perl -ne 'print "$ARGV:$.:$_" if /(?<![\d.,])7(?:\s|&nbsp;|&#160;|&#xa0;|\x{a0}|\x{202f}|\xc2\xa0|\xe2\x80\xaf)*MB/i; close ARGV if eof' $(grep -rlI MB public)`
   **Esperado:** solo las 3 entradas fechadas (`novedades.html:69`, `en/changelog.html:69`,
   `pt/novidades.html:69`) y nada dentro de «Lo probamos». Cualquier otro hit es un defecto.
2. **Condición.** Revisar a mano cada hit de
   `grep -rnI -E "u2netp|BiRefNet" public --include=*.html --include=*.txt`
   que no esté en «Lo probamos» ni en novedades/changelog. Ninguno puede rutear «por GPU» sin la clase de
   dispositivo. Señales de alarma: «si no», «otherwise», «se não», «cuando no» y «when it can't» sin
   «celulares/phones» al lado.
3. **FAQ = visible.** En cada página tocada, el `acceptedAnswer.text` del JSON-LD y la respuesta visible
   equivalente dicen lo mismo, y `JSON.parse` de cada bloque `ld+json` pasa.
4. **Fechas.** Correr `npm run lastmod` y commitear `scripts/lastmod.json` con [lastmod-skip]. `npm test`
   en verde.
5. **Gate.** `nerv-gate` sobre la rama tiene que pasar con nivel X, con este §QUÉ y el §CÓMO estampados
   en el `engram/plans/BUG-14.md` de la rama.

### Pase hostil
- **Grep ciego a entidades (causa de D2):** el criterio 1 cubre `&nbsp;`, `&#160;`, `&#xa0;` y los
  caracteres U+00A0/U+202F. El lookbehind evita falsos positivos como «17 MB» o «114,7 MB».
- **Corregir la cifra y dejar la condición falsa:** el criterio 2 existe para esto. «~6 MB» con «si no»
  sigue siendo falso en un celular con GPU.
- **Tocar «Lo probamos» por accidente:** el bloque se genera desde pruebas.json, así que una edición a
  mano se pisaría en el próximo `npm run pruebas:render` y además falsearía la medición. El diff no debe
  tocar `class="tested"`, `.limit` ni `.byline`.
- **Desfase con BUG-13:** si BUG-14 se mergea antes que BUG-13, el sitio afirmaría un ruteo que todavía
  no existe. Se mantiene el orden del handoff: BUG-14 se mergea después de BUG-13.
- **Cifras de autor (115 / 4,6) contra las explicativas (120 / 6):** no es una contradicción, son
  magnitudes distintas (modelo solo frente a descarga con motor). No se unifican.

**Aprobado por:** nerv-arquitecto [2026-10-20] · arquitecto · alcance: diseño de la solución completa de
BUG-14 (superficies, exclusiones y verificación), escrito después del intento 1 (456d618 + 1e7c559) y
**antes** del fix del intento 2. Deriva del Gherkin aprobado por el PO y de la regla de BUG-13. No cubre
el §CÓMO.

## CÓMO — implementación (nerv-web)

Solo contenido estático en `public/`; no hay código ni tests nuevos (el cambio es texto, la verificación son los greps del §QUÉ y `npm test` como regresión).

1. **Superficies ya hechas (intento 1, 456d618):** como-funciona, en/how-it-works (visible + FAQ JSON-LD), llms.txt, autor ×3. Se re-revisan con los greps.
2. **D2:** en las 3 guías, el párrafo del cuerpo (fuera de «Lo probamos») que dice «si no / otherwise / se não, u2netp (~7&nbsp;MB)» pasa a la regla única: computadora con GPU apta → BiRefNet-lite ~120 MB; celulares y tablets, o sin GPU apta → u2netp ~6 MB con su motor. Se revisa a mano su FAQ/JSON-LD.
3. **Barrido:** los dos greps del §QUÉ (cifra con `&nbsp;`, y condición `u2netp|BiRefNet`), cada hit revisado a mano; solo se corrige lo que esté fuera de «Lo probamos» y de novedades/changelog.
4. **No se toca:** `class="tested"`, `.limit`, `.byline`, novedades/changelog, cifras de autor (115 / 4,6), src/.
5. **Cierre:** `JSON.parse` de los ld+json de cada página tocada; `npm run lastmod` tras commitear las páginas y commit del json con [lastmod-skip]; `npm test`; `nerv-gate`.

**Aprobado por:** nerv-web [2026-10-20]

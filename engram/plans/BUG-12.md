# Plan — BUG-12 · Editor mobile sin foto: «asfixia»

**Nivel (P-11):** **X por reintento**: 2 veredictos RECHAZADO de QA en `engram/03_backlog.md`, así que el
gate deriva el intento #3. Se declaró A (solo CSS + 2 JSX, 270 líneas). Los dos rechazos fueron
**solo de proceso**. El intento 1 se rechazó porque el orquestador no registró el return handoff. El
intento 2 se rechazó porque, con ese rechazo contado, el gate computó X sin plan. QA no encontró
defectos de código en ninguno de los dos.

**Origen:** reporte del PO (2026-10-20, iPhone), fila BUG-12 y bloque Gherkin en `engram/03_backlog.md`.
Decisión del PO: «sin foto: solo el CTA», más los escenarios «header prolijo», «misma forma» y «pista
solo en táctil».

**Cronología (P-21.2, sin fingirla):** este §QUÉ se escribió **después** del código, el 2026-10-20,
sobre `fix/BUG-12-mobile-empty` @ d7ee4d9. Es la revisión de diseño post-hoc del arquitecto que
ADR-009 (NERV) prevé cuando la X viene del reintento. No precedió a la implementación. El desvío está
anotado en `engram/qa/_debt.md`.

## QUÉ — diseño (revisión post-hoc, ADR-009)

### Problema (medido, WebKit iPhone 15 390×659)
- `.canvas-empty` mide 311 px dentro de un `.canvas-wrap` de 237 px, así que el borde punteado y el
  texto quedan recortados.
- La `.rail` está fija en 46vh y, sin foto, muestra 6 herramientas desactivadas, todas inútiles.
- La topbar ocupa 2 filas (119 px). ☕ e ⓘ quedan a 2 px (`.topbar-icons gap:2px`), con `row-gap:6px` y
  un divisor vertical suelto.

### Solución como un todo
Solo hay capa FE: SPA estática, sin backend, contratos, datos ni dependencias. Se toca una sola fuente
de verdad de estado (`loader.imageUrl`), y todo el cambio visual queda confinado a `@media
(max-width:760px)` o a `@media (pointer: coarse)`.

1. **Sin foto, sin bandeja (móvil).** La bandeja se oculta con una clase derivada de `loader.imageUrl`.
   Es el mismo estado que habilita las herramientas, así que «bandeja visible» y «hay foto» no pueden
   divergir. La regla que la oculta vive solo en ≤760 px.
   Se descartó `:has()` en CSS sobre el lienzo, porque acopla el layout a la estructura del DOM del
   lienzo en vez de al estado. El estado es de React.
2. **Zona vacía a todo el alto (móvil).** `.canvas-empty` se estira (stretch, flex columna centrada,
   `box-sizing: border-box`) dentro del `.canvas-wrap`, que lleva 16 px de padding. Así el contenido
   nunca supera al contenedor y el borde punteado se ve en los 4 lados.
3. **CTA «Abrir foto».** Se reutiliza `FileButton` con el **mismo** handler (`loader.onFileInput`) y el
   mismo `accept` que el botón de la topbar, de modo que existe un solo camino de carga y no un segundo
   cargador. El texto reutiliza la clave `openPhoto`, sin i18n nuevo. Fuera de ≤760 px lleva
   `display:none`, así que en escritorio queda fuera del layout y del orden de Tab. Solo lo recibe la
   pestaña Recorte: el prop es opcional en `CanvasEditor`.
4. **Bandeja con foto.** Separación entre herramientas de 12 px y padding inferior de 28 px +
   safe-area, para que el último control no quede pegado al borde.
5. **Topbar móvil.**
   - Padding de 12/16 y `row-gap` de 12.
   - Una sola separación de 10 px en toda la fila (Abrir foto, idioma, ☕, ⓘ), sin divisor.
   - Idioma, ☕ e ⓘ con el mismo molde: círculo de 44×44 y radio 99px.
   - Las pestañas heredan el margen lateral de 16 px del padding de la topbar.
6. **Pista arrastrar/pegar.** Se oculta solo con `pointer: coarse`. El ancho no es la condición: una
   ventana angosta con mouse sí puede arrastrar.
7. **Escritorio sin cambios.** Fuera de ≤760 px solo se agregan la regla base
   `.canvas-empty-cta{display:none}` y la clase `rail-empty`, que ahí no tiene efecto.

### Pase hostil (estados imposibles, contratos)
- **Falla la carga** (archivo inválido): `imageUrl` sigue nulo, así que la bandeja sigue oculta y el CTA
  visible. Es correcto: no hay foto con la que usar las herramientas.
- **Dos `<input type=file>`** en el DOM, los dos con el mismo handler. En escritorio el del CTA está en
  `display:none`, así que no suma una parada de foco. En móvil hay dos caminos visibles a la misma
  acción, y es intencional.
- **Otras pestañas:** la regla móvil de `.canvas-empty` se comparte. QA midió que mejora el layout
  (deja de solaparse con la bandeja) y que no hay overflow horizontal. Lo que queda fuera de alcance
  está abajo.
- **Rango 761–980 px** (tablet o ventana mediana): sin foto la bandeja sigue visible. El Gherkin define
  solo 390 y 1280, así que esto no es un defecto; si el PO lo quiere, va como ticket aparte.
- **Laptop táctil con mouse:** `pointer` refleja el dispositivo primario (GAP deducido de QA) y no
  bloquea.

### Fuera de alcance (deuda ya anotada)
- Editar, Icon Studio y Color Studio siguen mostrando sin foto la bandeja desactivada.
- El ad slot `cut-rail` desaparece sin foto en móvil.
- Hay una aserción flaky («lienzo a >= 16 px de la topbar») en la primera carga en frío.

### Conformidad del código con este §QUÉ (rama `fix/BUG-12-mobile-empty` @ d7ee4d9)
| Escenario Gherkin | Implementación (file:line en la rama) | Test / medición |
|---|---|---|
| Sin foto: sin bandeja, zona a todo el alto, sin recorte | `CutoutPage.jsx:55` (clase `rail-empty` desde `loader.imageUrl`); `styles.css:2009-2011` (`.rail.rail-empty{display:none}` dentro de `@media (max-width:760px)` 1932); `styles.css:2053-2069` (wrap con padding 16 y `.canvas-empty` stretch/flex/border-box) | `test/mobile-empty-test.jsx:51,54-61` |
| CTA ≥ 44 px que abre el mismo selector | `CanvasEditor.jsx:40,552-556`; `CutoutPage.jsx:152` (`loader.onFileInput`); es el mismo handler que la topbar (`App.jsx:100`, `Topbar.jsx:77`); `styles.css:2071-2077` (min-height 52); `FileButton.jsx` (accept por defecto `image/*` en ambos) | `mobile-empty-test.jsx:65-70` |
| Con foto: bandeja con aire | `styles.css:2018` (gap 12), `2004` (padding inferior 28 + safe-area) | `mobile-empty-test.jsx:117-134` |
| Topbar con aire | `styles.css:3276-3281` (padding 12/16, row-gap 12), `1954-1968` (gap 10, sin divisor) | `mobile-empty-test.jsx:75-81` |
| Header prolijo | `styles.css:3278-3279`; `3329-3332` (min-height 44 en `.btn` y `.lang-select`); `1964-1968` (sin `border-left`); `.btn-icon-guides` oculto en ≤980 (`1927-1929`), así que la fila es Abrir foto/idioma/☕/ⓘ | `mobile-empty-test.jsx:84-95,109,126` |
| Misma forma idioma/☕/ⓘ | `styles.css:3334-3338` (`.btn-icon` 44×44) y `3345-3352` (`.lang-select` 44×44, radio 99px); base `.btn-icon` radio 99px (`styles.css:509-517`) | `mobile-empty-test.jsx:102` |
| Pista solo en táctil | `styles.css:3365-3372` (`@media (pointer: coarse)`); main no la ocultaba por ancho, así que no se agregó ninguna regla por ancho | `mobile-empty-test.jsx:107`; QA lo verificó con emulación `hasTouch` real |
| Escritorio sin cambios | `styles.css:656-658` (CTA oculto); el resto de las reglas solo aplica en ≤760 o con coarse | QA, intento 1: rects a 1280×800 idénticos entre main y la rama |
| Textos nuevos traducidos | No hay textos nuevos: se reutiliza `openPhoto` (`CanvasEditor.jsx:554`) | Se cumple sin cambios |

Veredicto del arquitecto: **el código cumple este §QUÉ**. No hay defecto estructural.

**Aprobado por:** nerv-arquitecto · arquitecto · 2026-10-20 · alcance: revisión de diseño post-hoc (ADR-009, X por reintento) de `fix/BUG-12-mobile-empty` @ d7ee4d9, derivada del Gherkin aprobado por el PO. **No precedió a la implementación.** No cubre el §CÓMO, que escribe y sella nerv-web declarando también su alcance post-hoc, ni commits posteriores a d7ee4d9.

## CÓMO — implementación (nerv-web)

Pendiente: lo escribe y lo sella nerv-web dentro de esta sección, antes del próximo `## `. Como el
código ya existe, el sello declara su alcance: describe lo implementado en 38e86a5, fb13ad5 y
d7ee4d9 y no precedió al código (P-21.2). No lleva fecha retroactiva.

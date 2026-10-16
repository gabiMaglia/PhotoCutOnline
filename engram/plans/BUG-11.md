# Plan — BUG-11 · Comparar antes/después «no se puede cerrar»

**Nivel (P-11):** Advisory (estimación provisional; el nivel autoritativo lo computa el gate sobre el
diff). CSS + manejo de teclado y estado de UI dentro de la página de Recorte; sin contratos, sin
dependencias, sin datos. El orquestador pidió plan P-19 para todos los BUG-* del sprint: §CÓMO lo
escribe y firma nerv-web; tests rojos primero.

**Origen:** Sprint 9 (engram/03_backlog.md, fila BUG-11). PO: «dale arreglá», «tiene que andar 100 de 100
antes de salir».

## QUÉ — diseño

### Problema (medido)
- **Botón vacío con el puntero encima.** `src/styles.css:770` `.hud-btn:hover:not(:disabled)`
  (especificidad 0,2,0) pone `color: var(--acid)`; `.hud-btn-on` (`styles.css:780`, 0,1,0) pone
  `background: var(--acid)`. Con el modo activo y el puntero encima gana el color del hover sobre el
  fondo del activo: lima `#d6f64b` sobre lima, contraste 1:1. Es justo el momento en que el usuario va a
  apagarlo, y ve un botón sin texto (verificado en captura).
- **Escape no cierra.** El manejador `escape` de la página (`CutoutPage.jsx:37-41`) cierra la vista
  previa, la carga grande y los modales; no toca `compare`. Solo el atajo C lo alterna
  (`CutoutPage.jsx:35`, `useKeyboardShortcuts.js:43-44`).
- **Sin cierre visible.** El overlay de comparación (`CanvasEditor.jsx:551-573`) tiene etiquetas
  Antes/Después con `pointer-events: none` (`styles.css:843`) y el divisor; ningún control de salida. El
  botón del HUD (`CanvasEditor.jsx:585-592`) dice siempre «◐ Comparar», encendido o no.
- **Pinceles bloqueados sin aviso.** Con `compare` activo, `handleDown` sale en silencio
  (`CanvasEditor.jsx:317`); el cursor pasa a `default` (`CanvasEditor.jsx:494-500`) y el usuario que elige
  «Conservar/Quitar» en el panel y pinta no obtiene nada ni sabe por qué. Elegir herramienta
  (`MarkPanel.jsx:44,53,60,63`) no sale del modo.

### Enfoque (la solución como un todo)
Una idea: **comparar es un modo de mirar; salir tiene que ser obvio, y cualquier intención de editar lo
termina o lo explica.**

1. **Estilo legible en los cuatro estados** (reposo/hover × apagado/encendido): el hover del botón
   encendido mantiene texto oscuro sobre lima (el hover se marca con borde/brillo, no cambiando el color
   del texto al del fondo). Contraste texto/fondo ≥ 4,5:1 (WCAG AA) en los cuatro; el actual encendido es
   ≈ 15:1 (`#10130a` sobre `#d6f64b`). La regla de hover no debe aplicar su `color` a `.hud-btn-on`.
   *Descartado:* subir la especificidad de `.hud-btn-on` con `!important` — tapa el síntoma y rompe el
   próximo estado que se agregue.
2. **El botón del HUD es el cierre visible.** Encendido, su texto pasa a «✕ Salir de comparar»
   (es) / «✕ Exit compare» (en) / «✕ Sair da comparação» (pt), con `aria-pressed="true"` como hoy; el
   tooltip menciona C y Esc. El HUD está anclado al contenedor del lienzo (`.canvas-hud`, `styles.css:747`),
   no al `.canvas-stage` que se desplaza con zoom/pan, así que siempre está a la vista. Área de toque
   ≥ 24×24 px (WCAG 2.5.8).
   *Descartado:* una ✕ en el divisor o en la etiqueta «Después» — viven dentro del stage (se van de la
   pantalla con zoom), competirían con el arrastre del divisor y en móvil serían blancos diminutos.
3. **Escape sale de comparar.** En el manejador `escape` de `CutoutPage` (la página es la dueña del
   teclado, `CutoutPage.jsx:20-21`), junto a lo que ya cierra. *Descartado:* un segundo listener de
   `keydown` en `CanvasEditor` — dos dueños de la misma tecla en `window`.
4. **Editar termina o explica el modo:**
   - Elegir una herramienta (botones de `MarkPanel` o atajos 1/2/3/W) **sale de comparar**. Solo las
     elecciones del usuario: los cambios de modo internos (p. ej. `useCutoutSession.js:68`, pasar a
     «Conservar» tras un recorte) no lo tocan.
   - Presionar sobre la imagen mientras se compara (fuera del divisor; pan con espacio, botón central y
     pinza de dos dedos siguen funcionando como hoy) **no pinta y muestra un aviso** visible y anunciado
     (`role="status"`): «Estás comparando: tocá ✕ Salir de comparar o Esc para editar» (es/en/pt), que se
     va solo a los ~2,5 s. *Descartado:* que tocar la imagen salga del modo — en móvil un toque que erra
     el divisor por poco apagaría la comparación sin querer.

### Contratos que cambian
- Ninguno entre capas. `CanvasEditor` puede necesitar una prop nueva para el aviso o reutilizar
  `onCompareChange`; el §CÓMO decide. Claves i18n nuevas en es/en/pt (sin claves huérfanas).

### Pruebas (criterios de aceptación; rojas primero contra `main` donde se indica)
- **C1 (roja hoy) hover real:** en el arnés, con el modo encendido, **hover de puntero real**
  (`page.hover` de Playwright, no simulación por clase: `:hover` no se puede forzar desde la página) sobre
  el botón ⇒ contraste entre `color` y `background-color` computados ≥ 4,5:1, y el texto del botón no
  está vacío. Mismo chequeo para los otros tres estados. El runner ya tiene el patrón de fases
  página↔runner (`run-tests.mjs:92-126`, `runRetry`): la página avisa «listo para hover», el runner hace
  hover y la página mide. Hoy: 1:1 ⇒ falla.
- **C2 (roja hoy) Escape:** `CutoutPage.test.jsx` (jest): con recorte y `compare` activo, `keydown`
  Escape ⇒ `compare` falso, y con foco en un `<input>` no se dispara (regla de `useKeyboardShortcuts.js:9`).
- **C3 (roja hoy) cierre visible:** `canvas-test`: encendido, el botón del HUD contiene «Salir de
  comparar» y al hacer clic se apaga; su caja está dentro del viewport del contenedor también con zoom
  400 % y pan a una esquina; ≥ 24×24 px.
- **C4 (roja hoy) herramienta sale:** jest: con `compare` activo, clic en «Conservar» / «Quitar» /
  «Rectángulo» / «Varita» del `MarkPanel` y los atajos 1/2/3/W ⇒ `compare` falso y el modo elegido
  activo. Un cambio de modo interno (fin de recorte) con `compare` activo lo deja activo.
- **C5 (roja hoy) aviso al pintar:** `canvas-test`: con `compare` activo, `pointerdown/move/up` sobre la
  imagen fuera del divisor ⇒ ningún trazo emitido (el callback de trazo no se llama) y aparece el aviso
  `role="status"` con el texto en el idioma de la UI; desaparece solo. Arrastrar el divisor no lo muestra.
- **Regresión:** los asserts actuales de comparar en `canvas-test` (`canvas-test.jsx:124-155`) siguen
  verdes; `mobile-test` (390 px) verde con el botón visible y tocable.
- `npm test` + `npm run test:web` verdes. Evidencia visual (P-21): captura del botón encendido con el
  puntero encima, en es y en en.

### Riesgos
- Bajo. Texto del botón más largo en encendido: en 390 px el HUD tiene además el badge de zoom; el
  §CÓMO verifica que no se parta en dos líneas ni tape la etiqueta «Después» (si pasa, en móvil «✕» +
  `aria-label` completo).
- Con un modal abierto encima y comparar activo, Esc cierra ambos a la vez: aceptado (caso raro e
  inocuo).

### Fuera de alcance
Teclado del divisor (flechas sobre el `role="slider"`), rediseño del HUD, comparar en otras herramientas
(Color Studio tiene su propio comparador).

**Aprobado por:** nerv-arquitecto · arquitecto · 2026-10-16

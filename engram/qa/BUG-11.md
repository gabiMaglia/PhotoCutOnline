# QA BUG-11 — Comparar antes/después «no se puede cerrar» (nerv-qa, 2026-10-16)

## Intento 1 — **RECHAZADO** · HEAD 46e3515 (nivel A Advisory, asignado por el orquestador)

El PO pidió «100 de 100», así que revisé con rigor. Casi todo cumple: contraste en los cuatro estados,
Escape, elegir herramienta, aviso, i18n y el hook. Falla un criterio explícito del contrato en la
app real: **a 390 px, con una foto vertical (el caso típico en un celular), el botón
«✕ Salir de comparar» tapa por completo la etiqueta «Después»**. La prueba del arnés da verde
porque usa una imagen apaisada, que no reproduce el caso. Ver D1.

`nerv-gate.sh` no existe en esta máquina (no está en `~/.nerv` ni en `~/.claude`). Como prueba de
rojo tomé la evidencia del implementador: `BUG-11-red-jest.txt` y `BUG-11-red-canvas.txt`. El nivel
es el que fijó el orquestador.

## §Plan

- **Diff revisado:** `git diff main...HEAD`, que toca 11 archivos.
- **Pruebas corridas por mí:**
  - `npm test`: 52 suites y 317 tests en jest, más 74 tests de node. Todo verde.
  - `npm run test:web` en el puerto 5187: «✓ todo verde», EXIT 0. Antes había otra corrida con una
    copia temporal del runner en el puerto 5291, porque el 5187 lo tenía ocupado el vite de otro
    worktree (`agent-ac71089e…`). Esa también salió verde. Las dos salidas están en el scratchpad.
- **Sonda propia en la app real**, con `vite dev` en los puertos 5293 a 5295 y Chrome por Playwright:
  - Pasos: cargar `dog.jpg` (vertical), aplicar Recorte IA y probar Comparar.
  - Configuraciones: escritorio 1440×900 (es), 1280×800 (en y pt), 390×844 táctil (es y pt) y
    768×1024.
  - También medí `main` (raíz del repo) en las mismas condiciones, para separar lo que es regresión
    de lo que ya pasaba antes.
- **Evidencia** en `/private/tmp/claude-501/-Users-gabrielsk-Documents-Proyects-photocut/edb53082-2b69-46d4-ada9-491c9f6f736d/scratchpad/qa-BUG-11/`:
  - Scripts: `app.mjs` y `rects.mjs`.
  - Salida de la sonda: `app-run-1.txt`.
  - Capturas `app-{es,en,pt}-on-hover.png`, `app-{es,en,pt}-hint.png`, `app-{es,pt}-390-on.png`,
    `app-{es,pt}-390-hint.png`, `branch-on-{390,768}.png` y `main-on-{390,768}.png`.
  - Salidas de las corridas web: `test-web-5187.txt` y `../qa-BUG-11-web-1.txt`.

## §GAP

| Escenario | Origen | Resultado |
|---|---|---|
| Contraste ≥ 4,5:1 en los 4 estados (on/off × hover/no) | Especificado C1 | OK: 7,62 / 16,55 / 15,31 / 15,31 en la app real (es); 15,31 encendido+hover en en y pt |
| Texto del botón encendido «✕ Salir de comparar» / «✕ Exit compare» / «✕ Sair da comparação», tooltip con Esc | Especificado C3 | OK |
| Botón dentro del lienzo con zoom 400 % + pan, ≥ 24×24 | Especificado C3 | OK (arnés: 158×30) |
| 390 px: una sola línea | Especificado C3 | OK (30 vs 30 px, es y pt) |
| **390 px: no tapa la etiqueta «Después»** | Especificado C3 + Riesgos §QUÉ | **FALLA en la app real (D1)** |
| Escape sale de comparar; con foco en un input no | Especificado C2 | OK (jest y app real: foco en el slider + Esc ⇒ sigue comparando) |
| Botones del rail y atajos 1/2/3/W salen de comparar; el `runOp` interno no | Especificado C4 | OK (jest; app real: «Pincel quitar», atajo 2 y Recorte IA con comparar activo, que lo deja activo) |
| Presionar la imagen comparando: no edita, aviso `role=status` + `aria-live=polite`, se va solo | Especificado C5 | OK (app real: el hash del canvas resultado no cambia; el aviso se va antes de 3 s) |
| Arrastrar el divisor y el pan con espacio no muestran el aviso | Especificado C5 + §QUÉ | OK (app real) |
| Con un modal abierto (ayuda «?»), Esc cierra el modal y comparar a la vez | Especificado (riesgo aceptado §QUÉ) | Confirmado |
| Escape con un `Dropdown` abierto también apaga comparar (`Dropdown.jsx:76` no detiene la propagación) | Deducido | Va al PO. Es el mismo caso que el del modal, que ya está aceptado |
| El aviso desaparece al salir con Esc y no reaparece al volver a encender | Deducido | OK |
| Atajos de la página de Recorte activos aunque la pestaña visible sea otra (preexistente: `useKeyboardShortcuts` no recibe `active`) | Deducido | Fuera de alcance, preexistente; va al PO |
| Ancho del aviso en móvil (D2) | Deducido | Va al PO, no bloquea |

No encontré definiciones sin implementar, salvo D1.

## §Casos (1:1 vs criterios)

| Criterio | Prueba | Resultado |
|---|---|---|
| C1 | `test/canvas-test.jsx` bug11(), con hover real del runner (`run-tests.mjs:175` `serveHover`). Rojo: 1,00:1 encendido+hover | Verde. App real: verde en es/en/pt |
| C2 | `CutoutPage.compare.test.jsx` «Escape apaga comparar» (rojo) y «con el foco en un input» (guarda de regresión) | Verde |
| C3 | `canvas-test.jsx:205-260` | Verde en el arnés. **Rojo en la app real a 390 px (D1)** |
| C4 | `CutoutPage.compare.test.jsx`: 4 botones + 4 atajos (rojos) y caso interno | Verde |
| C5 | `canvas-test.jsx:262-302`, con control positivo (sin comparar, el trazo se emite) | Verde. App real: verde |
| Hook | `useTimedFlag.test.js`: enciende/apaga, reinicio del plazo, `clear` y 0 timers vivos al desmontar | Verde |
| Regresión | asserts previos de comparar en canvas-test, `mobile-test` y resto de suites (Chrome + WebKit) | Verde |

**TDD (P-18):**
- La evidencia de rojo existe, y lo que estaba en rojo es justo lo que corrige el ticket:
  - jest: 9 fallidos y 2 que ya pasaban, que son las guardas de regresión.
  - canvas-test: 5 criterios rojos, contra 1,00:1 de contraste.
- Todos los tests nuevos tienen asserts con sentido. C5 incluye un control positivo, así que no es
  vacuo.
- No se debilitó ningún assert existente. El diff de `canvas-test.jsx` agrega checks y cambia los
  callbacks `() => {}` por contadores. En `run-tests.mjs` solo se envolvió la espera en un bucle.

## §Defectos

### D1 — Mayor (bloquea) · C3 «no tapa la etiqueta «Después»» incumplido en la app real; el test da falso verde

- **Dónde:**
  - La etiqueta es `src/styles.css:861-882` (`.compare-tag`, que va al tope del stage con `top: 10px`
    y `z-index: 15`).
  - El HUD es `src/styles.css:747-754` (`.canvas-hud`, anclado arriba a la derecha de `.canvas-wrap`
    con `z-index: 30`).
  - El texto del botón es `src/features/cutout/CanvasEditor.jsx:610`.
- **Qué falla:** probé a 390×844, en es, con la foto vertical `dog.jpg` y Recorte IA. Con comparar
  encendido, el botón ocupa [157,133 → 314,163] y la etiqueta «Después» [230,145 → 299,165]. La
  etiqueta queda debajo del botón por completo y no se ve. En pt pasa lo mismo (captura
  `app-pt-390-hint.png`). En `main` el botón «◐ Comparar» [219 → 314] ya la tapaba, así que es
  preexistente. Pero el contrato de este ticket pide explícitamente que no la tape: §QUÉ Riesgos y
  §CÓMO tarea 1/C3. A 768 px y en escritorio no se superpone.
- **Por qué el test pasa:** `test/canvas-test.jsx:49` usa `imageSize` de 400×300, que es apaisada.
  En la caja de 390×500 (`canvas-test.jsx:246`) el stage queda centrado en vertical, la etiqueta
  cae debajo del HUD y el check de `canvas-test.jsx:256` da verde. Con una foto vertical, que es el
  caso normal en un celular, el stage empieza arriba de todo, al nivel del HUD.
- **Criterio violado:** C3 (§CÓMO: «no se superpone a la etiqueta «Después»») y el riesgo de §QUÉ.
  Para este caso el contrato ya preveía «en móvil «✕» + `aria-label` completo», o bien mover las
  etiquetas o el HUD.
- **Para cerrar:** corregir el layout y además cubrir el caso en el test. El check de C3 móvil tiene
  que correr también con una imagen vertical (por ejemplo 300×400 en 390×500) y dar rojo con el
  código actual.

### D2 — Menor (no bloquea; corregir de paso o pasar a deuda) · el aviso en móvil usa la mitad del ancho

- **Dónde:** `src/styles.css:800-802` (`.compare-hint`: `left: 50%`, `transform: translateX(-50%)`,
  `max-width: calc(100% - 28px)`).
- **Qué pasa:** un bloque absoluto con `left: 50%` ajusta su ancho al espacio que queda a la
  derecha, que es el 50 % del lienzo. A 390 px el aviso mide 195 px y se parte en 3 líneas en es y 4
  en pt (captura `app-pt-390-hint.png`), tapando el centro de la foto. El `max-width` que se buscaba
  nunca entra en juego. En escritorio no se nota (444 px).
- No viola ningún criterio, porque el aviso se ve y se lee. Lo reporto porque el PO pidió «100 de
  100».

### Observaciones (no son defectos de este ticket)

- **Puerto fijo:** `test/run-tests.mjs:14` fija el puerto en 5187. Si otro agente tiene un vite en
  ese puerto, el `vite --strictPort` propio falla en silencio (`stdio: "ignore"`) y `waitForServer`
  queda contestado por el servidor **del otro worktree**. Las suites corren entonces contra otro
  código y pueden dar un verde falso. Recomiendo un ticket de deuda para que el puerto sea
  configurable o se aborte si el puerto ya está ocupado.
- **Tiempo de espera en el runner:** el bucle de `run-tests.mjs:145-154` reinicia `TIMEOUT_MS` en
  cada fase de hover, así que el límite queda por fase y no por suite. Un fallo de `page.hover` (30 s
  por defecto) se reporta como «TIMEOUT esperando ALL_DONE». Igual da rojo, pero el mensaje engaña.
  Es menor.
- **Borde sin efecto visible:** `CanvasEditor.jsx:423-426`. Si se mantiene apretada la imagen y se
  apaga comparar con C, al soltar se llama a `flashHint()`. No se ve porque el render está guardado
  por `compare && hintOn`, pero si comparar se vuelve a encender antes de 2,5 s, el aviso aparece
  sin motivo. Es improbable.
- **Fuera de alcance:** el hover del botón apagado (`.hud-btn:not(.hud-btn-on):hover`) y el anillo
  del encendido están bien. Falta `:focus-visible` propio en `.hud-btn`, pero eso ya estaba fuera
  del alcance de este ticket.

## Veredicto

**RECHAZADO (intento 1).**
1. D1: `src/styles.css:747-754` / `:861-882` y `CanvasEditor.jsx:610`. A 390 px con una foto
   vertical, el botón «✕ Salir de comparar» tapa la etiqueta «Después», lo que viola C3 y el riesgo
   de §QUÉ. El check `test/canvas-test.jsx:256` da falso verde por usar una imagen apaisada
   (`:49`).

D2 no bloquea: puede corregirse en el mismo intento o pasar a `_debt.md`.

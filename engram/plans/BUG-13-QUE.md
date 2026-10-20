<!--
Para nerv-web: copiá la sección «## QUÉ …» de abajo, TEXTUAL y con su sello, en
engram/plans/BUG-13.md de la rama fix/BUG-13-mobile-ai, ANTES de «## CÓMO». El gate solo lee
engram/plans/BUG-13.md del checkout de la rama (sed /^## QUÉ/,/^## /), así que este archivo no
cuenta para el gate: es la fuente estampada en main. Además, el sello de nerv-web tiene que quedar
DENTRO de «## CÓMO», antes de «## Ampliación…». Por ejemplo, bajando «Ampliación» a «###» o
repitiendo el sello antes de ella.
-->

## QUÉ — diseño (revisión post-hoc del arquitecto, ADR-009)

**Por qué existe esta sección:** el gate computa **X por reintento** porque hay 2 veredictos
RECHAZADO de QA, los dos solo de proceso, y deriva el intento #3. Esta sección se escribió el
2026-10-20, **después** del código, sobre `fix/BUG-13-mobile-ai` @ c3dfaed, desde el Gherkin aprobado
por el PO (con la corrección G1 del orquestador). No precedió a la implementación. El desvío está
anotado en `engram/qa/_debt.md`.

### Problema
iOS 26 expone WebGPU con shader-f16, así que `gpuUsable()` elige BiRefNet (115 MB de modelo y unos
535 MB de memoria wasm). iOS mata el proceso (jetsam) **sin lanzar ninguna excepción**, de modo que el
respaldo a u2netp nunca corre. Como nada persiste, cada intento repite el mismo camino. Bloquea el
lanzamiento.

### Solución como un todo
Solo hay capa FE, en el hilo principal y en el worker. No hay backend ni dependencias nuevas.

1. **La clase de dispositivo decide antes que la GPU.** En celulares y tablets, BiRefNet no se abre
   nunca, aunque haya GPU apta. «Móvil» se evalúa **antes** de consultar la GPU y el almacenamiento,
   así que en un celular no se pide ninguna URL `/models/birefnet-*` ni se toca IndexedDB.
2. **El veredicto de «móvil» lo calcula el hilo principal y viaja en los args.**
   - `WorkerNavigator` no tiene `maxTouchPoints`, y el worker no tiene `screen`. Sin ellos no se puede
     detectar un iPadOS que se presenta como Mac ni un Android en modo «Sitio de escritorio».
   - Por eso `backend.js` calcula `mobile` y lo manda en `warmupAi`, `aiCut` y `removeBg`, que son las
     3 únicas entradas a la IA.
   - El worker combina ese veredicto con su propio UA en un **OR**: gana «móvil». El error que se
     tolera es el seguro, porque u2netp es el modelo que no mata la pestaña.
   - Se descartó medir la memoria (`deviceMemory`, `adapter.limits`): iOS no la expone de forma
     fiable y no predice el jetsam.
3. **La regla de dispositivo** (una función pura, testeable) considera móvil:
   - `userAgentData.mobile`;
   - un UA con iPhone, iPad, iPod, Android o Mobile;
   - un dispositivo táctil (`maxTouchPoints > 1`) con UA o plataforma de Mac (iPadOS), porque las Mac
     no tienen pantalla táctil (G1);
   - un dispositivo táctil con UA de Linux sin «Android» (Chrome Android en «Sitio de escritorio»);
   - un dispositivo táctil con el lado corto de `screen` ≤ 600 px.

   Una laptop Windows táctil con pantalla de 1366×768 o mayor **no** cuenta como móvil. Una laptop
   Linux táctil sí cae en u2netp: es un riesgo que el PO aceptó.
4. **Marca persistente de «intento en curso».** Es la única defensa contra la muerte sin excepción.
   - Se guarda en IndexedDB, que existe en el worker y sobrevive a recargas y sesiones. Se descartó
     `localStorage` porque no existe en el worker.
   - Se escribe y se confirma (`tx.oncomplete`) **antes** de cada fase que puede matar el proceso:
     crear la sesión de BiRefNet y cada `run`.
   - Se borra cuando esa fase termina bien. Por eso precargar y cerrar la pestaña no castiga.
   - Guarda un timestamp y vence a los 7 días: una marca vencida, futura o ilegible se ignora.
   - Solo se lee si hay GPU apta.
   - Si el almacenamiento no está disponible, colgado o lanza errores, cada operación se rinde a los
     2 s con un valor neutro. La decisión cae entonces a la regla del dispositivo y el editor sigue.
5. **Orden de la decisión:** respaldo pegajoso, después móvil, después sin GPU apta, después marca
   vigente. Cualquiera de esas condiciones lleva a u2netp; si no se cumple ninguna, se usa BiRefNet, y
   si BiRefNet falla de forma atrapable, se sigue con el respaldo de siempre (GROW-36).
6. **Textos.** El onboarding ES/EN/PT (`ob.2.body`, `ob.2.body.touch`) dice «~6 MB en el celular» y
   «~120 MB solo en computadoras con GPU».

### Pase hostil
- **Una entrada sin veredicto** (worker en un iPad «Mac» que no recibe `mobile`) llevaría a BiRefNet y
  de nuevo a jetsam. Verificado: las 5 llamadas de producto pasan por `backend`, que siempre manda
  `mobile` (`useCutoutSession.js:106,109`, `useIconStudio.js:91,106`, `useBatch.js:36`, que van a
  `backend.js:299,304,318`). El worker lo aplica en las 3 entradas (`cutoutWorker.js:101,108,118`), y
  el camino inline también (`backend.js:163,169,183`). No hay estado imposible.
- **Muerte durante la descarga** (115 MB más el sha256 antes de la marca): solo puede pasar en
  computadoras, porque los celulares no llegan a ese punto. En una computadora con poca memoria podría
  repetirse el ciclo. Es un riesgo residual bajo, fuera del Gherkin, y queda anotado.
- **IndexedDB colgado:** `hasAttempt` devuelve false a los 2 s, así que una computadora con una marca
  vigente puede volver a intentar BiRefNet. Es exactamente lo que dice el Gherkin («almacenamiento no
  disponible ⇒ regla del dispositivo»). El costo de latencia es O1, deuda ya anotada.
- **Dos pestañas** comparten la marca (O2, deuda ya anotada).
- **Una falla atrapable de BiRefNet deja la marca** hasta que vence a los 7 días. Es conservador y
  coherente con el respaldo pegajoso.
- **Texto público fuera del editor:** `public/como-funciona.html:53` y `public/en/how-it-works.html:53`
  siguen diciendo «si tu equipo tiene GPU ⇒ BiRefNet ~120 MB; si no ⇒ ~7 MB». Para un celular con GPU
  ya no es exacto. El Gherkin solo alcanza los «textos del editor», así que **no bloquea**: va al PO
  como deuda de contenido.

### Fuera de alcance
- Estilos, guías y el arnés «Lo probamos».
- El jetsam real no se puede reproducir en CI: la verificación final la hace el PO en un iPhone 13
  con WebGPU **activado**.

### Conformidad del código con este §QUÉ (rama `fix/BUG-13-mobile-ai` @ c3dfaed)
| Escenario Gherkin | Implementación (file:line en la rama) | Test |
|---|---|---|
| Celular o tablet con WebGPU ⇒ u2netp, sin `/models/birefnet-*` | `aiSegmenter.js:251` (`isMobile()` antes de `gpuUsable()`), `79-83` (hint OR UA propio); `deviceClass.js:13,15,19` | `deviceClass.test.js`, `aiSegmenter.test.js`; Playwright con UA de iPhone (`test/run-tests.mjs:65-78`: falla si se pide `/models/birefnet-`) |
| Computadora con GPU apta ⇒ BiRefNet | `deviceClass.js:17-18` (sin táctil ⇒ no es móvil); `aiSegmenter.js:251-255` | `aiSegmenter.test.js` («escritorio sigue en BiRefNet») |
| La pestaña muere abriendo BiRefNet ⇒ la próxima vez, u2netp | `aiSegmenter.js:218` (marca confirmada antes de `create`), `422` (antes de `run`), `251` (`hasAttempt`); `aiAttemptMark.js:62` (put con timestamp); `safe`/`withTimeout` (sin almacenamiento ⇒ valor neutro) | `aiAttemptMark.test.js` (persistencia, sin `indexedDB`, `open` que lanza, `open` colgado) |
| La marca vence a los 7 días | `aiAttemptMark.js:14` (`MARK_TTL_MS`), `53-58` (0 ≤ edad ≤ TTL) | `aiAttemptMark.test.js` (6 días vigente, 7 días + 1 ms ignorada, futura o `true` ignoradas). Hueco G3 de QA: no hay test del cableado TTL a nivel `aiSegmenter`; es deuda y no bloquea |
| Android en «Sitio de escritorio» ⇒ móvil; laptop Windows táctil 1366×768 ⇒ BiRefNet | `deviceClass.js:21` (Linux sin Android), `23-25` (lado corto ≤ 600); `backend.js:299,304,318` (`screen` del hilo principal) | `deviceClass.test.js` (borde 600, 1366×768, 1920×1080, sin táctil) |
| Un BiRefNet exitoso limpia la marca | `aiSegmenter.js:420-426` (`segmentTracked`: marcar, segmentar, limpiar), `224` (limpia también al abrir la sesión sin morir) | `aiSegmenter.test.js` («un BiRefNet exitoso limpia…») |
| Textos honestos sobre el peso | `i18n.js:415-416` (ES), `871-872` (EN), `1327-1328` (PT) | `i18n.test.js` (dice «~6 MB», no dice «~7 MB», y ata ~120 MB a computadoras con GPU) |

Veredicto del arquitecto: **el código cumple este §QUÉ**. No hay defecto estructural. Los 2 riesgos
residuales (muerte durante la descarga en una computadora y el texto público de cómo-funciona) quedan
fuera del Gherkin y van como deuda.

**Aprobado por:** nerv-arquitecto · arquitecto · 2026-10-20 · alcance: revisión de diseño post-hoc (ADR-009, X por reintento) de `fix/BUG-13-mobile-ai` @ c3dfaed, derivada del Gherkin aprobado por el PO (con la corrección G1). **No precedió a la implementación.** No cubre el §CÓMO (lo sella nerv-web dentro de `## CÓMO`), ni commits posteriores a c3dfaed, ni el jetsam real (lo verifica el PO en el iPhone 13).

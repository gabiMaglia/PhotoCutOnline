# Plan — BUG-13 · Recorte IA no tumba la pestaña en celulares

**Nivel (P-11):** Strong (ruta de IA, bloquea el lanzamiento). Sin dependencias nuevas.

## Causa (confirmada por el PO, iPhone 13)
iOS 26 expone WebGPU + shader-f16 ⇒ `gpuUsable()` elige BiRefNet (115 MB, ~535 MB de wasm) ⇒ iOS mata el
proceso por memoria (jetsam). No hay excepción: el respaldo a u2netp nunca corre y nada persiste ⇒ bucle.

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

## CÓMO
1. **Regla de dispositivo** — `src/lib/deviceClass.js`: `isMobileDevice(nav)` pura. Móvil si
   `userAgentData.mobile`, o UA `iPhone|iPad|iPod|Android|Mobile`, o UA/plataforma Mac con
   `maxTouchPoints > 1` (iPadOS se presenta como Mac). Verificado en MDN: `WorkerNavigator` solo tiene
   userAgent/platform/hardwareConcurrency/onLine… **sin `maxTouchPoints` ni `matchMedia`** ⇒ el iPad «Mac»
   no se detecta dentro del worker. Por eso el hilo principal calcula `mobile` y lo manda en los args de
   `warmupAi`/`aiCut`/`removeBg` (`backend.js`); el worker/aiSegmenter lo recibe con
   `setDeviceHint(mobile)` (el worker además aplica la regla a su propio `navigator`; gana «móvil» si
   cualquiera de los dos lo dice). Los args solo se agregan a esos 3 comandos (no se toca el resto).
2. **Marca persistente** — `src/lib/aiAttemptMark.js` sobre IndexedDB (existe en workers y en el hilo
   principal; `localStorage` no existe en el worker). DB `photocut-ai`, store `flags`, clave
   `birefnet-attempt`. `markAttempt()` resuelve en `tx.oncomplete` (la escritura queda confirmada ANTES de
   la fase pesada); `clearAttempt()`; `hasAttempt()`. Todo envuelto en try/catch y con timeout corto: sin
   IDB (modo privado, bloqueado, error) ⇒ `hasAttempt()=false`, mark/clear no-ops ⇒ la decisión cae a la
   regla del dispositivo y el editor sigue.
3. **Decisión** (`openPreferred`): `usingFallback || mobile || await hasAttempt() || !gpuUsable()` ⇒ u2netp.
   Móvil se evalúa primero: no pide `/models/birefnet-*` ni toca IDB.
4. **Cuándo se marca/limpia:** se marca justo antes de `InferenceSession.create` de BiRefNet (la descarga
   no mata el proceso: cerrar la pestaña bajando no debe castigar) y otra vez, idempotente, antes de cada
   `run` de BiRefNet. Se limpia al terminar bien un `segment` con BiRefNet. Si falla con error atrapable se
   deja la marca (conservador: el respaldo ya es pegajoso en memoria; persiste para no volver a bajar
   115 MB). Riesgo anotado: una marca huérfana en una compu deja u2netp para siempre (sin TTL, por criterio).
5. **Textos** (`i18n.js`, `ob.2.body` y `ob.2.body.touch`, ES/EN/PT): ~120 MB solo en computadoras con GPU;
   en el celular ~6 MB. (BUG-12 toca otras claves del mismo archivo: cambios acotados a esas 6 líneas.)
6. **Tests (rojo contra main primero):** jest `deviceClass.test.js`, `aiAttemptMark.test.js`,
   ampliación de `aiSegmenter.test.js` (celular con GPU apta ⇒ u2netp y 0 pedidos a parts; hint desde el
   hilo principal; marca → u2netp; éxito limpia; IDB roto no rompe; escritorio sigue en BiRefNet; la marca
   se escribe antes de `create`), `backend` (args `mobile`), i18n (los 3 idiomas dicen «6 MB»/GPU).
   Playwright (`test/`): corrida con UA iPhone + `navigator.gpu` simulado que confirme 0 pedidos a
   `/models/birefnet-*` si el arnés lo permite.
7. **Fuera de alcance:** estilos, guías, arnés «Lo probamos». Verificación real: el PO en su iPhone 13 con
   WebGPU ACTIVADO (jetsam no es reproducible en CI).

### Ampliación del alcance (decisión del PO, 2026-10-20, tras el QA del intento 1: O3 y O4)
8. **Marca con vencimiento (7 días):** `markAttempt()` guarda `Date.now()` (número) en vez de `true`.
   `hasAttempt()` solo devuelve true si el valor es un número con edad < 7 días (`MARK_TTL_MS`); una marca
   vencida, de formato viejo (`true`) o con fecha futura/ilegible se ignora ⇒ se reintenta BiRefNet. Ya no hay
   «u2netp para siempre» (cierra O4). Tests: marca de 8 días ⇒ ignorada; de 6 días ⇒ vigente; en aiSegmenter,
   marca vencida en escritorio con GPU ⇒ BiRefNet, vigente ⇒ u2netp.
9. **Android en «Sitio de escritorio» (cierra O3):** `isMobileDevice(nav, scr)` suma dos reglas, ambas con
   `maxTouchPoints > 1`: (a) UA con `Linux` y sin `Android` (así se presenta Chrome Android en ese modo);
   (b) lado corto de `screen` ≤ 600 px. `screen` solo existe en el hilo principal: ya es quien manda el veredicto
   al worker (paso 1), así que no cambia el transporte. Una laptop Windows/macOS táctil de 1366×768 o más sigue en
   BiRefNet. Tests: UA Linux sin Android + táctil ⇒ true; táctil + screen 412×915 ⇒ true; Windows táctil
   1366×768 ⇒ false; Mac táctil 1440×900 sin otra señal ⇒ sigue la regla de iPad (true solo por Mac+táctil).
   Riesgo aceptado por el PO: una laptop Linux táctil cae en u2netp.
10. **Fuera de alcance (deuda, qa/_debt.md):** O1 (timeouts acumulados con IDB colgado) y O2 (dos pestañas).

---
Aprobado por: nerv-web [2026-10-20]
Nota: sellado después del código del intento 1 por decisión del PO; plan original commiteado en c785f69; desvío en qa/_debt.md. La ampliación (pasos 8–10) se sella antes de su código.

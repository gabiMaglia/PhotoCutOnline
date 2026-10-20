# BUG-13 — nerv-verifier (juez ciego, X) · 2026-10-20

**Veredicto: APROBADO**

- **Rama juzgada:** `fix/BUG-13-mobile-ai` @ 6987cba contra `main`. Es un control compensatorio porque el §QUÉ se selló después del código.
- **Leído:** el Gherkin de BUG-13 (`engram/03_backlog.md`, en main), el §QUÉ de `engram/plans/BUG-13.md` en la rama y el diff de la rama. No leí los informes de QA ni el handoff log.
- **¿Está todo con file:line?** Sí. Todas las referencias son a la rama.
- **Defectos:** ninguno.

## Escenarios

### 1. Un celular o tablet con WebGPU usa u2netp: CUMPLE

**Cómo lo hace el código**
- `aiSegmenter.js:251` evalúa `isMobile()` antes de `gpuUsable()` y antes de `hasAttempt()`. Por eso, en un celular no se piden las partes, no se carga el bundle WebGPU (`loadOrt`, `aiSegmenter.js:190`) y no se toca IndexedDB.
- El hilo principal calcula el veredicto y lo manda en las 3 entradas: `backend.js:299`, `304` y `318`. El worker lo aplica en `cutoutWorker.js:101`, `108` y `118`, y el camino inline en `backend.js:163`, `169` y `183`.
- Los 5 llamadores de producto pasan todos por `backend`: `useCutoutSession.js:106,109`, `useIconStudio.js:91,106` y `useBatch.js:36`. Lo comprobé con grep: no hay otra entrada a `aiSegmenter`.
- `aiSegmenter.js:83` combina el aviso y el UA del worker con un OR.
- `deviceClass.js:15` reconoce iPhone, iPad, Android y Mobile por el UA. `deviceClass.js:19` reconoce el iPadOS que se presenta como Mac: táctil más Macintosh o MacIntel.

**Prueba e2e que corrí yo** (Chrome real, channel `chrome`, con el contexto IPHONE_CTX de `test/run-tests.mjs:68-73`, sobre `/test/ai-test.html`)

| Corrida | Pedidos a `/models/birefnet-*` | Pedidos a u2netp | Resultado |
|---|---|---|---|
| Rama, UA de iPhone | 0 | 1 | ALL_DONE |
| Main, UA de iPhone | 2 | 0 | Rojo comprobado |
| Rama, escritorio | 2 | 0 | BiRefNet sigue |

En esta Mac, el adapter WebGPU es apto: `isFallbackAdapter` false, `maxStorageBuffersPerShaderStage` 10 y `shader-f16` true. Por eso la corrida discrimina de verdad.

### 2. Una computadora con GPU apta sigue con BiRefNet: CUMPLE

- Sin táctil, `deviceClass.js:18` devuelve false, así que no cuenta como móvil.
- Lo prueban la corrida de escritorio de arriba y `aiSegmenter.test.js` («computadora … sigue usando BiRefNet»).

### 3. Si la pestaña muere abriendo BiRefNet, la próxima vez va u2netp: CUMPLE

- **Antes de crear la sesión**, la marca queda escrita y confirmada en disco (`aiSegmenter.js:218`). Se confirma con `tx.oncomplete` en `aiAttemptMark.js:43`.
- **Antes de cada `run`**, también queda escrita (`aiSegmenter.js:422`).
- **Persiste en IndexedDB**, que sigue ahí entre recargas y sesiones (`aiAttemptMark.js:26`, `62`).
- **Si no hay almacenamiento**, `safe` y `withTimeout` (`aiAttemptMark.js:50`, `12`) siempre resuelven con un valor neutro en ≤ 2 s. Eso cubre que no exista `indexedDB`, que `open` lance un error y que `open` quede colgado; los 3 casos tienen test en `aiAttemptMark.test.js:79,88,100`.
- **Pasada hostil:** un IndexedDB colgado no bloquea el recorte. Como mucho suma unos 2 s por operación y la decisión cae a la regla del dispositivo, que es lo que pide el Gherkin.

### 4. La marca vence a los 7 días: CUMPLE

- La regla está en `aiAttemptMark.js:14` y `58` (0 ≤ edad ≤ TTL). Se ignora una marca futura o que no sea un número.
- Tests: `aiAttemptMark.test.js:124,130,136,142`.

### 5. Android en «Sitio de escritorio»: CUMPLE

- `deviceClass.js:21` cubre táctil con Linux sin «Android».
- `deviceClass.js:23-25` cubre táctil con el lado corto de la pantalla ≤ 600.
- Una laptop Windows táctil de 1366×768 o de 1920×1080 da false (`deviceClass.test.js`).

### 6. Un BiRefNet exitoso limpia la marca: CUMPLE

- La marca se limpia en `aiSegmenter.js:424` y `224`.
- Lo prueba `aiSegmenter.test.js`, tanto «limpia…» como «recarga ⇒ BiRefNet».

### 7. Textos honestos sobre el peso (ES, EN y PT): CUMPLE

- Están en `i18n.js:415-416`, `871-872` y `1327-1328`.
- En el editor no queda otra clave que mencione ~120 MB o ~7 MB. Lo comprobé con grep sobre `src`.

### Tests

Corrí jest con los 6 suites tocados y pasaron todos: 107 de 107.

## Supuestos y riesgos señalados (no bloquean)

1. **La marca no cubre la descarga en una computadora.** La marca se escribe después de `fetchParts`, que reserva 115 MB y calcula el sha256 (`aiSegmenter.js:165,208`). Si la pestaña muere durante la descarga en una computadora, no queda marca. En los celulares eso no pasa, porque no llegan a ese punto. El §QUÉ ya lo declara como riesgo residual.
2. **La regla de pantalla mide píxeles CSS.** `screen` está en px CSS: una laptop táctil con escala de Windows alta (por ejemplo 1920×1080 al 200 %, que da 960×540) caería en u2netp. El Gherkin no define la unidad, así que es una suposición sin ancla y no la cuento como defecto. El error iría hacia el lado seguro: menos calidad, no un crash.
3. **La corrida e2e con UA de iPhone solo discrimina si hay WebGPU apta.** En un runner sin GPU, `gpuUsable()` da false y la corrida pasaría también sobre main. No verifiqué qué hace el CI. Además, el comentario de `test/run-tests.mjs:65` («Chrome headless la expone») solo es cierto con el channel `chrome` en esta máquina.
4. **El jetsam real no se puede reproducir acá.** La verificación final sigue siendo del PO, en su iPhone 13 con WebGPU activado.

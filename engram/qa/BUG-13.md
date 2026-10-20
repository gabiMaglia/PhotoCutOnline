# QA BUG-13 — Recorte IA no tumba la pestaña en celulares (nerv-qa, 2026-10-20)

Rama fix/BUG-13-mobile-ai @ 96fdcee vs main (df54085). Nivel Strong (gate computó S: 547 líneas > 400).

## Veredicto intento 1: RECHAZADO (un defecto de proceso; el fondo está limpio)

## §Plan
Gate (nerv-gate.sh --ticket BUG-13 --level S, test cmd `npx jest`): REJECTED PLAN_GATE_MISSING.
El §CÓMO de engram/plans/BUG-13.md no lleva «Aprobado por:» (el gate exige sello para S/X, P-19.3).
Sin gate PASS no hay APROBADO (P-18). El handoff que le pasé al gate lo armé yo con los 4 campos a
partir del resumen del Orquestador (no existe un return de nerv-web como archivo); no influye en el motivo.
Verificación del fondo igual, para que la reentrega sea solo el sello:
- jest: 62 suites / 428 tests verdes en la rama.
- Harness Playwright con TEST_PORT libre (5392 main / 5393 rama, worktrees limpios, secuencial).
  Chrome: todo verde, incluida la corrida nueva «ai-test con UA de iPhone» (0 pedidos a /models/birefnet-*, pidió u2netp).
  WebKit: webp-test, reencode-test, filters-test y webp-retry-test fallan igual en main y en la rama.
- Punto 3 (webp-retry-test [webkit]): PREEXISTENTE. En main falla con el mismo mensaje
  («WebAssembly.Module doesn't parse … module doesn't start with '\0asm'»); `diff` de las líneas FAIL/ERROR
  main vs rama: idéntico (salvo un 404 de birefnet part0 en main por falta de public/models en el worktree). No lo rompió esta rama.
- Puerto: 5187 y 5188 ocupados por otros procesos (5188 está fijo en test/sw-deploy-test.mjs); usé TEST_PORT y
  moví el puerto de sw-deploy solo en worktrees descartables. Correr dos suites a la vez sobre el mismo node_modules
  (cache .vite compartida) produjo falsos rojos («dispatcher.useRef»); las corridas válidas fueron secuenciales.

## §GAP (Especificado vs Deducido)
Especificado y con implementación + test: S1 móvil con GPU ⇒ u2netp y sin /models/birefnet-* (deviceClass.js,
backend.js, aiSegmenter.js:249-253; jest + Playwright iPhone); S2 escritorio sigue en BiRefNet (test «computadora…»);
S3 marca persistente en IndexedDB, entre recargas, y degrada si no hay IDB (aiAttemptMark.js; tests de persistencia,
sin indexedDB, open que lanza, open colgado); S4 éxito limpia la marca (test «un BiRefNet exitoso limpia…»);
S5 textos ES/EN/PT con ~6 MB / ~120 MB solo computadoras con GPU (i18n.js:415-416, 871-872, 1327-1328; i18n.test).
Deducido (va al PO, no se vuelve test): (a) además de borrar la marca al terminar `segment`, el código la borra al
abrir la sesión (openModel, aiSegmenter.js:221-224) y la vuelve a poner antes de cada `run`; el Gherkin solo pide limpiar al
terminar bien un recorte, el plan 4 dice lo mismo. Es coherente con el objetivo (precalentar y cerrar la pestaña no castiga) pero es comportamiento sin criterio.
(b) Una falla atrapable de BiRefNet deja la marca (u2netp permanente en esa máquina, sin TTL). Anotado en el plan, no en el Gherkin.
Definición sin implementación: ninguna.

## §Casos (1:1 vs Gherkin)
1 móvil/tablet/iPadOS-Mac/Android con UA o userAgentData ⇒ u2netp: CUBIERTO (deviceClass.test, backend.ai-notice.test, aiSegmenter.test, Playwright iPhone).
2 escritorio con GPU ⇒ BiRefNet: CUBIERTO. 3 marca persistente + sin IDB: CUBIERTO. 4 éxito limpia: CUBIERTO. 5 textos: CUBIERTO.

## Puntos pedidos
1. Race marca vs releaseAi/inFlight: sin defecto. mark/clear viven dentro del rango inFlight (warmupAi y aiMatte cuentan desde antes de getSession);
   no tocan la sesión, así que releaseAi diferido (D1 de T-002) no se pisa con ellos; aiMatte se serializa por `chain` y warmup concurrente
   comparte `sessionPromise`, por lo que mark→create→clear y mark→run→clear no se intercalan en una sola pestaña.
2. IndexedDB roto/colgado: cada operación se rinde a los 2 s (withTimeout) y devuelve el valor por defecto; ningún camino lanza. Ver O1.
4. Puerto: ver §Plan. 5. Aserciones: no se debilitó ninguna. La única aserción retirada en main→rama es `toContain("~7 MB")` de i18n.test,
   reemplazada por `~6 MB` más dos aserciones nuevas (`not.toContain("~7 MB")`, regex que ata ~120 MB a «computadoras…GPU»). El resto del diff de tests son altas
   (setDeviceHint en dos mocks). Todos los tests nuevos afirman comportamiento (args posteados, pedidos a parts, estado de la marca, IoU del harness).

## §Defectos
D1 [proceso, bloqueante] engram/plans/BUG-13.md, §CÓMO sin «Aprobado por: … [fecha]». Gate: PLAN_GATE_MISSING (P-19.3).
   Corrección: el Orquestador/PO sella el plan (el plan ya está comprometido antes del código, c785f69 < 028e44b) y se re-corre el gate. Cero cambios de código.

## Deuda no bloqueante (ticket de deuda, no «aprobado con observaciones»)
O1 IDB colgado: cada marca/limpieza gasta hasta 2 s; en escritorio con IDB colgado son ≈2 s (hasAttempt) + 2 s (create) + 2 s + hasta 4 s por recorte.
   Además una escritura abandonada por timeout puede aterrizar después del clear y dejar una marca huérfana.
O2 Dos pestañas: la pestaña B que termina bien borra la marca que A acababa de poner; si A muere en la inferencia, el bucle vuelve. Falta contador/identificador por pestaña.
O3 Android en «Sitio de escritorio» (UA sin Mobile, userAgentData.mobile=false, Linux): no se detecta como móvil y con WebGPU abre BiRefNet. El Gherkin nombra Android; decisión de PO (¿tratar táctil+Linux/Android como móvil?).
O4 Marca huérfana en computadora sin TTL: u2netp para siempre tras un fallo catcheable/cierre en plena inferencia; considerar TTL o botón «reintentar alta calidad».
Verificación final de jetsam: solo la puede hacer el PO en su iPhone 13 con WebGPU activado (declarado en el ticket).

---

# Intento 2 — nerv-qa Strong (2026-10-20) · rama fix/BUG-13-mobile-ai @ c3dfaed

## Veredicto intento 2: RECHAZADO (otra vez un solo defecto de proceso; el fondo está limpio)

## §Plan
- Gate (worktree de la rama, `NERV_TEST_CMD="npx jest"`, handoff = return intento 2, `--files` = diff real vs merge-base):
  - `--level S`: REJECTED PLAN_GATE_MISSING («falta §CÓMO estampado»). Nivel computado S (640 líneas > 400).
  - `--level X --attempt 2`: REJECTED PLAN_GATE_MISSING (falta §CÓMO y §QUÉ). El gate computa X por «reintento #2 tras rechazo»;
    en el worktree no lo deriva solo porque su 03_backlog.md es anterior a mi veredicto del intento 1. Con el backlog real de main (1 RECHAZADO) sí lo deriva.
  - Causa verificada en nerv-gate.sh:189-198: `psec "CÓMO"` lee desde `^## CÓMO` hasta el siguiente `^## `. El plan tiene `## CÓMO`
    (sin sello) y luego `## Ampliación…` (pasos 8-10); «Aprobado por: nerv-web [2026-10-20]» está al final, dentro de la sección Ampliación. No cuenta.
  - Simulación (copia temporal, restaurada, sin cambios en la rama): con `## QUÉ` y `## CÓMO` estampados el gate da PASS (prueba de rojo OK, suite verde).
    O sea: no hay otro bloqueo detrás del sello.
- Orden de commits del plan (lo que se pidió mirar): c785f69 plan CÓMO < 028e44b rojo < 96fdcee fix (intento 1); b0601c0 sello+ampliación 8-10 < b904e48 rojo < c3dfaed fix (intento 2). Correcto: la ampliación se selló antes de su código.
  El sello del CÓMO original (pasos 1-7) es post-código por decisión del PO, anotado en el plan y en qa/_debt.md; el PO ya pidió nerv-verifier ciego como control compensatorio.
- jest: 62 suites / 439 tests verdes.
- Prueba de rojo (hecha por mí): deviceClass.js y aiAttemptMark.js de b0601c0 (previos al fix) con los tests de b904e48 ⇒ 5 tests fallan, 21 pasan. Archivos restaurados.
- WebKit, pedido explícito: en el checkout PRINCIPAL de main (dea7041, sin worktree), puerto libre 5421 (copia temporal del runner con otro puerto, luego borrada; sin pkill),
  webp-test, reencode-test, filters-test y webp-retry-test [webkit] pasan todos («✓ todo verde», sin «\0asm»).
  En el worktree de la rama (node_modules como symlink al principal) los mismos 3 fallan con «\0asm» (webp-test, reencode-test, webp-retry-test «reintento con red»).
  Conclusión: main NO está rojo; el rojo es artefacto del worktree (symlink de node_modules / servido de .wasm por Vite). No es un defecto de BUG-13 ni de main.
  Limitación: no corrí la rama en un árbol sin symlink; el diff no toca webp/encoder/filtros, y los archivos tocados desde el intento 1 son solo deviceClass.js y aiAttemptMark.js (+ tests).
  Salió del ámbito: el runner de main no tiene TEST_PORT (la rama sí); si se mergea, ya queda.

## §GAP (Especificado vs Deducido)
Especificado, implementado y con test:
- E1 «la marca vence a los 7 días»: aiAttemptMark.js (MARK_TTL_MS, hasAttempt solo true con número pasado y edad ≤ 7 días); tests: 6 días vigente, 7 días + 1 ms ignorada, futuro/`true` viejo ignorado, marca nueva tras vencimiento vale.
- E2 «Android en sitio de escritorio»: deviceClass.js: táctil + UA Linux sin Android ⇒ móvil; táctil + lado corto ≤ 600 ⇒ móvil (borde 600 probado); laptop Windows táctil 1366×768 y 1920×1080 ⇒ no; sin táctil ⇒ no. screen llega solo del hilo principal (backend.js:299,304,318), coherente con el paso 9.
Deducido (al PO, no se vuelve test):
- G1 El Gherkin dice «laptop Windows/macOS táctil de 1366×768 o mayor sigue usando BiRefNet», pero la regla de iPad (Mac + táctil ⇒ móvil, escenario 1) hace que un «macOS táctil» sea móvil sin importar el tamaño; el plan paso 9 lo resuelve así (Mac táctil 1440×900 ⇒ true) pero NO hay test de ese caso (solo Windows). La frase de macOS en el Gherkin es contradictoria con iPadOS-como-Mac; PO: confirmar o quitar «macOS» de la frase. Hoy no existe laptop Mac táctil, riesgo bajo.
- G2 TTL borde: el plan dice «edad < 7 días»; el código y el Gherkin («más de 7 días») usan ≤; solo difiere en el milisegundo exacto. Sin impacto.
- G3 El plan (paso 8) prometía un test en aiSegmenter «marca vencida en escritorio con GPU ⇒ BiRefNet, vigente ⇒ u2netp». No existe: aiSegmenter.test mockea aiAttemptMark (hasAttempt = estado fijo), así que el TTL se prueba solo en la unidad. El cableado (hasAttempt false ⇒ BiRefNet) ya lo cubre el caso «sin marca ⇒ BiRefNet». Deuda, no bloqueante.
Definición sin implementación: ninguna.

## §Casos (1:1 vs Gherkin)
Los 5 del intento 1: CUBIERTOS (sin cambios en aiSegmenter/backend/i18n desde entonces). Nuevos: vence a los 7 días CUBIERTO (unidad); Android sitio de escritorio CUBIERTO (unidad; ver G1).
TDD P-18: rojo verificado (5 fallan sin el fix); toda aserción nueva afirma comportamiento (valor devuelto por hasAttempt/isMobileDevice); ninguna aserción debilitada o borrada en b0601c0..c3dfaed (solo altas).

## Lente Strong
Riesgo: sin entradas externas nuevas; `screen` y `navigator` solo se leen; la marca guarda un número, sin datos personales. Resiliencia: valores de marca no numéricos, futuros o `true` viejo ⇒ ignorados (no tumba); `screen` ausente ⇒ 0 ⇒ no es señal. Legibilidad: comentarios claros.
Observación: una marca con fecha futura se ignora y la siguiente `markAttempt` la sobrescribe; correcto. Reloj del sistema atrasado: marca nueva puede parecer «futura» ⇒ se ignora ⇒ se reintenta BiRefNet; consecuencia leve, ya estaba cubierta por la política.

## §Defectos
D1 [proceso, bloqueante, reabierto] engram/plans/BUG-13.md: el gate sigue rechazando con PLAN_GATE_MISSING. El sello está fuera de la sección `## CÓMO` (cae bajo `## Ampliación…`), y con el backlog real el gate computa X por reintento y también exige `## QUÉ` estampado, que el plan no tiene.
   Corrección sin tocar código: poner «Aprobado por: … [fecha]» dentro de `## CÓMO` (p. ej. mover la sección Ampliación a un `###` o repetir el sello antes de `## Ampliación`), y resolver §QUÉ (el PO decide si el nivel X por reintento exige §QUÉ o se documenta el desvío; QA no puede estampar ni inventarlo). Re-correr el gate con el backlog de main.
Deuda (qa/_debt.md ya tiene O1/O2): G3 arriba (test de TTL a nivel aiSegmenter) y G1 (aclaración de macOS táctil en el Gherkin / test del caso Mac).

---

# Intento 3 — nerv-qa Adversarial (X por reintento #3) · 2026-10-20 · rama fix/BUG-13-mobile-ai @ 6987cba

## Veredicto intento 3: APROBADO

## §Plan
- Gate corrido por QA desde el worktree de la rama (`NERV_TEST_CMD="npx jest"`, handoff = return intento 3 de main, `--files` = diff real vs merge-base, `--level S`):
  base main; files == declaración (14); intento derivado #3 (2 RECHAZADO); nivel computado X (declarado S ⇒ WARN, QA revisa en X);
  plan estampado para X; return P-1 con 4 campos; prueba de rojo OK; suite verde; `NERV-GATE: PASS`.
- `git diff c3dfaed..HEAD -- src test` vacío: el código y los tests son los auditados en el intento 2. Entre c3dfaed y HEAD solo cambió `engram/`.
- §QUÉ (arquitecto, post-hoc) y §CÓMO (nerv-web) declaran su carácter post-hoc sin fechas retroactivas; la tabla de conformidad cita file:line que verifiqué contra el código (aiSegmenter.js:218/224/251, backend.js:299/304/318, cutoutWorker.js:99-118, deviceClass.js).
- G1 del Gherkin corregido («Windows táctil»): coherente con deviceClass.js (Mac+táctil ⇒ móvil; Windows táctil 1366×768 ⇒ no). Ya no hay contradicción.

## §GAP
Especificado (con implementación y test): los 7 escenarios (móvil/tablet ⇒ u2netp sin /models/birefnet-*; escritorio ⇒ BiRefNet; marca persistente + sin almacenamiento; éxito limpia; vence a los 7 días; Android sitio de escritorio / Windows táctil 1366×768; textos ES/EN/PT).
Deducido (al PO, no se vuelve test): limpiar la marca también al abrir la sesión; marca que persiste tras falla atrapable (hasta 7 días). Definición sin implementación: ninguna.

## §Casos (1:1 vs Gherkin)
Todos CUBIERTOS (sin cambios desde el intento 2). Excepción de profundidad conocida: TTL probado en la unidad `aiAttemptMark`, no a nivel `aiSegmenter` (G3, deuda).

## Pasada hostil (X)
H-A. ¿Algún camino de IA llega a BiRefNet en un móvil sin el dato `mobile`?
- Único módulo que abre BiRefNet: aiSegmenter.js (`openPreferred`, :249-255). Importadores en `src/`: cutoutWorker.js:15 y backend.js:108/162/168/176 (camino inline). Nada más (grep sobre src/, editor/, test/; `src-tauri` y `crates` no mencionan birefnet/onnx).
- Entradas de producto: useCutoutSession.js:106,109; useIconStudio.js:91,106; useBatch.js:36 ⇒ todas `backend.warmupAi|aiCut|removeBg` ⇒ `{mobile: isMobileDevice()}` en backend.js:299,304,318. Worker (cutoutWorker.js:99,106,116) e inline (backend.js:160-183) llaman `setDeviceHint` antes de tocar aiSegmenter. Los comandos del worker que no son IA no abren modelo.
- Residual 1 (H1, no bloqueante): `setDeviceHint(mobile)` hace `!!mobile`, así que un llamador futuro que omita el dato RESETEA un true previo a false (no es sticky). Hoy ningún llamador lo omite. Residual 2: un bundle viejo del hilo principal (service worker/caché) con un worker nuevo no manda `mobile`; en un iPad que se presenta como Mac el worker no lo detecta por su UA. Ventana de despliegue breve; con iPhone/Android el UA del worker alcanza (OR).
- Los tests de `test/ai-quality-test.js` y `ai-test.js` llaman aiMatte/backend sin hint en un Chrome de escritorio: no son rutas de producto.
H-B. Marca con TTL ante relojes manipulados (aiAttemptMark.js:53-58): `age = Date.now() - at` solo si `typeof at === "number"`; vale con `0 ≤ age ≤ 7 d`.
- Reloj adelantado >7 d tras marcar: marca vencida ⇒ se reintenta BiRefNet (conservador: igual al vencimiento normal). Reloj atrasado (o marca escrita con reloj futuro): age < 0 ⇒ ignorada ⇒ se reintenta BiRefNet; no rompe nada y la siguiente `markAttempt` sobrescribe. `NaN`/`Infinity`/`true`/string: comparaciones falsas o `-1` ⇒ ignorada. Nunca lanza (todo en `safe`).
- Consecuencia máxima: una computadora con reloj roto que muere en BiRefNet puede repetir el intento; solo computadoras, porque el móvil decide por dispositivo ANTES de leer la marca (aiSegmenter.js:251, `isMobile()` precede a `hasAttempt()`). Por política ya aceptada. Deuda H2.
H-C. Sin estados imposibles hallados: `usingFallback || isMobile() || !gpu || hasAttempt` es cortocircuito; en móvil no hay pedidos a /models/birefnet-* ni acceso a IndexedDB; mark/clear ocurren dentro del rango `inFlight` (verificado en intento 1).

## TDD P-18
Rojo verificado por el gate (PASS) y a mano en intento 2 (5 tests fallan sin el fix). Sin aserciones debilitadas (solo altas). Aserciones afirman comportamiento.

## §Defectos
Ninguno.

## Deuda no bloqueante (ticket de deuda, agregada a _debt.md)
H1 `setDeviceHint` no sticky y bundle viejo sin `mobile` (hacer que `undefined` no pise el hint, o exigir el dato); H2 reloj manipulado reintenta BiRefNet en computadoras; G3 test del TTL a nivel aiSegmenter; O1/O2; R1/R2 del arquitecto.
Verificación final de jetsam: PO en iPhone 13 con WebGPU activado. nerv-verifier ciego: lo convoca el orquestador en paralelo; este veredicto no depende de él pero el orquestador debe cruzar ambos antes de mergear. No mergeé.

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

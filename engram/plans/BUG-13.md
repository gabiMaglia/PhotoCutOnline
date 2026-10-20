# Plan — BUG-13 · Recorte IA no tumba la pestaña en celulares

**Nivel (P-11):** Strong (ruta de IA, bloquea el lanzamiento). Sin dependencias nuevas.

## Causa (confirmada por el PO, iPhone 13)
iOS 26 expone WebGPU + shader-f16 ⇒ `gpuUsable()` elige BiRefNet (115 MB, ~535 MB de wasm) ⇒ iOS mata el
proceso por memoria (jetsam). No hay excepción: el respaldo a u2netp nunca corre y nada persiste ⇒ bucle.

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

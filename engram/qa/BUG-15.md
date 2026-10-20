# QA BUG-15 — intento 1 — APROBADO (alcance acotado, ver §Defectos)

Revisado: rama fix/BUG-15-ci @ c94ae2e vs main (worktree agent-ad3245c8c3c1f8b7a). Nivel P-11: nerv-gate computa **A** (125 líneas reviewables), igual al declarado. Gate PASS (files == diff, 4; return P-1 con 4 campos). El gate no tiene comando de test configurado (WARN "proof of red NOT verified"), corrí a mano.

## Plan
Lentes A: criterios + legibilidad. Pedido del orquestador sumó 3 focos: (1) política originPolicy, (2) settled(), (3) C2. El ticket no tiene Gherkin: su criterio es el diagnóstico (systematic-debugging antes de tocar código) y bajar el rojo de (a)(b)(c).

Ejecución propia: `node --test scripts/origin-policy.test.mjs` 7/7; `TEST_PORT=5391 npm run test:web` exit 0 (mobile-empty y sw-deploy verdes en Chrome y WebKit, C2 incluido); sondas de ataque en scratchpad/atk.mjs; log de CI del run 39471468361.

## GAP
| Escenario | Etiqueta | Estado |
|---|---|---|
| (b) lienzo >= 16 px de la topbar estable (mide tras asentarse) | Especificado (fila BUG-15 b) | Implementado (settled) |
| (c) POST de AdSense no rompe «ninguna request con cuerpo» | Especificado (fila c) | Implementado (originPolicy) |
| (a) C2 offline abre Filtros sin timeout | Especificado (fila a) | NO implementado: sin causa raíz, solo mensaje de error ampliado |
| Cuerpo > 16 KiB a host de anuncios = violación | Deducido | para el PO (umbral elegido por el dev) |
| Firma de imagen en el cuerpo = violación | Deducido | para el PO |
| Los 4 hosts = lista de docs/MONETIZACION.md (l.88-90) | Especificado | OK, coincide |

## Casos
- (b) PASS: 0 fallos en mi corrida Chrome+WebKit (27.25 px). En CI el valor 7.2 era la medición a mitad del scale de entrada.
- (c) PASS 7/7 tests; asserts significativos (assert.equal null / assert.match / assert.ok). Sin aserciones débiles ni removidas (archivos nuevos; sw-deploy solo cambia cómo se calcula `foreign`, `check("origen"...)` intacto).
- (a) NO resuelto, ver foco 3.

## Foco 1 — política de pings: ¿detecta cualquier envío de la foto?
No. Sondas propias (host de anuncios declarado, POST):
- DETECTADO: PNG crudo; base64 alineado (PNG solo); cuerpo > 16 KiB; host de anuncios no declarado; otro host con cuerpo.
- NO DETECTADO: PNG sin cabecera (trozo 2..N, ≤16 KiB c/u, sin tope acumulado); base64 de bytes con 1 o 2 bytes de prefijo (desalinea «iVBORw0KGgo»); gzip; hex; percent-encoding; GIF, BMP, AVIF/HEIC (sin firma en la lista); píxeles crudos de getImageData.
- Preexistente, mismo código: `url.startsWith(origin)` deja pasar `http://localhost:5188.evil.com/up` (sin cuerpo chequeado).
Valoración: el hueco solo existe hacia 4 hosts de anuncios; cualquier otro host sigue fallando con cualquier cuerpo. El riesgo real que la prueba cubre (regresión del app que sube la foto con fetch/FormData/dataURL a un backend o analytics) sigue detectado. Un envío deliberado y ofuscado a Google Ads no es el modelo de amenaza del arnés. Pero el comentario «cualquier envío» sobrestima la garantía: hay que decir «subida directa de la imagen». → deuda (BUG-16): restringir path a `/pagead/ping`, tope ~1-2 KiB, presupuesto acumulado por contexto, ampliar firmas, cambiar `startsWith` por `new URL(url).origin === origin`.

## Foco 2 — settled()
No se cuelga: el bucle está acotado a 8 s y lanza `timeout: el layout no se asentó` (falla, no cuelga). Con rAF pausado (pestaña oculta) también termina por el reloj. No enmascara layout roto: solo espera estabilidad (5 frames idénticos + sin animaciones corriendo) y la aserción ≥16 px se evalúa después con el rect final; un layout estable en 7.2 px sigue fallando. Límite honesto: una animación infinita en `.canvas-stage` la haría fallar por timeout (hoy no existe); `getAnimations` requiere WebKit ≥13.1 (el CI usa uno actual). Solo se aplica a esa aserción; las demás de la suite no se tocaron.

## Foco 3 — C2
- Sin causa raíz: aceptable mergear solo con el diagnóstico mejorado **a condición** de que C2 quede abierto como deuda (BUG-16) y no se declare resuelto. No hay repro (~25 corridas locales + las mías), y rechazar pediría un fix imposible. El mensaje ampliado (8 líneas) debería mostrar «intercepts pointer events» la próxima vez.
- Hallazgo «el SW activo en C2 sigue siendo el de A»: NO se sostiene con el log del run 39471468361. Entre «C1 sin worker error» (18:17:58.7835) y «C1 0 respuestas 404» / «C6» (18:17:58.7915) pasan 8 ms, y ahí está `await waitActive(page, P.ids.B).catch(() => {})`. waitActive reintenta cada 250 ms y solo falla a los 30 s, así que resolvió en la primera sondeada: el SW de B SÍ estaba activo. Los 34 s siguientes son el click de 30 s de C2. Por tanto ni es evidencia de defecto de BUG-08 ni de condición del arnés; es una inferencia del código (el `.catch` traga el error) y no un dato medido. Además, en el mismo run C4/C5 ven B y C activos.
- Señal que sí cuadra: en esa misma corrida WebKit el script real de AdSense corrió (POST ping de pagead2 en el contexto de C2, a pesar de `ctx.route(abort)`). Eso confirma que en WebKit con SW activo `ctx.route` no corta terceros, y un script/overlay real de anuncios es candidato a interceptar el click. Nota: la tolerancia (c) enmascara el síntoma (el ping) pero no explica el timeout. Ojo, el SW ignora requests cross-origin (public/sw.js:183) así que no es un defecto de producto del SW.
- Sugerencia para BUG-16: que waitActive(B) no use `.catch(()=>{})` o que registre el resultado, y en C2 registrar `document.elementFromPoint` del botón de Filtros al fallar.

## Defectos
Ninguno bloqueante. Deuda a abrir como BUG-16 (el orquestador la crea): C2 sin causa raíz; política de pings endurecible (lista de focos 1); `waitActive(B).catch` traga fallos; comentario de originPolicy «cualquier envío».

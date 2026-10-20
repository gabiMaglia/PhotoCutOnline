# QA BUG-16 — intento 1 — APROBADO

Revisado: rama fix/BUG-16-harness-offline @ c076a12 vs main (worktree agent-a60ea804ca2c56c62). Nivel P-11: nerv-gate computa **A** (164 líneas reviewables), igual al declarado. Solo test/ y scripts/.

## Plan
Lentes A: criterios + legibilidad. Evidencia producida por QA (el TL no mandó return ni prueba rojo/verde).

Prueba de rojo/verde:
- `node --test scripts/origin-policy.test.mjs` en la rama: 13/13 verdes.
- Mismos tests con `originPolicy.mjs` de main: 7 pass / **6 fail** (tests 8-13: path /pagead/ping, tope 2 KiB, presupuesto 8 KiB, GIF/BMP/AVIF/HEIC/gzip, base64 desalineado, `new URL().origin`). Rojo real, cada test nuevo discrimina el cambio. Archivo restaurado (git status limpio).
- `TEST_PORT=5291 npm run test:web` completo (Chrome + WebKit): exit 0, «todo verde». C1/C6/C2 PASS en ambos motores (C2 3,9 s y 2,2 s). Puerto 5188 (fijo de sw-deploy) libre antes; sin pkill. Los 2 «FAIL» que matchea un grep son `WEBP_ENCODE_FAILED` dentro de PASS.
- Sonda propia del servidor (puerto 5199): up 200 → `setDown(true)` → **ECONNREFUSED** → `setDown(false)` 200 en el mismo puerto → `setDown(true)` + `reset()` vuelve a escuchar (200).
- Gate: files == diff, nivel A, return con 4 campos OK. **RED_PROOF_FAILED es un falso positivo del gate**: clasifica `test/lib/originPolicy.mjs` (la implementación de la política, que vive bajo test/) como archivo de test y lo copia al árbol pre-cambio, así que los tests pasan ahí. La prueba de rojo manual de arriba (implementación vieja + tests nuevos) la sustituye. Sugerencia de mejora del gate, no defecto del ticket.

## GAP
| Escenario | Etiqueta | Estado |
|---|---|---|
| Offline por rechazo de conexión (setDown cierra el listener; vuelve en mismo puerto; Chrome conserva setOffline) | Especificado | Cumple (sonda + test:web; `ctx.setOffline(true)` intacto en el diff) |
| Estabilidad 14/14 docker x86_64 --cpus=1 y rojo con arnés viejo | Especificado | **No verificado por QA** (opcional por instrucción; sin docker). A verificar en CI. Evidencia del TL en el diagnóstico: 5/14 FAIL con destroy, 0/14 cerrando listener |
| Diagnóstico honesto: «arnés: WebKit perdió el storage» y waitActive(B) sin .catch | Especificado | Cumple (código leído; waitActive(B) ya no traga y pasa en ambos motores). El mensaje solo se ejercita al fallar: no hay test que lo fuerce |
| Política: solo POST, /pagead/ping, ≤2 KiB, ≤8 KiB acumulado | Especificado | Cumple, con test |
| Política: GIF/BMP/AVIF/HEIC, base64 desalineado, gzip, `new URL().origin` | Especificado | Cumple, con test (gzip solo en crudo; ver D-1) |
| `reset()` async re-escucha; `close` tolerante a servidor ya cerrado | Deducido | Verificado por sonda; se pasa al PO como cambio no pedido pero inocuo (sustenta el criterio 1) |

## Casos (1:1 vs Gherkin)
1. Offline por rechazo: PASS (sonda + C2 ambos motores).
2. Estabilidad 14/14: PENDIENTE CI (no bloquea por instrucción).
3. Diagnóstico honesto: PASS por lectura; waitActive(B) sin catch verificado en ejecución.
4. Política endurecida: PASS 6/6 tests nuevos, rojo demostrado.

TDD P-18: rojo demostrado (manual); todos los tests nuevos asertan comportamiento (assert.ok/equal sobre el veredicto); sin aserciones debilitadas (solo se agregan tests; el único cambio en sw-deploy-test es quitar el `.catch`, que endurece).

## Defectos
Ninguno bloqueante. Deuda no bloqueante (debt, no condiciona el APROBADO):
- D-1: gzip y los formatos nuevos se cubren en crudo y base64 de las firmas, pero el cuerpo gzip real esconde cualquier firma: la política lo bloquea por su cabecera 1f 8b 08, no por contenido; un cuerpo con otra compresión (deflate/brotli) no se detecta. Mitiga el tope de 2 KiB.
- D-2: la rama «arnés: WebKit perdió el storage» no tiene test que la fuerce; si cambia el texto no lo notará nada.
- D-3: el gate marca RED_PROOF_FAILED cuando la implementación vive bajo test/ (ver Plan).
- Riesgo residual: el flake solo se confirma en CI tras el merge; Safari real (CFNetwork) ya verificado por el PO en iPhone para BUG-13/offline.

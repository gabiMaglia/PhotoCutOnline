# QA GROW-40 — maskable: zona segura (círculo radio 40 %)

Rama `fix/GROW-40-maskable` (7b44b0c) vs main. nerv-qa, 2026-10-26. Nivel P-11 computado por nerv-gate: **A** (60 líneas reviewables), igual al declarado.

**Veredicto: APROBADO.**

## §Plan
nerv-gate (con `NERV_TEST_CMD="npm test"`, Node 20 = CI, `npm run build` antes) → geometría del test + rojo → export real de `maskable-512.png` medido en Chrome (Playwright) → comparación entrada a entrada del zip contra el icons.js de main → las 9 apariciones del texto en ES/EN/PT → `node --test scripts/` por versión de Node.

## §GAP
- Especificado, implementado: todo el Gherkin (ver §Casos).
- Deducido, a validar por el PO (no se vuelven caso de prueba): (a) `MASKABLE_MIN_PADDING = 0.22` y `maskablePadding` quedan **exportados** de icons.js solo para el test; (b) un padding de usuario entre 0,2 y 0,22 ahora sube a 0,22 (cambia el export respecto de antes, es el objetivo); (c) `scripts/gen-brand-assets.mjs:61` (maskable de la propia marca, `safeZone: 0.6`) y `public/make_icons.py:200-202` (`max(0.2, padding)`, el script Python que se publica) conservan el padding 0,2: misma causa raíz, fuera del Gherkin → deuda en `_debt.md`, no bloqueante.
- Especificado, NO implementado: ninguno.
- Nota de conteo: el pedido habla de 8 frases; el diff trae **9** (ES 3, EN 3, PT 3: tabla de la guía de iconos, lista de errores, tabla de la guía de favicons). Las 9 dicen «círculo centrado de 80 % de diámetro».

## §Casos (1:1 vs Gherkin)
| Criterio | Resultado |
|---|---|
| Padding ≥ (1 − 0,8/√2)/2 ≈ 0,2172, redondeado a 0,22 | OK: `MASKABLE_MIN_PADDING = 0.22` (icons.js:75); (0,5−0,22)·√2 = 0,396 ≤ 0,4 |
| El arte cabe en el círculo de radio 0,40 × 512 | OK, **medido sobre el export real** (ver abajo) |
| Test unitario con la geometría, rojo con 0,2 y verde con el nuevo | OK. `icons.maskable.test.js`: `cornerRadius(maskablePadding(0)) ≤ 204,8` con `cornerRadius = (256 − pad·512)·√2`. Con 0,2 da 215,7 > 204,8 (rojo, y el gate lo confirmó: "proof of red OK"); con 0,22 da 201,5 (verde). 3 tests con aserciones reales, ninguna débil |
| Padding mayor del usuario se respeta (Math.max) | OK: test `maskablePadding(0.3) === 0.3`; export real con padding 0,3 idéntico a main |
| Guías ES/EN/PT dicen círculo centrado de 80 % de diámetro | OK ×9 (ver §Texto) |
| No se cambia la cifra a 60 % | OK: 0 hits de «60 %» en el diff de public/ |
| `scripts/grow39-seo.test.mjs` verde | OK: 38/38 |
| Demás plataformas exportan igual | OK: comparación byte a byte (ver abajo) |
| `npm run lastmod` corrido | OK: 6 entradas actualizadas en el commit; al re-correr: «126 entradas (sin cambios)» |

### (1) Geometría y rojo
Ver tabla. Radio del círculo seguro = 0,4 × 512 = 204,8 px. Arte cuadrado de lado 512·(1−2p); su semidiagonal es (256 − 512p)·√2: p=0,20 → 215,7 (fuera); p=0,22 → 201,5 (dentro). `nerv-gate`: "proof of red OK (tests fail without the implementation)".

### (2) Export real de `maskable-512.png`
Sí se pudo. Página temporal (borrada, no en el diff) servida con Vite dev, Chrome (Playwright, channel chrome), fuente = cuadrado rojo #ff0000 opaco de 1024×1024 que llena el cuadro, `buildIconZip(src, {appName})`, entrada extraída del zip (almacenado sin compresión) y decodificada; medí la distancia al centro de cada píxel rojo opaco:

| Versión | padding | píxeles de arte | distancia máx. al centro | bbox x | ¿≤ 204,8? |
|---|---|---|---|---|---|
| rama | default (0,08 → sube a 0,22) | 81 796 (286²) | **201,53** | 113–398 | sí |
| rama | 0,08 explícito | idéntico | 201,53 | 113–398 | sí |
| main (control) | default | 93 636 (306²) | **215,67** | 103–408 | **no** (esquinas recortables) |
| rama = main | 0,30 | 41 616 | 143,54 | 154–357 | sí (se respeta el mayor) |

Esquina (0,0) del PNG = #111317 opaco (fondo obligatorio intacto).

### (3) Sin daños colaterales
`buildIconZip` de la rama vs el de main (`git show main:src/lib/icons.js`), misma fuente y opciones, las 60 entradas comparadas byte a byte: **la única diferencia es `app-icons/web/maskable-512.png`** (default y 0,08). Con padding 0,3 no difiere ninguna entrada. iOS, Android adaptive/legacy, macOS, Windows, favicons, manifest: idénticos. Diff de `src/` = solo icons.js (+constantes, 1 línea de uso) y el test nuevo.

### (4) Texto ES/EN/PT
9 cambios, todos con la frase «círculo (centrado|centralizado) de 80 % de diámetro» / «centered circle of 80 % diameter», sin 60 %. Voseo ES: las frases nuevas son impersonales («el arte va dentro de…», «debe caber en…»); 0 formas de tú en el diff. Sin competidores. `grow39-seo.test.mjs` 38/38. No quedan «80 % central» del maskable en public/ ni src/.

### (5) `node --test scripts/`
Corrí `node --test scripts/` (forma de directorio) con cada Node:
- **v20.20.2 (el del CI: `.github/workflows/ci.yml:22` y `release.yml:43`, `node-version: 20`): exit 0, 136/136.**
- v22.22.3 y v24.22.1: `Cannot find module '.../scripts'`, exit 1. Desde Node 22 el argumento se trata como patrón/archivo y no recorre el directorio.
- **Es preexistente** (`"test": "jest && node --test scripts/"` está idéntico en main; el diff no toca package.json) y **no afecta al CI**, que usa Node 20. Afecta a quien corra `npm test` local con Node ≥ 22: eso produjo `SUITE_RED` en mi primera corrida del gate (Node 24 por defecto en esta máquina). Con Node 20 en el PATH el gate da PASS. Bajo `node --test scripts/*.test.mjs` en Node 24: 93/93 (menos que 136 porque no incluye `scripts/lib/*.test.mjs`). Deuda no bloqueante: pasar el glob `scripts/**/*.test.mjs` (entre comillas) en package.json y fijar `engines`/`.nvmrc`.

## §Defectos
Ninguno bloqueante.

Observaciones no bloqueantes (deuda, no condicionan el APROBADO):
1. Falta la entrada "return" de nerv-web para GROW-40 en `05_handoff_log.md` (solo está la entrada de ida del orquestador). El gate la dio por buena porque el archivo ya contiene los 4 campos de otras entradas: el chequeo no distingue por ticket. Registrar el return antes de mergear.
2. Mismo padding 0,2 en `scripts/gen-brand-assets.mjs:61` (safeZone 0,6) y `public/make_icons.py:200-202`.
3. `node --test scripts/` falla en Node ≥ 22 local (arriba).

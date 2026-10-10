# QA GROW-34 — veredicto (nerv-qa, 2026-10-10)

## Intento 2 — **APROBADO (Strong)** · HEAD 9d80d21

Los dos defectos que bloqueaban están corregidos y probados por mutación, las observaciones
O2 y O3 están resueltas, y todo lo verifiqué con salida real.
- Suites: jest 238/238 (43 suites), node 63/63, `test:web` todo verde, footers 126/126 y build
  sin warnings.
- **D1:** si quito `setBgColor(preset.bg)`, falla 1 test. Si quito
  `setExportMode("transparent")` en la rama sin bg (avatar), fallan 3.
- **O3 (toast):** si saco la condición "solo si cambió" en la rama bg, falla 1 test; en la rama
  transparente, falla otro. En Chrome:
  - rojo → Shopify: «El preset puso fondo blanco; podés cambiarlo».
  - → Original: ningún toast.
  - Avatar → Amazon → Shopify (desde transparente): 1 solo toast.
  - EN: blanco → Shopify no avisa; → avatar: «The preset set a transparent background; you can
    change it».
- **D2:** el avatar redondo, LinkedIn y producto ES/EN/PT (cuerpo y HowTo) ponen el preset antes
  que el fondo y avisan del orden. El JSON-LD parsea en las 9 guías. Un escaneo de las 63 guías
  buscando un paso de fondo antes de uno de preset da 0. En Chrome seguí la guía ES al pie de la
  letra (Avatar → Color #ff0000 → Descargar): 512×512 con [256,4], [4,256] y [256,508] =
  [255,0,0,255] y esquinas alpha 0. La etiqueta EN quedó «Circle avatar 512», igual a la UI.
- **O2:** `commit()` sin PRUEBAS_BUILD da 9d80d21 (= HEAD); con override, abcdef1.
- **Copy 100 KB:** en stickers ES/EN/PT ya no está «hasta que entre» / «until it fits» /
  «até caber»; ahora dice que avisa cuánto pesa.
- **Alcance:** src/, test/, scripts/ y 12 guías (las 9 de antes más el avatar ×3); pruebas.json
  sin cambios desde el intento 1. Merge-tree contra main (2c1b8eb) limpio.
- **Corrección de D-obs-1:** `nerv-gate.sh` SÍ existe (`/Users/gabrielsk/Documents/NERV/bin/nerv-gate.sh`); no se ejecutó porque exige `--handoff` (el return handoff P-1 del dev) y QA no lo tiene. Según P-18 no hay veredicto sin gate: el APROBADO queda condicionado a que el orquestador corra el gate y dé PASS. Mientras tanto, la prueba de rojo se hizo a mano con mutaciones.
- Sigue abierto, sin bloquear:
  y D-obs-4 (el cableado de lockedFormat lo cubren Chrome y el arnés, no jest). Los Deducidos
  del §GAP van al PO.

---

## Intento 1 — RECHAZADO
**RECHAZADO (Strong, intento 1).** Rama `feat/GROW-34-presets-stickers` @ b1cf981, base 2c1b8eb.
El código hace lo que pide el ticket (BUG-01 y BUG-06 verificados en Chrome real, borrado limpio,
guías reproducibles). Lo rechazan dos defectos: un test que no discrimina la precarga del color
(criterio a) y la guía del avatar redondo (ES/EN/PT), que manda elegir el color ANTES del preset.
Con la semántica nueva, seguir esos pasos deja el avatar transparente.

## §Plan
Nivel Strong (lo pidió el orquestador; `nerv-gate.sh` no existe en esta máquina, ver §Defectos
D-obs-1). Lentes: riesgo, resiliencia, legibilidad y fiabilidad. La prueba de rojo se hizo a mano
con mutaciones. Ejecuté: suites completas, 9 mutaciones, Chrome real (Playwright + Chrome 154
contra `npm run build` + `vite preview`), una nueva corrida del arnés para 3 slugs sobre una copia
del JSON (restaurado después), greps de borrado y de contenido, alcance y merge-tree.

## §Casos (1:1 vs Gherkin del backlog, Sprint 8)
| Criterio | Evidencia | Estado |
|---|---|---|
| (a) preset precarga `bg` (Amazon → #ffffff) | Chrome: Amazon → Color + `#ffffff`; rojo → Shopify → `#ffffff` | OK en producto; **test no discrimina (D1)** |
| (a) export usa el selector: Amazon + #2563eb → azul | Chrome: esquinas [37,99,235,255] ×4; engine-test PASS; jest PASS | OK |
| (a) Amazon + transparente → alpha 0 | Chrome: esquinas alpha 0 ×4, 64,6 % transparente | OK |
| (a) preset sin tocar → blanco | Chrome: esquinas [255,255,255,255] ×4 | OK |
| (b) Sticker WhatsApp WebP 512², margen 8 %, ≤100 KB, sin deformar | Chrome: webp 512×512, 25,6 KB, alpha 0, solo WEBP habilitado; sticker-test ratio 0,6495 vs 0,6503, lado mayor 428 px | OK |
| (b) Sticker Telegram PNG 512² sin deformar | Chrome: png 512×512, 201,2 KB, alpha 0, solo PNG habilitado; ratio 0,6503 | OK |
| (b) es/en/pt | i18n.js 433-436 / 873-876 / 1313-1316 | OK |
| (c) borrado Sticker Studio + flag + claves | grep = 0; dir, stickers.js y config.js borrados; 14 claves sin usos; build sin warnings | OK |
| (d) guía stickers ES/EN/PT + arnés + HowTo | flujo con preset en los 3; test pruebas (HowTo nombra los presets) verde; reproducción exacta | OK |
| (e) npm test + test:web verdes; lastmod [lastmod-skip] | jest 233/233, node 63/63, test:web todo verde, footers 126/126; 52ff356 y b1cf981 | OK |

## §GAP
- *Especificado sin test que discrimine:* la precarga del COLOR del preset (D1).
- *Deducido (al PO, no son casos de test):* (1) con un preset de sticker se puede cambiar a
  Color/Imagen y el sticker sale con fondo, porque el modo no queda bloqueado (coherente con BUG-01);
  (2) "Descargar con fondo desenfocado" ignora el preset y el lock (sale al tamaño original en el
  formato activo), comportamiento previo; (3) si ni la calidad 0,30 entra en 100 KB, descarga
  igual el archivo pesado y avisa con un toast de error. La guía dice "baja la calidad hasta que
  entre", que en ese borde sobreafirma.

## §Defectos
- **D1 (media, bloquea). P-18 / criterio (a) "su bg se PRECARGA".** Si borrás
  `setBgColor(preset.bg)` en `src/features/cutout/hooks/useExport.js` (setPresetId), jest queda
  11/11 verde. `useExport.test.js` "preset Amazon sin tocar…" afirma `bgColor === "#ffffff"`, que
  es el valor por defecto, así que pasa sin la precarga. Hace falta un caso con color distinto
  antes del preset (p. ej. #2563eb → Amazon ⇒ #ffffff exportado).
- **D2 (media, bloquea). Contenido: la promesa "avatar circular con el fondo que quieras".**
  `public/guias/foto-de-perfil-redonda.html` (HowTo 3→4 y lista l.195-196),
  `public/en/guides/round-profile-picture.html` l.163-164 y
  `public/pt/guias/foto-de-perfil-redonda.html` l.164-165 mandan elegir primero el fondo y después
  el preset «Avatar circular 512». En Chrome: rojo → Avatar ⇒ el modo vuelve a Transparente y el
  PNG sale con [256,4] = [0,0,0,0]. En el orden Avatar → rojo sale bien ([256,4] = [255,0,0,255],
  esquinas alpha 0). La guía de LinkedIn recibió el aviso del orden; esta no.
- D-obs-1 (no bloquea): `nerv-gate.sh` no está instalado. La prueba de rojo se sustituyó con
  mutaciones manuales.
- D-obs-2 (no bloquea, deuda): `scripts/pruebas/lib.mjs` `commit()` graba por defecto el
  merge-base con main. En rama graba 2c1b8eb, que no tiene presets. Así se puso el hash mal.
- D-obs-3 (no bloquea, UX): cuando un preset pisa el color elegido no hay aviso. Solo cambian el
  chip y el hex visibles.
- D-obs-4 (no bloquea): el cableado `lockedFormat` en CutoutPage.jsx sobrevive a jest. Lo cubren
  el arnés y Chrome (formatsEnabled).

Reproducibilidad (3 slugs): dimensiones, HEX, alpha, KB y % idénticos al JSON; tiempos Δ ≤ 5,1 %.
Builds 767d6da / e3d95d0: ancestros de HEAD, fuera de main, con stickerWhatsapp, paintBackground y
la precarga, y src/ idéntico a HEAD.

## Gate (P-18) — corrido por el orquestador post-merge, 2026-10-10
`nerv-gate.sh --ticket GROW-34 --level S --attempt 2` en un clon temporal con el estado pre-merge (rama en 9d80d21, main en 2c1b8eb):
- files match declaration (41 files) · return handoff con los 4 campos P-1
- **REJECTED LEVEL_UNDERSTATED**: nivel computado X (reintento #2 tras rechazo) > declarado S; falta §CÓMO y §QUÉ estampados en engram/plans/GROW-34.md (P-19.3).
- El código ya estaba mergeado y desplegado (bc88b8e) cuando se corrió: desvío del orquestador. No se estampa un plan retroactivo.

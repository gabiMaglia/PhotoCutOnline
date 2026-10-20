# Métricas — photocut

## §Costo (P-E.7) — 2026-10-20 18:20
nerv-metrics: sin sesiones medidas para 'photocut' (no hay hook PreToolUse instalado ni cosecha en ~/.nerv/metrics). Sin dato de costo.

## §Proceso — cierre Sprint 9 (2026-10-20)
- Veredictos en la tabla «Veredictos QA» para tickets del sprint: 11 filas, 6 RECHAZADO (55 %). De los 6: 4 solo de proceso (BUG-12 ×2, BUG-13 ×2), 2 con defecto real (BUG-11 D1/D2, BUG-14 D2). BUG-08/09/10 no tienen fila en la tabla (veredictos en qa/<T-ID>.md).
- Cycle time (alta→prod): BUG-12, BUG-13, BUG-14, BUG-15, BUG-16 = mismo día (2026-10-20). BUG-08..11: alta 2026-10-16 → cierre — (fechas de merge no registradas en el backlog).
- Días en bloqueo: BUG-13 «Bloqueado (PO)» ~1 h (prueba con flag WebGPU). Resto: —.
- Edad del backlog: GROW-33 bloqueado desde Sprint 7 (≤ 2026-10-06); GROW-37/38 desde 2026-10-16.

## §Costo (P-E.7) — 2026-10-06 18:06
**Sin sesiones medidas**: `~/.nerv/metrics/` está vacío y no existe `nerv-metrics.sh` (ni en ~/.claude/nerv-bin ni en bin/) → el hook PreToolUse NO está instalado en este proyecto. No se estima a mano.

## §Proceso — cierre Sprints 6+7 (2026-10-06)
- Tickets Done: 10 (GROW-25, 26, 27, 28, 29, 25b, 30, 31, 32, D-06) + D-07 cerrada sin trabajo.
- % rechazo QA 1ª pasada: 2/10 = 20 % (GROW-27, GROW-28; defectos de integración). Re-QA 2/2 aprobados.
- Cycle time: todos abiertos y cerrados el 2026-10-06; mediana < 1 día.
- Días en bloqueo: 0 (GROW-33 nace bloqueado por input PO).
- Edad del backlog: — (sin script; abiertos más viejos: D-01/D-04 desde 2026-07, Figma §6 desde Sprint 1).

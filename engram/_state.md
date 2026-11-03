# STATE — photocut · actualizado: 2026-11-03
**Modo:** CONGELADO por decisión del PO (2026-11-03): queda online sin desarrollo activo. Motivo: ~13–18 visitas/día tras el lanzamiento (antes ~3); la publicidad no alcanza para ingresos con ese volumen y el PO no quiere seguir invirtiendo tiempo.
**Rama activa:** main = origin/main @ deploy de GROW-40, CI verde. Sin trabajo en curso.
**En producción:** BUG-08..16, GROW-39 (SEO páginas con impresiones), GROW-40 (maskable), licencia MIT. Lanzamiento hecho: LinkedIn (post + proyecto), AlternativeTo, X, r/devsarg, dev.to. r/webdev y r/opensource removieron por cuenta nueva; HN bloquea Show HN por cuenta nueva.
**Si se retoma:** 1) Search Console vs 2026-10-21 (76 clics/3 meses, pos. 58,5, 64 «Descubierta»); 2) Umami referrers; 3) idea no probada: lista de espera «PhotoCut Pro para vendedores» (validar disposición a pagar antes de construir); 4) canales sin usar: grupos de vendedores Mercado Libre, videos cortos, directorios restantes.
**Deuda abierta:** qa/_debt.md (BUG-13 O1/O2/H1/H2/G3; BUG-16 D-1..D-3; GROW-40: padding 0,2 en gen-brand-assets.mjs y make_icons.py; `node --test scripts/` falla con Node ≥22 — CI usa 20). Worktrees de agentes en .claude/worktrees/ se pueden borrar.
**Costos recurrentes:** Vercel plan gratis + dominio photocutapp.com (renovación anual).
**Preguntas abiertas al PO:** ninguna activa (GROW-33, BUG-01/06, GROW-37/38, ADR-003 quedan en pausa).

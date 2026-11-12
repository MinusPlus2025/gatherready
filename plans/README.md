# Animation plans (from the 2026-11-12 motion audit)

Audit source: `docs/uiux-audit.md` §4. Commit at audit time: `253b808`.
The three high/medium findings were implemented in the same audit pass; they stay here as
a record of the before/after and the exact values. Plan 004 is the remaining backlog.

| # | Plan | Status | Why it mattered |
|---|---|---|---|
| 001 | [Hero tilt: real, immediate, cheap](001-hero-tilt.md) | DONE | the advertised 3–4° tilt was dead (filled animation pinned `transform`), would have lagged if alive |
| 002 | [One press/hover contract](002-press-feedback.md) | DONE | the intended `scale(0.97)` press lost the cascade; 10 pressables had no press state; hover lift fired on touch |
| 003 | [Remove dead count-up loops](003-remove-dead-countups.md) | DONE | two 900ms rAF loops re-rendered the landing ~100× for numbers that were never rendered |
| 004 | [Open motion backlog](004-open-motion-backlog.md) | TODO | lightbox exit, preview phase transition, funding timeline transition, gallery stagger |

Verification after execution: `npm run typecheck:web`, `npm run build`, `npm run test:motion`
(11/11), and a browser feel-check with reduced motion emulated.

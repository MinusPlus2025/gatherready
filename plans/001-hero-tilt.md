# 001 — Hero tilt: real, immediate, cheap

- **Status**: DONE (audit pass)
- **Commit**: 253b808 (found), implemented after
- **Severity**: HIGH
- **Files**: `src/web/pages/Landing.tsx`, `src/web/styles.css`

## Problem

The hero advertised a pointer-driven 3–4° tilt (`docs/design.md`), but the older entrance rule
`animation: gr-rise 720ms 120ms cubic-bezier(0.2, 0.75, 0.25, 1) both` keeps its final
`transform: none` applied forever, so the later
`transform: perspective(1100px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y))` never renders.
If it did, `transition: transform 320ms` would run while the pointer moves (the card trails the
cursor), and each `pointermove` read `getBoundingClientRect()` before writing style.

## Target (implemented)

- Entrance fill mode `backwards` (releases `transform` after the entrance).
- `.hero__figure { transition: transform 320ms var(--ease-out) }` and
  `.hero__figure[data-tilting='true'] { transition: none; will-change: transform }`.
- JS: `startTilt()` caches the rect on `pointerenter`; `tilt()` coalesces to one
  `requestAnimationFrame` per move; `resetTilt()` cancels the frame, removes `data-tilting`,
  and sets both tilt vars back to `0deg`. Reduced-motion and `(pointer: fine)` gates kept.

## Verification

- `npm run typecheck:web`, `npm run build`, `npm run test:motion` (11/11).
- Console proof: set `--tilt-y: 4deg` on `.hero__figure` and read `getComputedStyle().transform`
  — must be a matrix, not `none`.
- Feel check: cursor tracks the card with no trail; leaving eases flat over 320ms; reduced motion
  shows no tilt.

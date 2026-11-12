# 003 — Remove the two count-up loops nothing renders

- **Status**: DONE (audit pass)
- **Commit**: 253b808 (found), implemented after
- **Severity**: MEDIUM
- **Files**: `src/web/pages/Landing.tsx`

## Problem

`const interested = useCountUp(6); const fitting = useCountUp(3);` were never used in JSX — the
visible numbers are literals in `PlanPreview`. Both hooks still ran 900ms rAF loops that called
`setDisplay` roughly every frame, re-rendering `Landing` (hero + gallery + preview + sections)
about 100 times while the hero image decoded.

## Target (implemented)

Removed the `useCountUp` import and both calls from `Landing`. `useCountUp` stays exported in
`src/web/lib/motion.ts` for future use; `PlanPreview` literals stay (6 / 3 / 0 before the demo,
4 after a yes). `docs/design.md` no longer claims count-ups exist on the landing.

## Verification

- Landing renders identically; `useCountUp` has no reference in `Landing.tsx`.
- React Profiler: no sustained post-mount render loop from `Landing`.
- `npm run typecheck:web`, `npm run build`, `npm run test:motion` 11/11.

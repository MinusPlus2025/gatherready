# 002 — One press / hover contract for every pressable surface

- **Status**: DONE (audit pass)
- **Commit**: 253b808 (found), implemented after
- **Severity**: MEDIUM
- **Files**: `src/web/styles.css`

## Problem

- `.btn:active:not(:disabled)` (specificity 0,3,0) beat the intended `.btn:active { scale(0.97) }`
  (0,2,0), so the documented press feedback never ran; the old 1px translate won instead.
- `.btn:hover:not(:disabled)` also won over the press rule during a mouse press.
- The hover lift was not gated by `(hover: hover) and (pointer: fine)`, so touch taps stuck lifted.
- Ten pressables had no press state at all: `.paypal-button`, `.paypal-sim`, `.gallery__item`,
  `.lightbox__close`, `.matrix-row-button`, `.matrix-card__button`, `.demo-bar__screens-toggle`,
  `.disclosure__summary`, `.app-frame__link`, `.link-button`.

## Target (implemented)

- Base `.btn` block owns layout only; motion stays in the interaction layer:
  `.btn:active:not(:disabled) { transform: scale(0.97); box-shadow: none; }`.
- Hover lift wrapped in `@media (hover: hover) and (pointer: fine)`.
- All ten surfaces share `transition: transform var(--dur-press) var(--ease-out), …` and a
  press: 0.98 for compact controls, 0.99 for large surfaces, opacity dip for text links.
- Reduced-motion block resets these transforms to `none` (opacity feedback kept).

## Verification

- DevTools force `:active`: `.btn` → `matrix(0.97…)`, `.gallery__item` → 0.99, `.paypal-button` → 0.98.
- Touch emulation: no sticky hover lift. Reduced motion: no movement, colour/opacity kept.
- `npm run test:motion` 11/11; `npm run build` clean.

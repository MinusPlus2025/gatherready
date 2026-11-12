# 004 — Open motion backlog (not implemented)

- **Status**: TODO
- **Source**: motion audit 2026-11-12, `docs/uiux-audit.md` §4.

1. **Lightbox exit** (`src/web/components/Gallery.tsx`): opening has 220ms/240ms entrances but
   closing unmounts instantly. Add a `closing` state: 160–180ms `opacity → 0`,
   `scale(1) → 0.98`, unmount on `animationend`/timeout; keep focus return and scroll-lock cleanup.
2. **PlanPreview phase swap** (`src/web/components/PlanPreview.tsx`): suggested → waiting → yes/no
   replaces the question body instantly, so height jumps. Crossfade the swapped body over 160–200ms
   (2px blur while overlapping, per AUDIT §7) or reuse the `grid-template-rows` expansion already
   used by matrix rows; keep `aria-live` announcements.
3. **Funding timeline stage** (`src/web/components/…` + `styles.css .timeline__dot/.timeline__step`):
   add `transition: background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease`
   (dot) and `color 200ms ease` (step) so a money-state advance reads as movement.
4. **Gallery stagger** (`Gallery.tsx`, `styles.css`): the five bento cells appear together; add
   40–60ms delays on `.gallery.is-visible .gallery__cell:nth-child(n)` and the three `.how__step`
   items. Decorative only; must not gate hover or the lightbox.

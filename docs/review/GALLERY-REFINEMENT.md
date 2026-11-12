# Post-submission gallery refinement

## Diagnosis and choice
The former four-column bento cropped a landscape detail into a 168px panoramic strip, mixed five unrelated studio images, and hid labels until hover. Replace it with three selected existing licensed references: a primary making-process photograph, and subordinate studio / ceramic texture photographs. The main pot and working tool remain visible; source-edge hand cuts are inherent in the original photograph. Remove the redundant crowded workshop and vertical retail-pot photograph rather than inventing an apparent single venue.

All three assets have source / photographer / Pexels License records in public/images/README.md. No new external images or endorsements. Gallery copy in all eight languages explicitly calls these reference photographs from different studios, not the event venue or promised outcomes. Gallery remains below the primary CTA and product explanation.

## Actual checks
- Desktop Chrome: dominant process image and two subordinate frames, persistent captions, no wide sliver. All images loaded.
- Chrome 390×844: main landscape photograph plus two subordinate cards, no narrow portrait crop; enlarged photo fits screen at its original ratio.
- Found and fixed a real pre-existing mobile lightbox defect: HTML intrinsic height was stretching the image. Explicit CSS height:auto and object-fit:contain fixed it, verified visually after rebuild.
- Mouse opens image; keyboard Enter opens, Tab stays on close, Escape closes and restores focus to source image button. Background button removed from Tab sequence.
- Existing reduced-motion rule plus gallery-specific no-transform override.
- npm run build, web TypeScript and 261/261 Vitest passed. Responsive screenshots viewed in browser; not a physical phone test. No new automated visual tests.
- Preview http://127.0.0.1:5284/ on this Mac only. No database writes, payment requests, master changes, or submitted materials changed.
